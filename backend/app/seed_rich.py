"""
Rich demo data seeder — makes the MFO dashboard look impressive.
Run from the backend/ directory:
    python -m app.seed_rich

Prereq: seed.py must have run first (creates MFO user, merchants, tariffs, products).
Safe to re-run: exits early if demo data already exists.
"""
import sys
import os
import uuid
import calendar
from datetime import datetime, date, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_supabase
db = get_supabase()
from app.services.scoring import monthly_payment as calc_mp

TODAY = date(2026, 3, 28)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ts(y, m, d, h=10) -> str:
    """ISO timestamp in UTC."""
    return datetime(y, m, d, h, 0, 0, tzinfo=timezone.utc).isoformat()


def add_months(d: date, n: int) -> date:
    month = d.month - 1 + n
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def score_for_client(c: dict, mp: int, tariff: dict) -> int:
    """Quick deterministic score estimate (0-100)."""
    income = c["monthly_income"]
    dti = mp / income if income > 0 else 1
    s = 0
    if dti < 0.3:
        s += 40
    elif dti < 0.5:
        s += 28
    elif dti < 0.7:
        s += 15
    hist_scores = {"GOOD": 30, "FAIR": 18, "BAD": 5, "NONE": 12}
    s += hist_scores.get(c["credit_history"], 12)
    age = c["age"]
    if 28 <= age <= 50:
        s += 10
    elif 22 <= age <= 60:
        s += 7
    else:
        s += 3
    if c["open_loans"] == 0:
        s += 10
    elif c["open_loans"] <= 2:
        s += 7
    else:
        s += 2
    if c["overdue_days"] > 60:
        s -= 15
    elif c["overdue_days"] > 0:
        s -= 5
    return max(0, min(100, s))


# ---------------------------------------------------------------------------
# Client data
# ---------------------------------------------------------------------------

