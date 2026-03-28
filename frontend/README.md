# Frontend — Installment Platform SPA

React 18 · TypeScript · Tailwind CSS 3 · Vite

---

## Stack

| | |
|---|---|
| Framework | React 18 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Build tool | Vite 5 |
| State | Zustand (localStorage persistence) |
| HTTP | Axios |
| Routing | React Router v6 |

---

## Getting started

### Option 1 — Docker

```bash
cd infra
docker compose up -d
```

### Option 2 — Local

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The dev server starts on `http://localhost:5173`.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL |

If the backend is unreachable the app falls back to local mock data automatically, so you can develop the UI without a running server.

---

## Demo accounts

All passwords: **`demo1234`**

| Email | Role | Panel |
|---|---|---|
| akbar@centralbank.uz | CENTRAL_BANK | Central Bank |
| dilnoza@ipoteka.uz | MFO_ADMIN | MFO |
| bobur@techmart.uz | MERCHANT | Merchant |

---

## Panels

### Central Bank

- **Dashboard** — system-wide KPIs: active MFOs, total disbursed, pending tariffs, monthly trend chart
- **Tariff Approvals** — review and approve / reject MFO-submitted tariffs
- **MFO Monitoring** — per-MFO performance table (merchants, disbursed, approval rate)
- **Audit Logs** — full action log with user, resource, IP, and timestamp

### MFO Admin

- **Dashboard** — merchant count, pending applications, monthly application trend
- **Merchants** — register merchants, set ACTIVE / SUSPENDED status, view per-merchant stats
- **Tariffs** — create / edit tariffs (interest rate, amount range, fixed months, min score); submitted as PENDING for Central Bank approval
- **Applications** — tabs for ALL / PENDING / APPROVED / PARTIAL / REJECTED; Approve, Reject, or Partial (70%) decisions with confirm modal

### Merchant (POS)

- **Dashboard** — own KPIs: products, applications this month, active contracts, pending count
- **New Application** — 3-step POS form:
  1. Select product (shows down payment % and financed amount)
  2. Enter client info (name, passport, phone, income, age, credit history)
  3. Choose tariff + months (3 / 6 / 9 / 12), live scoring preview with outcome banner
- **Products** — create / edit products with down payment % slider (0–50%); toggle availability
- **Installments** — view own contracts with next payment date and status

---

## Project structure

```
src/
├── api/
│   └── client.ts          Axios instance, auth interceptor, 401 redirect
├── components/
│   ├── layout/
│   │   ├── Layout.tsx     Shell: sidebar + header + outlet
│   │   ├── Sidebar.tsx    Role-aware nav links
│   │   └── Header.tsx     User info + logout
│   └── ui/
│       ├── Badge.tsx      Status badges (APPROVED / PARTIAL / REJECTED / …)
│       ├── Button.tsx     Shared button with variants
│       ├── Modal.tsx      Generic overlay modal
│       └── StatCard.tsx   KPI card used on dashboards
├── data/
│   └── mockData.ts        Uzbek-flavored demo data (UZS amounts, local names)
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── central-bank/
│   │   ├── CBDashboard.tsx
│   │   ├── CBTariffApprovals.tsx
│   │   ├── CBMFOMonitoring.tsx
│   │   └── CBAuditLogs.tsx
│   ├── mfo/
│   │   ├── MFODashboard.tsx
│   │   ├── MFOMerchants.tsx
│   │   ├── MFOTariffs.tsx
│   │   └── MFOApplications.tsx
│   └── merchant/
│       ├── MerchantDashboard.tsx
│       ├── MerchantNewApplication.tsx
│       ├── MerchantProducts.tsx
│       └── MerchantInstallments.tsx
├── router/
│   └── AppRouter.tsx      Role-based route guards and redirects
├── store/
│   └── authStore.ts       Zustand auth store (token, user, login/logout)
└── types/
    └── index.ts           Shared TypeScript interfaces (aligned with backend schemas)
```

---

## Routing

| Path | Role | Page |
|---|---|---|
| `/login` | — | Login |
| `/cb/dashboard` | CENTRAL_BANK | CB Dashboard |
| `/cb/tariffs` | CENTRAL_BANK | Tariff Approvals |
| `/cb/mfo-monitoring` | CENTRAL_BANK | MFO Monitoring |
| `/cb/audit` | CENTRAL_BANK | Audit Logs |
| `/mfo/dashboard` | MFO_ADMIN | MFO Dashboard |
| `/mfo/merchants` | MFO_ADMIN | Merchants |
| `/mfo/tariffs` | MFO_ADMIN | Tariffs |
| `/mfo/applications` | MFO_ADMIN | Applications |
| `/merchant/dashboard` | MERCHANT | Merchant Dashboard |
| `/merchant/new-application` | MERCHANT | New Application |
| `/merchant/products` | MERCHANT | Products |
| `/merchant/installments` | MERCHANT | Installments |

Unauthenticated requests are redirected to `/login`. Authenticated users landing on `/` are redirected to their role's dashboard.

---

## API integration

`src/api/client.ts` exports an Axios instance that:

- Reads `VITE_API_URL` for the base URL
- Attaches `Authorization: Bearer <token>` on every request
- On 401: clears localStorage and redirects to `/login`

`src/store/authStore.ts` tries the real API on login. If the request fails (backend offline), it falls back to the mock user list in `mockData.ts`. This lets the entire UI run without a backend during development.

---

## Scoring preview (frontend)

The New Application form runs the same scoring logic as the backend before submission so the merchant sees a live preliminary outcome:

| Factor | Max |
|---|---|
| Income vs monthly payment | 30 |
| Credit history | 30 |
| Age | 20 |
| Tariff match | 20 |

**Outcomes:**

| Score | Decision |
|---|---|
| ≥ tariff `minScore` | APPROVED |
| 50 – (minScore − 1) | PARTIAL — 70% of financed amount |
| < 50 | REJECTED |

Monthly payment uses the annuity formula on the financed amount (price minus down payment).
