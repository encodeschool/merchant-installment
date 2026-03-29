"""
AI Q&A Chat router — streaming SSE responses for MFO_ADMIN and MERCHANT roles.
Supports both conversational Q&A and Text-to-SQL queries against the live DB.
"""
from __future__ import annotations

import json
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import Client

from ..core.config import settings
from ..core.database import get_supabase
from ..core.deps import require_role, get_current_user

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]  # conversation history


# ---------------------------------------------------------------------------
# Context collectors
# ---------------------------------------------------------------------------

def _mfo_context(db: Client, user: dict) -> str:
    mfo_user_id = user["id"]
    mfo_name = user.get("organization", "MFO")

    # Merchant count
    try:
        merchants = db.table("merchants").select("id, name, status").eq("mfo_user_id", mfo_user_id).execute().data
        merchant_ids = [m["id"] for m in merchants]
    except Exception:
        merchants, merchant_ids = [], []

    # Recent applications summary
    app_summary = {"total": 0, "approved": 0, "rejected": 0, "pending": 0}
    if merchant_ids:
        try:
            apps = (
                db.table("applications")
                .select("status, approved_amount, total_amount")
                .in_("merchant_id", merchant_ids)
                .order("created_at", desc=True)
                .limit(200)
                .execute()
                .data
            )
            for a in apps:
                app_summary["total"] += 1
                s = a.get("status", "")
                if s in ("APPROVED", "ACTIVE", "COMPLETED", "PARTIAL"):
                    app_summary["approved"] += 1
                elif s == "REJECTED":
                    app_summary["rejected"] += 1
                elif s == "PENDING":
                    app_summary["pending"] += 1
        except Exception:
            pass

    # Active tariffs
    try:
        tariffs = (
            db.table("tariffs")
            .select("name, interest_rate, min_score, min_amount, max_amount, status")
            .eq("mfo_user_id", mfo_user_id)
            .execute()
            .data
        )
    except Exception:
        tariffs = []

    merchant_lines = "\n".join(
        f"  - {m['name']} (status: {m.get('status','?')})" for m in merchants
    ) or "  (none)"
    tariff_lines = "\n".join(
        f"  - {t['name']}: {t['interest_rate']}% rate, min_score={t['min_score']}, "
        f"{t['min_amount']:,}–{t['max_amount']:,} UZS, status={t['status']}"
        for t in tariffs
    ) or "  (none)"

    return f"""You are an AI assistant for {mfo_name}, a microfinance organization in Uzbekistan.
You help MFO admin staff understand their business data, applications, and tariffs.

## Your data context:
**Merchants under {mfo_name}:**
{merchant_lines}

**Tariff products:**
{tariff_lines}

**Recent application stats (last 200):**
- Total: {app_summary['total']}
- Approved/Active: {app_summary['approved']}
- Rejected: {app_summary['rejected']}
- Pending: {app_summary['pending']}
- Approval rate: {round(app_summary['approved'] / app_summary['total'] * 100) if app_summary['total'] else 0}%

Answer questions about this MFO's operations, merchants, tariffs, and application trends.
Be concise and professional. Use numbers when available. Answer in the same language the user writes in (Uzbek, Russian, or English).
When the user asks for specific data (lists, records, details), say you can query the database directly."""


def _merchant_context(db: Client, user: dict) -> str:
    merchant_name = user.get("organization", "Merchant")

    # Find merchant record
    try:
        m_rows = db.table("merchants").select("id, name, status").eq("user_id", user["id"]).execute().data
        merchant = m_rows[0] if m_rows else None
        merchant_id = merchant["id"] if merchant else None
    except Exception:
        merchant, merchant_id = None, None

    # Products
    products_info = ""
    if merchant_id:
        try:
            products = (
                db.table("products")
                .select("name, price, available")
                .eq("merchant_id", merchant_id)
                .execute()
                .data
            )
            products_info = "\n".join(
                f"  - {p['name']}: {p['price']:,} UZS ({'available' if p['available'] else 'unavailable'})"
                for p in products
            ) or "  (none)"
        except Exception:
            products_info = "  (unavailable)"

    # Recent applications
    app_lines = ""
    if merchant_id:
        try:
            apps = (
                db.table("applications")
                .select("id, status, total_amount, approved_amount, created_at")
                .eq("merchant_id", merchant_id)
                .order("created_at", desc=True)
                .limit(20)
                .execute()
                .data
            )
            app_lines = "\n".join(
                f"  - {a['created_at'][:10]}: {a['status']}, "
                f"amount={a.get('total_amount') or 0:,} UZS"
                for a in apps
            ) or "  (none)"
        except Exception:
            app_lines = "  (unavailable)"

    return f"""You are an AI assistant for {merchant_name}, a merchant on the installment lending platform.
You help merchants understand their products, applications, and installment contracts.

## Your data context:
**Store:** {merchant_name} (status: {merchant['status'] if merchant else 'unknown'})

**Products:**
{products_info}

**Recent applications (last 20):**
{app_lines}

Answer questions about this merchant's products, applications, and installment sales.
Be concise and friendly. Use numbers when available. Answer in the same language the user writes in (Uzbek, Russian, or English).
When the user asks for specific data (lists, records, details), say you can query the database directly."""