CLIENTS = [
    {"full_name": "Jasur Mirzayev",       "passport_number": "SD1234501", "phone": "+998901110001", "monthly_income": 8_500_000,  "age": 32, "credit_history": "GOOD", "open_loans": 1, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Malika Toshmatova",     "passport_number": "SD1234502", "phone": "+998901110002", "monthly_income": 5_200_000,  "age": 28, "credit_history": "GOOD", "open_loans": 0, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Sherzod Nazarov",       "passport_number": "SD1234503", "phone": "+998901110003", "monthly_income": 12_000_000, "age": 41, "credit_history": "GOOD", "open_loans": 2, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Nilufar Xasanova",      "passport_number": "SD1234504", "phone": "+998901110004", "monthly_income": 6_800_000,  "age": 35, "credit_history": "FAIR", "open_loans": 1, "overdue_days": 15, "has_bankruptcy": False},
    {"full_name": "Behruz Qodirov",        "passport_number": "SD1234505", "phone": "+998901110005", "monthly_income": 4_500_000,  "age": 24, "credit_history": "NONE", "open_loans": 0, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Zulfiya Rahimova",      "passport_number": "SD1234506", "phone": "+998901110006", "monthly_income": 9_500_000,  "age": 38, "credit_history": "GOOD", "open_loans": 1, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Otabek Yunusov",        "passport_number": "SD1234507", "phone": "+998901110007", "monthly_income": 7_200_000,  "age": 30, "credit_history": "GOOD", "open_loans": 0, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Feruza Alimova",        "passport_number": "SD1234508", "phone": "+998901110008", "monthly_income": 3_800_000,  "age": 26, "credit_history": "FAIR", "open_loans": 2, "overdue_days": 30, "has_bankruptcy": False},
    {"full_name": "Umid Xoliqov",          "passport_number": "SD1234509", "phone": "+998901110009", "monthly_income": 15_000_000, "age": 45, "credit_history": "GOOD", "open_loans": 3, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Sarvinoz Karimova",     "passport_number": "SD1234510", "phone": "+998901110010", "monthly_income": 6_000_000,  "age": 29, "credit_history": "GOOD", "open_loans": 1, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Doniyor Ergashev",      "passport_number": "SD1234511", "phone": "+998901110011", "monthly_income": 8_000_000,  "age": 33, "credit_history": "GOOD", "open_loans": 0, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Hulkar Saidova",        "passport_number": "SD1234512", "phone": "+998901110012", "monthly_income": 5_500_000,  "age": 31, "credit_history": "FAIR", "open_loans": 1, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Mansur Tursunov",       "passport_number": "SD1234513", "phone": "+998901110013", "monthly_income": 11_000_000, "age": 42, "credit_history": "GOOD", "open_loans": 2, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Gulnora Askarova",      "passport_number": "SD1234514", "phone": "+998901110014", "monthly_income": 4_200_000,  "age": 27, "credit_history": "NONE", "open_loans": 0, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Rustam Xolmatov",       "passport_number": "SD1234515", "phone": "+998901110015", "monthly_income": 7_800_000,  "age": 36, "credit_history": "GOOD", "open_loans": 1, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Mohira Umarova",        "passport_number": "SD1234516", "phone": "+998901110016", "monthly_income": 6_500_000,  "age": 34, "credit_history": "GOOD", "open_loans": 0, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Sanjar Qosimov",        "passport_number": "SD1234517", "phone": "+998901110017", "monthly_income": 5_000_000,  "age": 25, "credit_history": "BAD",  "open_loans": 3, "overdue_days": 60, "has_bankruptcy": False},
    {"full_name": "Nargiza Ismoilova",     "passport_number": "SD1234518", "phone": "+998901110018", "monthly_income": 9_000_000,  "age": 40, "credit_history": "GOOD", "open_loans": 1, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Eldor Xudoyberdiyev",   "passport_number": "SD1234519", "phone": "+998901110019", "monthly_income": 13_000_000, "age": 44, "credit_history": "GOOD", "open_loans": 2, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Barno Normatova",       "passport_number": "SD1234520", "phone": "+998901110020", "monthly_income": 4_800_000,  "age": 28, "credit_history": "FAIR", "open_loans": 1, "overdue_days": 20, "has_bankruptcy": False},
    {"full_name": "Kamol Raximov",         "passport_number": "SD1234521", "phone": "+998901110021", "monthly_income": 10_500_000, "age": 39, "credit_history": "GOOD", "open_loans": 1, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Dilorom Nazarova",      "passport_number": "SD1234522", "phone": "+998901110022", "monthly_income": 5_800_000,  "age": 32, "credit_history": "GOOD", "open_loans": 0, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Firdavs Musayev",       "passport_number": "SD1234523", "phone": "+998901110023", "monthly_income": 7_500_000,  "age": 37, "credit_history": "FAIR", "open_loans": 2, "overdue_days": 10, "has_bankruptcy": False},
    {"full_name": "Ozoda Tojiboyeva",      "passport_number": "SD1234524", "phone": "+998901110024", "monthly_income": 6_200_000,  "age": 30, "credit_history": "GOOD", "open_loans": 0, "overdue_days": 0,  "has_bankruptcy": False},
    {"full_name": "Islombek Haydarov",     "passport_number": "SD1234525", "phone": "+998901110025", "monthly_income": 8_800_000,  "age": 35, "credit_history": "GOOD", "open_loans": 1, "overdue_days": 0,  "has_bankruptcy": False},
]

# ---------------------------------------------------------------------------
# Application schedule
# (year, month, day, status, months_term, client_index, product_index)
# product_index: cycles through available products
# ---------------------------------------------------------------------------
# statuses with contracts: ACTIVE, COMPLETED
# statuses without contracts: PENDING, APPROVED, PARTIAL, REJECTED
APP_SCHEDULE = [
    # October 2025 — 7 apps (all old → COMPLETED or long-running ACTIVE)
    (2025, 10,  5, "COMPLETED", 6,   0, 0),
    (2025, 10,  9, "COMPLETED", 6,   2, 2),
    (2025, 10, 13, "COMPLETED", 6,   5, 3),
    (2025, 10, 17, "ACTIVE",   12,   8, 1),
    (2025, 10, 21, "COMPLETED", 6,   3, 4),
    (2025, 10, 25, "ACTIVE",   12,  18, 0),
    (2025, 10, 29, "COMPLETED", 6,  11, 2),

    # November 2025 — 10 apps
    (2025, 11,  3, "COMPLETED", 6,   1, 3),
    (2025, 11,  6, "ACTIVE",   12,   6, 1),
    (2025, 11,  9, "COMPLETED", 6,  12, 4),
    (2025, 11, 12, "ACTIVE",   12,  20, 0),
    (2025, 11, 15, "COMPLETED", 6,   4, 2),
    (2025, 11, 18, "ACTIVE",   12,  15, 3),
    (2025, 11, 21, "REJECTED",  6,  16, 1),
    (2025, 11, 24, "ACTIVE",   12,   9, 4),
    (2025, 11, 27, "COMPLETED", 6,   7, 0),
    (2025, 11, 30, "ACTIVE",   12,  22, 2),

    # December 2025 — 14 apps
    (2025, 12,  2, "COMPLETED", 6,  10, 3),
    (2025, 12,  4, "ACTIVE",   12,   0, 1),
    (2025, 12,  6, "ACTIVE",   12,  13, 0),
    (2025, 12,  8, "REJECTED",  6,  17, 2),
    (2025, 12, 10, "ACTIVE",   12,   2, 4),
    (2025, 12, 12, "COMPLETED", 6,   5, 3),
    (2025, 12, 14, "ACTIVE",   12,  19, 1),
    (2025, 12, 16, "REJECTED",  6,  16, 0),
    (2025, 12, 18, "ACTIVE",   12,   8, 2),
    (2025, 12, 20, "APPROVED", 12,  21, 4),
    (2025, 12, 22, "ACTIVE",   12,  14, 3),
    (2025, 12, 24, "PARTIAL",  12,   4, 1),
    (2025, 12, 26, "ACTIVE",   12,  23, 0),
    (2025, 12, 28, "COMPLETED", 6,   6, 2),

    # January 2026 — 18 apps
    (2026,  1,  2, "ACTIVE",   12,   1, 4),
    (2026,  1,  4, "ACTIVE",   12,  11, 3),
    (2026,  1,  6, "REJECTED",  6,  16, 1),
    (2026,  1,  8, "ACTIVE",   12,   3, 0),
    (2026,  1, 10, "ACTIVE",   12,  24, 2),
    (2026,  1, 12, "APPROVED", 12,  18, 4),
    (2026,  1, 14, "ACTIVE",   12,   9, 1),
    (2026,  1, 16, "REJECTED",  6,  17, 3),
    (2026,  1, 18, "ACTIVE",   12,   7, 0),
    (2026,  1, 20, "PARTIAL",  12,   4, 2),
    (2026,  1, 21, "ACTIVE",   12,  20, 4),
    (2026,  1, 22, "ACTIVE",   12,  12, 1),
    (2026,  1, 23, "REJECTED",  6,  16, 3),
    (2026,  1, 24, "ACTIVE",   12,   0, 0),
    (2026,  1, 25, "APPROVED", 12,  22, 2),
    (2026,  1, 26, "ACTIVE",   12,  15, 4),
    (2026,  1, 28, "ACTIVE",   12,  10, 1),
    (2026,  1, 30, "ACTIVE",   12,   5, 3),

    # February 2026 — 22 apps
    (2026,  2,  1, "ACTIVE",   12,   2, 0),
    (2026,  2,  3, "ACTIVE",   12,  13, 2),
    (2026,  2,  4, "REJECTED",  6,  16, 4),
    (2026,  2,  5, "ACTIVE",   12,  19, 1),
    (2026,  2,  6, "ACTIVE",   12,   8, 3),
    (2026,  2,  7, "APPROVED", 12,  21, 0),
    (2026,  2,  8, "ACTIVE",   12,   1, 2),
    (2026,  2,  9, "ACTIVE",   12,   6, 4),
    (2026,  2, 10, "REJECTED",  6,  17, 1),
    (2026,  2, 11, "ACTIVE",   12,  23, 3),
    (2026,  2, 12, "ACTIVE",   12,  14, 0),
    (2026,  2, 13, "PARTIAL",  12,   4, 2),
    (2026,  2, 14, "ACTIVE",   12,  11, 4),
    (2026,  2, 15, "APPROVED", 12,  24, 1),
    (2026,  2, 17, "ACTIVE",   12,   7, 3),
    (2026,  2, 18, "ACTIVE",   12,  20, 0),
    (2026,  2, 19, "REJECTED",  6,  16, 2),
    (2026,  2, 20, "ACTIVE",   12,   3, 4),
    (2026,  2, 21, "ACTIVE",   12,  18, 1),
    (2026,  2, 24, "PENDING",  12,   9, 3),
    (2026,  2, 25, "ACTIVE",   12,  22, 0),
    (2026,  2, 26, "APPROVED", 12,  15, 2),

    # March 2026 — 16 apps (current month, mostly PENDING)
    (2026,  3,  1, "ACTIVE",   12,   0, 4),
    (2026,  3,  3, "PENDING",  12,  12, 1),
    (2026,  3,  5, "APPROVED", 12,  10, 3),
    (2026,  3,  7, "PENDING",  12,   6, 0),
    (2026,  3,  9, "ACTIVE",   12,  23, 2),
    (2026,  3, 11, "REJECTED",  6,  17, 4),
    (2026,  3, 13, "PENDING",  12,   5, 1),
    (2026,  3, 15, "APPROVED", 12,   2, 3),
    (2026,  3, 17, "ACTIVE",   12,  19, 0),
    (2026,  3, 19, "PENDING",  12,  11, 2),
    (2026,  3, 20, "ACTIVE",   12,  24, 4),
    (2026,  3, 22, "PENDING",  12,   8, 1),
    (2026,  3, 24, "APPROVED", 12,  13, 3),
    (2026,  3, 25, "PENDING",  12,   7, 0),
    (2026,  3, 26, "PENDING",  12,   1, 2),
    (2026,  3, 27, "PENDING",  12,  14, 4),
]

# Down payment percents matching product indices
PRODUCT_DOWN_PCT = [20, 30, 25, 15, 10]  # matches products[0..4]


def make_installments(contract_id: str, start: date, mp: int, months: int, status: str) -> list[dict]:
    """Generate installments, marking past ones as PAID (or OVERDUE for DEFAULTED contracts)."""
    rows = []
    for i in range(1, months + 1):
        due = add_months(start, i)
        if status == "COMPLETED":
            inst_status = "PAID"
            paid_at = (due - timedelta(days=3)).isoformat()
        elif due < TODAY:
            # ACTIVE contract, past installment — mostly PAID, rarely OVERDUE
            if i % 9 == 0:  # ~11% overdue
                inst_status = "OVERDUE"
                paid_at = None
            else:
                inst_status = "PAID"
                paid_at = (due - timedelta(days=2)).isoformat()
        else:
            inst_status = "UPCOMING"
            paid_at = None

        rows.append({
            "id": str(uuid.uuid4()),
            "contract_id": contract_id,
            "installment_number": i,
            "due_date": due.isoformat(),
            "amount": mp,
            "paid_at": paid_at,
            "status": inst_status,
        })
    return rows


def seed_rich():
    # Guard: check by sentinel passport
    existing = db.table("clients").select("id").eq("passport_number", "SD1234501").execute().data
    if existing:
        print("Rich demo data already seeded — skipping.")
        return

    # -----------------------------------------------------------------------
    # 1. Get existing MFO user
    # -----------------------------------------------------------------------
    mfo_rows = db.table("users").select("*").eq("email", "dilnoza@ipoteka.uz").execute().data
    if not mfo_rows:
        print("ERROR: Run seed.py first to create the base MFO user.")
        sys.exit(1)
    mfo = mfo_rows[0]
    mfo_id = mfo["id"]

    # -----------------------------------------------------------------------
    # 2. Get existing merchants, tariffs, products
    # -----------------------------------------------------------------------
    merchants = db.table("merchants").select("*").eq("mfo_user_id", mfo_id).execute().data
    tariffs   = db.table("tariffs").select("*").eq("mfo_user_id", mfo_id).in_("status", ["APPROVED"]).execute().data
    all_products = []
    for m in merchants:
        prods = db.table("products").select("*").eq("merchant_id", m["id"]).execute().data
        all_products.extend(prods)

    if not merchants or not tariffs or not all_products:
        print("ERROR: Missing merchants/tariffs/products. Run seed.py first.")
        sys.exit(1)

    tariff = tariffs[0]  # use the first approved tariff for all seeded apps

    # -----------------------------------------------------------------------
    # 3. Insert clients
    # -----------------------------------------------------------------------
    print("Inserting clients...")
    client_ids = []
    for c in CLIENTS:
        cid = str(uuid.uuid4())
        db.table("clients").insert({
            "id": cid,
            **c,
        }).execute()
        client_ids.append(cid)
    print(f"  {len(client_ids)} clients inserted.")

    # -----------------------------------------------------------------------
    # 4. Insert applications + contracts + installments
    # -----------------------------------------------------------------------
    print("Inserting applications, contracts, installments...")
    app_count = contract_count = inst_count = 0

    products_cycled = all_products  # use all available products

    for (yr, mo, dy, status, months, cli_idx, prod_idx) in APP_SCHEDULE:
        client_id = client_ids[cli_idx % len(client_ids)]
        client    = CLIENTS[cli_idx % len(CLIENTS)]
        product   = products_cycled[prod_idx % len(products_cycled)]
        merchant_id = product["merchant_id"]

        # Financials
        down_pct      = product.get("down_payment_percent", 20)
        down_payment  = int(product["price"] * down_pct / 100)
        financed      = product["price"] - down_payment
        mp            = int(calc_mp(financed, months, tariff["interest_rate"]))
        total_amount  = mp * months
        score         = score_for_client(client, mp, tariff)

        created_iso  = ts(yr, mo, dy, 9)
        decided_iso  = ts(yr, mo, dy, 14) if status != "PENDING" else None
        approved_amt = total_amount if status in ("APPROVED", "ACTIVE", "COMPLETED") else (
            int(total_amount * 0.7) if status == "PARTIAL" else None
        )

        app_id = str(uuid.uuid4())
        db.table("applications").insert({
            "id":              app_id,
            "merchant_id":     merchant_id,
            "client_id":       client_id,
            "product_id":      product["id"],
            "tariff_id":       tariff["id"],
            "months":          months,
            "monthly_payment": mp,
            "total_amount":    total_amount,
            "score":           score,
            "status":          status,
            "approved_amount": approved_amt,
            "decided_by":      mfo_id if decided_iso else None,
            "created_at":      created_iso,
            "decided_at":      decided_iso,
        }).execute()
        app_count += 1

        # Contract + installments for finalized loans
        if status in ("ACTIVE", "COMPLETED", "PARTIAL"):
            contract_status = "COMPLETED" if status == "COMPLETED" else "ACTIVE"
            actual_total    = int(total_amount * 0.7) if status == "PARTIAL" else total_amount
            actual_mp       = int(actual_total / months)

            contract_id = str(uuid.uuid4())
            db.table("contracts").insert({
                "id":               contract_id,
                "application_id":   app_id,
                "total_amount":     actual_total,
                "months":           months,
                "monthly_payment":  actual_mp,
                "paid_installments": months if contract_status == "COMPLETED" else max(0, (TODAY - date(yr, mo, dy)).days // 30),
                "status":           contract_status,
            }).execute()
            contract_count += 1

            start_date  = date(yr, mo, dy)
            installments = make_installments(contract_id, start_date, actual_mp, months, contract_status)
            db.table("installments").insert(installments).execute()
            inst_count += len(installments)

    print(f"  {app_count} applications, {contract_count} contracts, {inst_count} installments inserted.")

    # -----------------------------------------------------------------------
    # 5. Activate the third merchant (was PENDING)
    # -----------------------------------------------------------------------
    pending_merchants = [m for m in merchants if m["status"] == "PENDING"]
    for m in pending_merchants:
        db.table("merchants").update({"status": "ACTIVE"}).eq("id", m["id"]).execute()
    if pending_merchants:
        print(f"  Activated {len(pending_merchants)} pending merchant(s).")

    # -----------------------------------------------------------------------
    # Done
    # -----------------------------------------------------------------------
    print()
    print("Rich demo seed complete!")
    print(f"  Login: dilnoza@ipoteka.uz / demo1234")
    print(f"  Dashboard now shows ~{app_count} applications over 6 months.")


if __name__ == "__main__":
    seed_rich()
