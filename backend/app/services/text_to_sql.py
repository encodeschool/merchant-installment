"""
Text-to-SQL service.
Converts natural language questions to SQL, executes safely (read-only),
and returns results + human-readable explanation via AI.
"""
from __future__ import annotations

import datetime
import decimal
import json
import re
import psycopg2
import psycopg2.extras
from typing import Any


def _serialize_value(val: Any) -> Any:
    if isinstance(val, decimal.Decimal):
        return float(val)
    if isinstance(val, (datetime.datetime, datetime.date)):
        return val.isoformat()
    if isinstance(val, dict):
        return {k: _serialize_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_serialize_value(v) for v in val]
    return val


def _serialize_row(row: dict) -> dict:
    return {k: _serialize_value(v) for k, v in row.items()}

from ..core.config import settings

# ---------------------------------------------------------------------------
# Schema exposed to AI (only tables/columns needed per role)
# ---------------------------------------------------------------------------

MFO_SCHEMA = """
Database schema (PostgreSQL). You only have access to data belonging to the current MFO.

Tables:
- merchants(id, name, legal_name, category, phone, address, status, mfo_user_id, created_at)
- tariffs(id, name, interest_rate, min_amount, max_amount, min_months, max_months, min_score, status, created_at)
- applications(id, merchant_id, client_id, tariff_id, months, monthly_payment, total_amount, approved_amount, score, status, fraud_gate, created_at, decided_at)
- clients(id, full_name, passport_number, phone, monthly_income, age, credit_history, employment_type, created_at)
- contracts(id, application_id, total_amount, months, monthly_payment, paid_installments, status, created_at)
- installments(id, contract_id, installment_number, due_date, amount, paid_at, status)
- products(id, merchant_id, name, category, price, available, created_at)
- scoring_logs(id, application_id, client_id, income_score, credit_score, age_score, tariff_score, total_score, outcome, created_at)

Important constraints you MUST follow:
1. merchants table MUST be filtered: WHERE merchants.mfo_user_id = '{mfo_user_id}'
2. When querying applications, join through merchants: applications.merchant_id IN (SELECT id FROM merchants WHERE mfo_user_id = '{mfo_user_id}')
3. When querying tariffs: WHERE tariffs.mfo_user_id = '{mfo_user_id}'
4. Only SELECT statements allowed — no INSERT, UPDATE, DELETE, DROP, etc.
5. Limit results to 50 rows maximum.
6. Use LIMIT clause always.
7. NEVER select raw UUID columns (id, merchant_id, client_id, tariff_id, product_id). Always JOIN to get human-readable names instead.
8. For applications, always JOIN clients (client name), merchants (merchant name), tariffs (tariff name).
   Example: SELECT c.full_name, m.name as merchant, t.name as tariff, a.total_amount, a.status, a.created_at
            FROM applications a
            JOIN clients c ON a.client_id = c.id
            JOIN merchants m ON a.merchant_id = m.id
            JOIN tariffs t ON a.tariff_id = t.id
            WHERE a.merchant_id IN (SELECT id FROM merchants WHERE mfo_user_id = '{mfo_user_id}')
            ORDER BY a.created_at DESC LIMIT 20

application status values: PENDING, APPROVED, PARTIAL, REJECTED, ACTIVE, COMPLETED
merchant status values: ACTIVE, SUSPENDED, PENDING
tariff status values: PENDING, APPROVED, REJECTED
installment status values: UPCOMING, PAID, OVERDUE
credit_history values: GOOD, FAIR, BAD, NONE
"""

MERCHANT_SCHEMA = """
Database schema (PostgreSQL). You only have access to data belonging to the current merchant.

Tables:
- products(id, merchant_id, name, category, price, available, created_at)
- applications(id, merchant_id, client_id, tariff_id, months, monthly_payment, total_amount, approved_amount, score, status, fraud_gate, created_at, decided_at)
- clients(id, full_name, passport_number, phone, monthly_income, age, credit_history, created_at)
- contracts(id, application_id, total_amount, months, monthly_payment, paid_installments, status, created_at)
- installments(id, contract_id, installment_number, due_date, amount, paid_at, status)

Important constraints you MUST follow:
1. applications MUST be filtered: WHERE applications.merchant_id = '{merchant_id}'
2. products MUST be filtered: WHERE products.merchant_id = '{merchant_id}'
3. Only SELECT statements allowed — no INSERT, UPDATE, DELETE, DROP, etc.
4. NEVER select raw UUID columns. Always JOIN to get human-readable names.
5. For applications, always JOIN clients: SELECT c.full_name, a.total_amount, a.status, a.created_at
   FROM applications a JOIN clients c ON a.client_id = c.id
   WHERE a.merchant_id = '{merchant_id}' ORDER BY a.created_at DESC LIMIT 20
4. Limit results to 50 rows maximum.
5. Use LIMIT clause always.

application status values: PENDING, APPROVED, PARTIAL, REJECTED, ACTIVE, COMPLETED
installment status values: UPCOMING, PAID, OVERDUE
"""

# ---------------------------------------------------------------------------
# SQL safety validator
# ---------------------------------------------------------------------------

_FORBIDDEN = re.compile(
    r'\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|'
    r'pg_sleep|pg_read_file|COPY|\\\\|information_schema|pg_catalog)\b',
    re.IGNORECASE,
)

def _is_safe_sql(sql: str) -> bool:
    if _FORBIDDEN.search(sql):
        return False
    stripped = sql.strip().upper()
    if not stripped.startswith("SELECT"):
        return False
    return True


