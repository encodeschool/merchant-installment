# Merchant Installment Platform

**UzHack 2026 — Central Bank of Uzbekistan Challenge**
Fintech & Modern Financial Services Track

---

## Overview

This platform digitizes the end-to-end installment (rassrochka) lending process between microfinance organizations (MFOs), merchants, and clients. Today, most MFOs evaluate clients manually — a slow, error-prone process that limits how fast merchants can close sales. This platform replaces that with a real-time, rule-based scoring engine, role-specific dashboards, and automated contract generation.

The challenge was issued by the Central Bank of Uzbekistan as part of the Fintech track of UzHack 2026. The goal: build a working MVP that demonstrates the full lifecycle — from tariff creation to signed installment contract.

---

## The Problem

When a merchant wants to sell a product on installment:

- There is no fast, reliable way to evaluate a client's creditworthiness
- Tariff terms and eligibility rules are decentralized and inconsistent
- Risk cannot be assessed in real time
- Decisions depend on individual loan officers, creating delays and inconsistency

---

## The Solution

A three-party digital platform where:

1. The MFO defines tariff plans and scoring rules
2. The merchant registers products and submits client applications from the sales floor
3. The scoring engine evaluates the client automatically and returns a decision in seconds
4. The platform generates a payment schedule and installment contract

---

## Actors

### MFO (Microfinance Organization)
Creates and manages tariff plans, sets minimum scoring thresholds, onboards merchants, monitors portfolio risk and approval rates.

### Merchant (Shop / Market)
Manages product catalog with installment terms, submits client applications at the point of sale, tracks active installment contracts.

### Client
Provides personal and financial data. Does not have a separate login — the merchant submits on the client's behalf at POS. Receives a payment schedule and contract upon approval.

### Central Bank *(platform enhancement)*
System-wide oversight layer: approves or rejects MFO tariff plans before they go live, monitors MFO performance metrics, reviews audit logs.

---

## Core Flow

```
MFO creates tariff plan
        ↓
Central Bank approves tariff
        ↓
MFO onboards merchant
        ↓
Merchant selects product + enters client data (POS)
        ↓
Scoring engine evaluates client (4 factors, 100-point scale)
        ↓
Decision: Approved / Partial Approval / Rejected
        ↓
Payment schedule generated
        ↓
Installment contract created (PDF)
```

---

## Scoring Engine

The scoring engine is rule-based and fully deterministic — no ML, no black box.

| Factor | Weight | Logic |
|---|---|---|
| Income vs monthly payment | 30 pts | ≥3× payment → 30, ≥2× → 20, ≥1.5× → 10, else → 5 |
| Credit history | 30 pts | Good → 30, Fair → 20, None → 10, Bad → 0 |
| Client age | 20 pts | 25–55 → 20, 18–65 → 15, else → 5 |
| Tariff match | 20 pts | Tariff selected and within bounds → 20 |

**Decision thresholds:**

| Score | Result |
|---|---|
| ≥ tariff `minScore` | Full approval — 100% of financed amount |
| 50 – (minScore − 1) | Partial approval — 70% of financed amount |
| < 50 | Rejected |

Each tariff has its own `minScore` set by the MFO. For example, a "Premium 24" tariff may require a score of 70, while a "Micro 6" tariff accepts 50.

---

## Down Payment

Down payment is configured per product (0–50% of price, in 5% steps).

```
Down payment amount  = price × downPaymentPercent / 100
Financed amount      = price − down payment
Monthly payment      = annuity(financedAmount, months, annualRate)
```

For partial approvals, the approved financed amount is 70% of the original financed amount. The client is expected to cover the gap as an additional upfront payment.

---

## Installment Durations

