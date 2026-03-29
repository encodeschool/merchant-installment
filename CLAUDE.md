# Merchant Installment Platform — CLAUDE.md

UzHack 2026 · Central Bank of Uzbekistan Fintech Track

---

## What this project is

A 3-role installment lending (rassrochka) platform that digitizes the full lifecycle:
merchant POS → MFO credit decision → Central Bank oversight.

**Three portals, one codebase:**
- **Merchant** — submit installment applications at the point of sale
- **MFO Admin** — review applications, manage tariffs and merchants
- **Central Bank** — approve tariffs, monitor MFOs, view audit logs

---

## Monorepo structure

```
merchant-installment/
├── backend/          FastAPI (Python 3.12) + Supabase/PostgreSQL
├── frontend/         React 18 + TypeScript + Tailwind CSS + Vite
├── infra/            Docker Compose (dev + prod)
├── migrations/       3 PostgreSQL migration files
└── diagrams/         drawio architecture + challenge brief
```

---

## Running locally

```bash
# From /infra
docker compose up

# Ports
frontend  → http://localhost:3000
backend   → http://localhost:8000
postgres  → localhost:5432
redis     → localhost:6379
```

**Demo accounts** (all password `demo1234`):

| Email | Role | Panel |
|---|---|---|
| akbar@centralbank.uz | CENTRAL_BANK | /cb |
| dilnoza@ipoteka.uz | MFO_ADMIN | /mfo |
| bobur@techmart.uz | MERCHANT | /merchant |

Frontend falls back to mock data if the backend is unreachable (offline dev mode).

---

## Backend

**Stack:** FastAPI 0.111 · Pydantic v2 · python-jose JWT · passlib bcrypt · ReportLab · Uvicorn

**Entry:** `backend/app/main.py`

**Routers** (`/api/v1/*`):

| Router | Key endpoints |
|---|---|
| auth | POST /login, POST /refresh, GET /me, PATCH /profile |
| tariffs | CRUD + PATCH /{id}/approve, PATCH /{id}/reject |
| merchants | CRUD + PATCH /{id}/status, GET /{id}/stats |
| products | CRUD + PATCH /{id}/availability |
| applications | POST /multi-product, POST /{id}/confirm, PATCH /{id}/decide |
| contracts | GET list, GET /{id}/schedule, GET /{id}/pdf |
| scoring | POST /calculate, GET /{client_id}/history |
| dashboard | GET /mfo, GET /cb, GET /mfo-list |
| face_verify | POST / |

**Role guards** (via `require_role` dependency):
- `CENTRAL_BANK` — approve/reject tariffs, view all data
- `MFO_ADMIN` — manage merchants, decide on applications, create tariffs
- `MERCHANT` — manage own products, submit applications, view own contracts

**Scoring engine** (`backend/app/services/scoring.py`):

| Factor | Weight | Key rule |
|---|---|---|
| F1 Affordability | 40% | DTI (income/payment): ≥5→100, ≥3→80, ≥2→50, ≥1.5→30 |
| F2 Credit history | 30% | GOOD→100, FAIR→65, NONE→25, BAD→0 |
| F3 Behavioral | 20% | Open loans: 0→100, 1→85, 2→70, 3→50, 4→30, 5+→10 |
| F4 Demographic | 10% | Age 25–45→100, 18–55→70, 18–65→40 |

Outcomes: score ≥ tariff.min_score → **APPROVED** · score ≥ 50 → **PARTIAL** (70%) · else → **REJECTED**

Hard rejects (instant, before scoring): bankruptcy, open_loans > max, overdue_days > max, DTI < hard_dti_min

**Fraud gate** (`backend/app/services/fraud.py`): in-memory, ephemeral.
- BLOCK: duplicate passport within 24h
- FLAG: merchant > 10 applications/hour
- PASS: clean

**Payment formula:** PV × r × (1+r)^n / ((1+r)^n − 1), r = annual_rate/100/12