def _inject_role_filter(sql: str, role: str, mfo_user_id: str = "", merchant_id: str = "") -> str:
    """Extra safety: ensure role-based filters are present."""
    sql_upper = sql.upper()
    if role == "MFO_ADMIN":
        if mfo_user_id and mfo_user_id.upper() not in sql_upper:
            # If the query touches merchants/applications but doesn't have mfo filter, reject
            if "MERCHANTS" in sql_upper or "TARIFFS" in sql_upper:
                if mfo_user_id not in sql:
                    return None  # Signal: unsafe
    elif role == "MERCHANT":
        if merchant_id and merchant_id.upper() not in sql_upper:
            if "APPLICATIONS" in sql_upper or "PRODUCTS" in sql_upper:
                if merchant_id not in sql:
                    return None  # Signal: unsafe
    return sql

# ---------------------------------------------------------------------------
# AI SQL generation
# ---------------------------------------------------------------------------

def _generate_sql(question: str, schema: str, conversation_history: list[dict]) -> str | None:
    """Ask Groq/Claude to generate a SQL query from the user's question."""
    system = f"""You are a SQL expert. Given a user question, generate a single PostgreSQL SELECT query.

{schema}

Rules:
- Return ONLY the SQL query, nothing else — no explanation, no markdown, no backticks
- Always include LIMIT (max 50)
- Use proper JOINs when needed
- Cast amounts to readable format if useful (e.g., amount/1000000.0 for millions)
- For date filtering use: created_at >= NOW() - INTERVAL '30 days' etc.
"""

    # Include last 3 turns for context
    history = conversation_history[-6:] if len(conversation_history) > 6 else conversation_history
    messages = history + [{"role": "user", "content": f"Generate SQL for: {question}"}]

    try:
        if settings.GROQ_API_KEY:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=300,
                messages=[{"role": "system", "content": system}] + messages,
            )
            return response.choices[0].message.content.strip()
        elif settings.ANTHROPIC_API_KEY:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                system=system,
                messages=messages,
            )
            return msg.content[0].text.strip()
    except Exception:
        pass
    return None


def _explain_results(question: str, sql: str, rows: list[dict]) -> str | None:
    """Ask AI to explain query results in natural language."""
    if not rows:
        data_summary = "No results found."
    elif len(rows) <= 10:
        data_summary = json.dumps(rows, ensure_ascii=False, default=str)
    else:
        data_summary = json.dumps(rows[:10], ensure_ascii=False, default=str) + f"\n... and {len(rows) - 10} more rows"

    prompt = f"""User asked: "{question}"

SQL executed: {sql}

Results ({len(rows)} rows):
{data_summary}

Write a concise, friendly answer in the same language the user asked in (Uzbek, Russian, or English).
- Summarize key numbers and insights
- If 0 results, say what was searched
- Max 3-4 sentences
- Do NOT repeat the SQL query"""

    try:
        if settings.GROQ_API_KEY:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=250,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content.strip()
        elif settings.ANTHROPIC_API_KEY:
            import anthropic
            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=250,
                messages=[{"role": "user", "content": prompt}],
            )
            return msg.content[0].text.strip()
    except Exception:
        pass
    return None

# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def execute_text_to_sql(
    question: str,
    role: str,
    mfo_user_id: str,
    merchant_id: str,
    database_url: str,
    conversation_history: list[dict],
) -> dict:
    """
    Returns:
      {"answer": str, "sql": str, "rows": list, "row_count": int}
    or
      {"answer": str, "error": True}
    """
    if not database_url:
        return {"answer": "Text-to-SQL faqat local PostgreSQL bilan ishlaydi.", "error": True}

    # Build schema with role-specific IDs injected
    if role == "MFO_ADMIN":
        schema = MFO_SCHEMA.replace("{mfo_user_id}", mfo_user_id)
    else:
        schema = MERCHANT_SCHEMA.replace("{merchant_id}", merchant_id)

    # Step 1: Generate SQL
    raw_sql = _generate_sql(question, schema, conversation_history)
    if not raw_sql:
        return {"answer": "SQL generatsiya qilishda xatolik yuz berdi.", "error": True}

    # Clean up — remove markdown backticks if present
    sql = raw_sql.strip()
    if sql.startswith("```"):
        sql = re.sub(r"```(?:sql)?\n?", "", sql).strip().rstrip("`").strip()

    # Step 2: Safety check
    if not _is_safe_sql(sql):
        return {"answer": "Xavfsizlik sababi: faqat SELECT so'rovlari ruxsat etilgan.", "error": True}

    # Step 3: Inject role filter check
    checked = _inject_role_filter(sql, role, mfo_user_id, merchant_id)
    if checked is None:
        return {"answer": "So'rov xavfsizlik filtriga mos kelmadi.", "error": True}

    # Step 4: Execute
    try:
        conn = psycopg2.connect(database_url)
        conn.set_session(readonly=True, autocommit=True)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            rows = [_serialize_row(dict(r)) for r in cur.fetchall()]
        conn.close()
    except Exception as e:
        return {"answer": f"SQL bajarishda xatolik: {str(e)[:200]}", "error": True}

    # Step 5: Explain results
    answer = _explain_results(question, sql, rows)
    if not answer:
        if rows:
            answer = f"{len(rows)} ta natija topildi."
        else:
            answer = "Hech qanday natija topilmadi."

    return {
        "answer": answer,
        "sql": sql,
        "rows": rows[:20],  # send max 20 rows to frontend
        "row_count": len(rows),
    }
