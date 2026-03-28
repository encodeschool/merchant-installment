# Backend — Installment Platform API

FastAPI · PostgreSQL · Redis · Python 3.12

---

## Stack

| | |
|---|---|
| Framework | FastAPI 0.111 |
| ORM | SQLAlchemy 2.0 |
| Database | PostgreSQL 16 |
| Cache / token store | Redis 7 |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| PDF generation | ReportLab |
| Validation | Pydantic v2 |
| Server | Uvicorn |

---

## Getting started

### Option 1 — Docker (recommended)

```bash
cd infra
docker compose up -d
```

Then seed the database:

```bash
cd backend
python -m app.seed
```

### Option 2 — Local

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with your local Postgres and Redis URLs, then:

```bash
uvicorn app.main:app --reload --port 8000
python -m app.seed
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/installment_db` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string |
| `SECRET_KEY` | `dev-secret-key` | JWT signing key — change in production |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |

---

## Project structure

```
app/
├── main.py               App factory, CORS, router registration, auto-migrate
├── seed.py               Demo data (users, tariffs, merchants, products)
├── core/
│   ├── config.py         Settings loaded from .env
│   ├── database.py       Engine, SessionLocal, get_db dependency
│   ├── security.py       Password hashing, JWT creation/decoding
│   └── deps.py           get_current_user, require_role, get_redis
├── models/
│   ├── user.py           users table (all roles in one table)
│   ├── merchant.py       merchants
│   ├── product.py        products
│   ├── tariff.py         tariffs
│   ├── client.py         clients
│   ├── application.py    applications + scoring result
│   ├── contract.py       contracts + installments (payment schedule)
│   ├── scoring.py        scoring_logs
│   └── audit.py          audit_logs
├── schemas/              Pydantic in/out schemas (camelCase responses)
├── services/
│   ├── scoring.py        Rule-based scoring engine + annuity formula
│   ├── contract.py       Payment schedule generator + PDF (ReportLab)
│   └── audit.py          log_action helper
└── routers/
    ├── auth.py
    ├── tariffs.py
    ├── merchants.py
    ├── products.py
    ├── applications.py
    ├── contracts.py
    ├── scoring.py
    └── dashboard.py
```

---

## API reference

Interactive docs available at `http://localhost:8000/docs` once the server is running.

### Auth — `/api/v1/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | — | Email + password → access & refresh tokens |
| POST | `/refresh` | — | Refresh token → new token pair |
| POST | `/logout` | ✓ | Blacklists current token in Redis |
| GET | `/me` | ✓ | Returns current user profile |

### Tariffs — `/api/v1/tariffs`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/` | MFO_ADMIN | Create tariff (status = PENDING) |
| GET | `/` | Any | MFO sees own; Central Bank sees all |
| GET | `/{id}` | Any | Single tariff |
| PUT | `/{id}` | MFO_ADMIN | Update (only if PENDING) |
| DELETE | `/{id}` | MFO_ADMIN | Delete (only if not APPROVED) |
| PATCH | `/{id}/approve` | CENTRAL_BANK | Approve tariff |
| PATCH | `/{id}/reject` | CENTRAL_BANK | Reject tariff |

### Merchants — `/api/v1/merchants`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/` | MFO_ADMIN | Register merchant |
| GET | `/` | MFO_ADMIN, CENTRAL_BANK | List all merchants |
| GET | `/{id}` | Any | Single merchant |
| PATCH | `/{id}/status` | MFO_ADMIN | Set ACTIVE / SUSPENDED |
| GET | `/{id}/stats` | Any | Applications count + total disbursed |

### Products — `/api/v1/products`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/` | MERCHANT | Create product |
| GET | `/` | Any | MERCHANT sees own; others see all |
| GET | `/{id}` | Any | Single product |
| PUT | `/{id}` | MERCHANT | Update own product |
| PATCH | `/{id}/availability` | MERCHANT | Toggle available flag |
| DELETE | `/{id}` | MERCHANT | Delete own product |

### Applications — `/api/v1/applications`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/` | MERCHANT | Submit application — runs scoring automatically |
| GET | `/` | Any | MFO/CB see all; MERCHANT sees own |
| GET | `/{id}` | Any | Single application |
| PATCH | `/{id}/decide` | MFO_ADMIN | Approve / Partial / Reject |

**Submit body:**
```json
{
  "merchant_id": "...",
  "product_id": "...",
  "tariff_id": "...",
  "months": 12,
  "client": {
    "full_name": "Mansur Qodirov",
    "passport_number": "AA1234567",
    "phone": "+998901234567",
    "monthly_income": 3000000,
    "age": 32,
    "credit_history": "GOOD"
  }
}
```

