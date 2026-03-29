"""
Supabase → Local PostgreSQL data migration script.

Usage:
    python scripts/migrate_supabase_to_local.py

Requires env vars (or backend/.env):
    SUPABASE_URL, SUPABASE_KEY, DATABASE_URL
"""
import json
import os
import sys
from pathlib import Path

# Load .env
env_file = Path(__file__).resolve().parents[1] / "backend" / ".env"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
DATABASE_URL = os.environ["DATABASE_URL"]

try:
    from supabase import create_client
    import psycopg2
    import psycopg2.extras
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install supabase psycopg2-binary")
    sys.exit(1)

# Tables in dependency order (parents before children)
TABLES = [
    "users",
    "merchants",
    "clients",
    "tariffs",
    "products",
    "applications",
    "contracts",
    "installments",
    "scoring_logs",
    "audit_logs",
]

# Columns that hold JSON/JSONB data and need serialization
JSONB_COLUMNS = {
    "applications": {"application_items", "score_breakdown", "fraud_signals"},
    "tariffs": set(),
    "scoring_logs": {"weights_snapshot", "reason_codes"},
}


def fetch_all(sb, table: str) -> list[dict]:
    """Fetch all rows from Supabase with pagination."""
    rows = []
    page_size = 1000
    offset = 0
    while True:
        res = (
            sb.table(table)
            .select("*")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return rows


def upsert_rows(conn, table: str, rows: list[dict]) -> int:
    if not rows:
        return 0

    jsonb_cols = JSONB_COLUMNS.get(table, set())
    cols = list(rows[0].keys())

    with conn.cursor() as cur:
        for row in rows:
            values = []
            for col in cols:
                val = row[col]
                if col in jsonb_cols and val is not None and not isinstance(val, str):
                    val = json.dumps(val)
                values.append(val)

            placeholders = []
            for col in cols:
                val = row[col]
                if col in jsonb_cols and val is not None:
                    placeholders.append("%s::jsonb")
                else:
                    placeholders.append("%s")

            set_clause = ", ".join(
                f"{c} = EXCLUDED.{c}" for c in cols if c != "id"
            )
            sql = f"""
                INSERT INTO {table} ({', '.join(cols)})
                VALUES ({', '.join(placeholders)})
                ON CONFLICT (id) DO UPDATE SET {set_clause}
            """
            cur.execute(sql, values)

    conn.commit()
    return len(rows)


def main():
    print(f"Connecting to Supabase: {SUPABASE_URL[:40]}...")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"Connecting to local DB: {DATABASE_URL[:40]}...")
    conn = psycopg2.connect(DATABASE_URL)

    total = 0
    for table in TABLES:
        print(f"  [{table}] fetching...", end=" ", flush=True)
        try:
            rows = fetch_all(sb, table)
            print(f"{len(rows)} rows → inserting...", end=" ", flush=True)
            n = upsert_rows(conn, table, rows)
            print(f"done ({n} upserted)")
            total += n
        except Exception as e:
            print(f"ERROR: {e}")
            conn.rollback()

    conn.close()
    print(f"\nMigration complete. {total} total rows migrated.")


if __name__ == "__main__":
    main()