---

## Frontend

**Stack:** React 18 · TypeScript 5 · Tailwind CSS 3 · Vite 5 · Zustand · Axios · React Router v6 · Recharts · Heroicons · i18next (EN/RU/UZ)

**Key files:**
- `frontend/src/router/AppRouter.tsx` — role-based route guards
- `frontend/src/store/authStore.ts` — Zustand auth (persisted to localStorage)
- `frontend/src/api/index.ts` — all API calls
- `frontend/src/types/index.ts` — TypeScript interfaces + `normalizeApplication()` helper
- `frontend/src/i18n/locales/` — EN/RU/UZ translation keys

**Pages:**

| Role | Pages |
|---|---|
| MERCHANT | Dashboard, Products, New Application (3-step POS form), Installments |
| MFO_ADMIN | Dashboard, Tariffs, Merchants, Applications, Scoring Settings |
| CENTRAL_BANK | Dashboard, Tariff Approvals, MFO Monitoring, Audit Logs |

**New Application flow (merchant):**
1. Cart — select products + quantities
2. Client info — passport, income, age, employment, credit history
3. Face capture (optional) + signature (optional)
4. → POST /applications/multi-product → live score preview + eligible tariff offers
5. Confirm — select tariff + months (3/6/9/12) + sign → POST /applications/{id}/confirm

**UI components** (`frontend/src/components/ui/`):
- `StatCard` — KPI card with trend
- `Badge` / `statusBadge()` — maps API status strings to colored badges
- `Button` — primary/secondary/danger/ghost variants
- `Skeleton` — per-page loading states
- `ScoreGauge` — SVG circular gauge (green >70, orange >50, red <50)
- `FaceVerifyCamera` — webcam capture
- `SignaturePad` — canvas signature

**Role color theming:**
- Merchant → blue (`mer.*`)
- MFO Admin → emerald (`mfo.*`)
- Central Bank → purple (`cb.*`)

---

## Database

**Engine:** PostgreSQL 16 (via Supabase in cloud, local postgres:16-alpine in Docker)

**Core tables:** users · merchants · products · tariffs · clients · applications · contracts · installments · scoring_logs · audit_logs

**Notable columns:**
- `applications.application_items` — JSONB, stores multi-product array
- `applications.fraud_gate` — PASS | FLAG | BLOCK
- `tariffs.w_affordability/w_credit_history/w_behavioral/w_demographic` — configurable scoring weights
- `scoring_logs.weights_snapshot` — JSONB snapshot of weights at decision time

**Migrations:** run in order from `migrations/` — initial schema → risk fields + scoring config → extended fields (employment_type, birth_date, fraud_gate)

---

## Architecture decisions to know

- **Stateless backend:** JWT tokens only; Redis optional (token blacklist)
- **In-memory fraud gate:** resets on restart — by design for hackathon simplicity
- **Offline fallback:** frontend `mockData.ts` used when API unreachable
- **Multi-product applications:** `application_items` JSONB allows variable product list without schema change
- **Scoring is deterministic:** same inputs always produce the same score — no ML
- **Weights are per-tariff:** each MFO tariff can tune scoring weights independently
- **PDF contracts:** generated server-side with ReportLab, served as binary response

---

## What NOT to do

- Don't add ML/AI to the scoring engine — it's intentionally rule-based for regulatory transparency
- Don't change the 3-role model — it maps directly to the challenge brief
- Don't remove the mock data fallback — needed for offline demos
- Don't use `any` in TypeScript — use `normalizeApplication()` for API shape variance
- Don't modify migration files — add new migrations instead

---

## Hackathon context

- **Event:** UzHack 2026
- **Track:** Central Bank of Uzbekistan Fintech Challenge
- **Challenge brief:** `diagrams/Markaziy Bank chellendj uzhack2026.docx`
- **Architecture diagram:** `diagrams/merchant_installment.drawio.xml`
- **Team member:** Bekzod