**Decide body:**
```json
{ "action": "APPROVED" }
{ "action": "PARTIAL", "approved_amount": 5950000 }
{ "action": "REJECTED", "note": "Insufficient income" }
```

### Contracts — `/api/v1/contracts`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Any | List contracts (MERCHANT sees own) |
| GET | `/{id}` | Any | Single contract |
| GET | `/{id}/schedule` | Any | Full installment schedule |
| GET | `/{id}/pdf` | Any | Download PDF contract |

### Scoring — `/api/v1/score`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/calculate` | Any | Run scoring without creating an application |
| GET | `/{client_id}/history` | MFO_ADMIN, CENTRAL_BANK | Past scoring results for a client |

### Dashboard — `/api/v1/dashboard`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/mfo` | MFO_ADMIN | Merchant count, pending apps, monthly trend |
| GET | `/cb` | CENTRAL_BANK | System-wide stats, total disbursed |
| GET | `/mfo-list` | CENTRAL_BANK | Per-MFO performance metrics |

---

## Scoring engine

The scoring formula is deterministic — no ML, no external calls.

| Factor | Max | Logic |
|---|---|---|
| Income vs monthly payment | 30 | ≥3× payment → 30 · ≥2× → 20 · ≥1.5× → 10 · else → 5 |
| Credit history | 30 | GOOD→30 · FAIR→20 · NONE→10 · BAD→0 |
| Age | 20 | 25–55→20 · 18–65→15 · else→5 |
| Tariff match | 20 | Always 20 when tariff is selected |

**Outcomes:**

| Score | Decision |
|---|---|
| ≥ tariff `min_score` | APPROVED — full financed amount |
| 50 – (min_score − 1) | PARTIAL — 70% of financed amount |
| < 50 | REJECTED |

---

## Database schema

All primary keys are UUID. All timestamps are UTC.

```
users             id, name, email, hashed_password, role, organization, is_active
merchants         id, name, legal_name, category, phone, address, status, mfo_user_id
products          id, merchant_id, name, category, price, description, available, down_payment_percent
tariffs           id, name, mfo_user_id, interest_rate, min/max_amount, min/max_months, min_score, status
clients           id, full_name, passport_number, phone, monthly_income, age, credit_history
applications      id, merchant_id, client_id, product_id, tariff_id, months, monthly_payment,
                  total_amount, score, status, approved_amount, decided_by, decided_at
contracts         id, application_id, total_amount, months, monthly_payment, paid_installments, status
installments      id, contract_id, installment_number, due_date, amount, paid_at, status
scoring_logs      id, application_id, client_id, income/credit/age/tariff/total_score, outcome
audit_logs        id, user_id, action, resource, resource_id, ip_address, created_at
```

---

## Demo accounts

Seeded by `python -m app.seed`. All passwords: **`demo1234`**

| Email | Role | Organization |
|---|---|---|
| akbar@centralbank.uz | CENTRAL_BANK | O'zbekiston Markaziy Banki |
| dilnoza@ipoteka.uz | MFO_ADMIN | Ipoteka Bank MFO |
| bobur@techmart.uz | MERCHANT | TechMart Savdo |

---

## Role permissions summary

| Action | CENTRAL_BANK | MFO_ADMIN | MERCHANT |
|---|---|---|---|
| Approve / reject tariffs | ✓ | — | — |
| Create / manage tariffs | — | ✓ | — |
| Onboard merchants | — | ✓ | — |
| Manage own products | — | — | ✓ |
| Submit applications | — | — | ✓ |
| Approve / reject applications | — | ✓ | — |
| View all data | ✓ | own org | own data |
| Audit logs | ✓ | — | — |

## IF you cannot run the app try:
The backend needs two things before it can run:

  1. Create a .env file

  No .env file exists yet. You need to create D:/BUSINESS/MICROCREDIT/project/backend/.env with your Supabase credentials:

  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_KEY=your-supabase-anon-or-service-key
  SECRET_KEY=some-long-random-string
  ACCESS_TOKEN_EXPIRE_MINUTES=60
  REFRESH_TOKEN_EXPIRE_DAYS=7
  ALGORITHM=HS256

  Do you have a Supabase project? If not, you can create one free at supabase.com. Or if you want to run without Supabase (local SQLite/PostgreSQL), I can refactor the database layer.     

  2. Install dependencies & run

  Once the .env is ready, run these commands from D:/BUSINESS/MICROCREDIT/project/backend/:

  # Create virtual environment
  python -m venv venv
  venv\Scripts\activate

  # Install dependencies
  pip install -r requirements.txt

  # Run the server
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

  The API will be at http://localhost:8000 and docs at http://localhost:8000/docs.