Fixed options only: **3, 6, 9, 12 months** — as specified in the challenge brief.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│  Central Bank Panel │ MFO Panel │ Merchant   │
│       /cb/*         │  /mfo/*   │ /merchant/ │
└──────────────────────────────┬──────────────┘
                               │ REST /api/v1/*
┌──────────────────────────────▼──────────────┐
│                 API Gateway                  │
│   Rate Limiter → JWT Auth → Validation       │
│   Request Router → Audit Logging             │
└──────────┬───────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────┐
│                  Services                     │
│  Merchant CRM  │  Tariffs  │  Scoring Engine  │
│  /merchant     │  /tariffs │  /score          │
│                            │  Contract Gen    │
│                            │  /contracts      │
└──────────┬───────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────┐
│                    Data                       │
│  PostgreSQL  │  Redis  │  File Storage        │
│  (primary)   │  (cache)│  (PDFs, QR codes)    │
└──────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| State management | Zustand |
| Charts | Recharts |
| Backend | FastAPI (Python) |
| Auth | JWT (access + refresh tokens via Redis) |
| Database | PostgreSQL |
| Cache | Redis |
| File storage | MinIO (local filesystem for development) |
| PDF generation | ReportLab |
| Containerization | Docker + Docker Compose |

---

## Project Structure

```
project/
├── frontend/               React SPA — all three panels
│   └── src/
│       ├── types/          TypeScript interfaces
│       ├── data/           Mock data (Uzbek context)
│       ├── store/          Zustand auth store
│       ├── router/         Role-guarded routing
│       ├── components/     Layout, UI primitives
│       └── pages/          central-bank / mfo / merchant
├── backend/                FastAPI application
│   └── app/
│       ├── core/           Config, security, database
│       ├── models/         SQLAlchemy ORM models
│       ├── schemas/        Pydantic request/response schemas
│       ├── routers/        API endpoints per service
│       └── services/       Business logic
├── infra/
│   └── docker-compose.yml
├── qa/
│   └── test_scoring_engine.py
└── diagrams/
    ├── merchant_installment.drawio.xml
    ├── Markaziy Bank chellendj uzhack2026.docx
    └── README.md                               ← you are here
```

---

## Database Tables

`central_bank_users` · `mfo_users` · `merchants` · `products` · `tariffs` · `clients` · `applications` · `installments` · `contracts` · `scoring_logs`

---

## API Endpoints

| Service | Endpoints |
|---|---|
| Auth | `POST /api/v1/auth/login` · `POST /api/v1/auth/refresh` · `POST /api/v1/auth/logout` |
| Merchant CRM | `POST /merchants/register` · `GET /merchants/{id}/stats` · `POST /products` · `PUT /products/{id}` |
| Applications | `POST /applications/new` · `GET /applications/{id}/status` · `PATCH /applications/{id}/decide` |
| Tariffs | `POST /tariffs` · `GET /tariffs` · `PUT /tariffs/{id}` · `PATCH /tariffs/{id}/approve` · `DELETE /tariffs/{id}` |
| Scoring | `POST /score/calculate` · `GET /score/{client_id}/history` |
| Contracts | `POST /contracts/generate` · `GET /contracts/{id}` · `GET /contracts/{id}/pdf` · `GET /contracts/{id}/schedule` |

---

## Roles & Permissions

| Role | Can do |
|---|---|
| `CENTRAL_BANK` | Read system stats, approve/reject tariff plans, view audit logs |
| `MFO_ADMIN` | Full CRUD on tariffs and merchants, approve/reject/partial applications |
| `MERCHANT` | Manage own products, submit client applications, view own installments |

---

## Running the Frontend

```bash
cd frontend
npm install
npm run dev       # http://localhost:3000
```

Demo accounts (any password works in mock mode):

| Email | Role |
|---|---|
| akbar@centralbank.uz | Central Bank |
| dilnoza@ipoteka.uz | MFO Admin |
| bobur@techmart.uz | Merchant |

---

## Running the Full Stack

```bash
docker-compose -f infra/docker-compose.yml up
```

Services:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

---

## Evaluation Criteria

Per the challenge brief:

1. **Architecture clarity** — clean separation of concerns across 4 layers
2. **Business logic correctness** — scoring formula, tariff matching, 3-outcome decisions
3. **UI usability** — responsive design, role-appropriate panels, minimal friction at POS
4. **Automation level** — zero manual steps from application submission to contract
5. **Scalability** — stateless API, Redis caching, horizontal scaling ready

---

## Optional Features (from brief)

- [ ] SMS verification via Eskiz / Playmobile
- [ ] QR code embedded in contract PDF
- [ ] Fraud detection signals (duplicate passport, velocity checks)
- [x] Mobile-responsive design

---

*Built for UzHack 2026 · Central Bank of Uzbekistan · Fintech Track*