# ---------------------------------------------------------------------------
# Intent classifier: should we use text-to-SQL?
# ---------------------------------------------------------------------------

_SQL_KEYWORDS = [
    "ro'yxat", "royxat", "список", "list",
    "oxirgi", "последн", "last", "recent",
    "nechta", "сколько", "how many", "count",
    "qaysi", "какой", "which",
    "ko'rsat", "покажи", "show", "display",
    "kimlar", "кто", "who",
    "qachon", "когда", "when",
    "eng ko'p", "самый", "top", "most",
    "bugun", "сегодня", "today",
    "bu hafta", "эта неделя", "this week",
    "bu oy", "этот месяц", "this month",
    "summasi", "сумма", "total amount",
    "rad etil", "отклонен", "rejected",
    "tasdiq", "одобрен", "approved",
    "pending", "kutilmoqda", "ожидает",
    "shartnoma", "договор", "contract",
    "to'lov", "платеж", "payment",
    "muddati", "срок", "overdue",
]

def _should_use_sql(question: str) -> bool:
    """Heuristic: does this question need live DB data?"""
    q = question.lower()
    return any(kw in q for kw in _SQL_KEYWORDS)


def _get_merchant_id(db: Client, user: dict) -> str:
    try:
        rows = db.table("merchants").select("id").eq("user_id", user["id"]).execute().data
        return rows[0]["id"] if rows else ""
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Streaming endpoint
# ---------------------------------------------------------------------------

@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase),
):
    role = current_user.get("role")
    if role not in ("MFO_ADMIN", "MERCHANT"):
        raise HTTPException(status_code=403, detail="Chat not available for this role")

    if not settings.GROQ_API_KEY and not settings.ANTHROPIC_API_KEY:
        async def _no_key():
            yield "data: " + json.dumps({"delta": "AI is not configured on this server."}) + "\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(_no_key(), media_type="text/event-stream")

    if role == "MFO_ADMIN":
        system_prompt = _mfo_context(db, current_user)
    else:
        system_prompt = _merchant_context(db, current_user)

    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    last_question = messages[-1]["content"] if messages else ""

    # ---------------------------------------------------------------------------
    # Text-to-SQL path: if question seems to need live DB data
    # ---------------------------------------------------------------------------
    if settings.DATABASE_URL and _should_use_sql(last_question):
        import asyncio

        async def generate_sql() -> AsyncGenerator[str, None]:
            try:
                from ..services.text_to_sql import execute_text_to_sql

                mfo_user_id = current_user["id"] if role == "MFO_ADMIN" else ""
                merchant_id = _get_merchant_id(db, current_user) if role == "MERCHANT" else ""

                result = execute_text_to_sql(
                    question=last_question,
                    role=role,
                    mfo_user_id=mfo_user_id,
                    merchant_id=merchant_id,
                    database_url=settings.DATABASE_URL,
                    conversation_history=messages[:-1],
                )

                answer = result.get("answer", "")
                sql_result = None
                if not result.get("error") and result.get("row_count", 0) > 0:
                    sql_result = {
                        "sql": result.get("sql", ""),
                        "rows": result.get("rows", []),
                        "row_count": result.get("row_count", 0),
                    }

                # Stream answer word by word for typing effect
                words = answer.split(" ")
                for i, word in enumerate(words):
                    chunk = word + (" " if i < len(words) - 1 else "")
                    # On last word, attach sql_result if any
                    if i == len(words) - 1 and sql_result:
                        yield "data: " + json.dumps({"delta": chunk, "sql_result": sql_result}) + "\n\n"
                    else:
                        yield "data: " + json.dumps({"delta": chunk}) + "\n\n"
                    await asyncio.sleep(0.03)

            except Exception as e:
                yield "data: " + json.dumps({"delta": f"Xatolik: {str(e)[:100]}"}) + "\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate_sql(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ---------------------------------------------------------------------------
    # Conversational path: stream AI response
    # ---------------------------------------------------------------------------
    async def generate() -> AsyncGenerator[str, None]:
        try:
            if settings.GROQ_API_KEY:
                from groq import Groq
                client = Groq(api_key=settings.GROQ_API_KEY)
                stream = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    max_tokens=600,
                    messages=[{"role": "system", "content": system_prompt}] + messages,
                    stream=True,
                )
                for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        yield "data: " + json.dumps({"delta": delta}) + "\n\n"
            else:
                import anthropic
                client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
                with client.messages.stream(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=600,
                    system=system_prompt,
                    messages=messages,
                ) as stream:
                    for text in stream.text_stream:
                        yield "data: " + json.dumps({"delta": text}) + "\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield "data: " + json.dumps({"error": str(e)}) + "\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
