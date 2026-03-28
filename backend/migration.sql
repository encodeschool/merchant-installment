-- ============================================================
-- Migration: Create all tables for merchant-installment app
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ENUM TYPES
CREATE TYPE user_role AS ENUM ('MFO_ADMIN', 'MERCHANT');
CREATE TYPE merchant_status AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');
CREATE TYPE credit_history AS ENUM ('GOOD', 'FAIR', 'BAD', 'NONE');
CREATE TYPE tariff_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE application_status AS ENUM ('PENDING', 'APPROVED', 'PARTIAL', 'REJECTED', 'ACTIVE', 'COMPLETED');
CREATE TYPE contract_status AS ENUM ('ACTIVE', 'COMPLETED', 'DEFAULTED');
CREATE TYPE installment_status AS ENUM ('UPCOMING', 'PAID', 'OVERDUE');

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    role        user_role NOT NULL,
    organization TEXT NOT NULL DEFAULT '',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- ============================================================
-- TABLE: merchants
-- ============================================================
CREATE TABLE merchants (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name        TEXT NOT NULL,
    legal_name  TEXT NOT NULL,
    category    TEXT NOT NULL,
    phone       TEXT NOT NULL,
    address     TEXT NOT NULL,
    status      merchant_status NOT NULL DEFAULT 'PENDING',
    mfo_user_id TEXT NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: clients
-- ============================================================
CREATE TABLE clients (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    full_name       TEXT NOT NULL,
    passport_number TEXT NOT NULL UNIQUE,
    phone           TEXT NOT NULL,
    monthly_income  BIGINT NOT NULL,
    age             INTEGER NOT NULL,
    credit_history  credit_history NOT NULL DEFAULT 'NONE',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_passport ON clients (passport_number);

-- ============================================================
-- TABLE: tariffs
-- ============================================================
CREATE TABLE tariffs (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name          TEXT NOT NULL,
    mfo_user_id   TEXT NOT NULL REFERENCES users(id),
    interest_rate FLOAT NOT NULL,
    min_amount    BIGINT NOT NULL,
    max_amount    BIGINT NOT NULL,
    min_months    INTEGER NOT NULL,
    max_months    INTEGER NOT NULL,
    min_score     INTEGER NOT NULL,
    status        tariff_status NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at   TIMESTAMPTZ,
    approved_by   TEXT REFERENCES users(id)
);

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE products (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    merchant_id          TEXT NOT NULL REFERENCES merchants(id),
    name                 TEXT NOT NULL,
    category             TEXT NOT NULL,
    price                BIGINT NOT NULL,
    description          TEXT DEFAULT '',
    available            BOOLEAN NOT NULL DEFAULT TRUE,
    down_payment_percent INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: applications
-- ============================================================
CREATE TABLE applications (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    merchant_id     TEXT NOT NULL REFERENCES merchants(id),
    client_id       TEXT NOT NULL REFERENCES clients(id),
    product_id      TEXT NOT NULL REFERENCES products(id),
    tariff_id       TEXT NOT NULL REFERENCES tariffs(id),
    months          INTEGER NOT NULL,
    monthly_payment BIGINT NOT NULL,
    total_amount    BIGINT NOT NULL,
    score           INTEGER NOT NULL DEFAULT 0,
    status          application_status NOT NULL DEFAULT 'PENDING',
    approved_amount BIGINT,
    decided_by      TEXT REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at      TIMESTAMPTZ
);

-- ============================================================
-- TABLE: contracts
-- ============================================================
CREATE TABLE contracts (
    id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    application_id     TEXT NOT NULL UNIQUE REFERENCES applications(id),
    total_amount       BIGINT NOT NULL,
    months             INTEGER NOT NULL,
    monthly_payment    BIGINT NOT NULL,
    paid_installments  INTEGER NOT NULL DEFAULT 0,
    status             contract_status NOT NULL DEFAULT 'ACTIVE',
    pdf_path           TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: installments
-- ============================================================
CREATE TABLE installments (
    id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    contract_id         TEXT NOT NULL REFERENCES contracts(id),
    installment_number  INTEGER NOT NULL,
    due_date            DATE NOT NULL,
    amount              BIGINT NOT NULL,
    paid_at             DATE,
    status              installment_status NOT NULL DEFAULT 'UPCOMING'
);

-- ============================================================
-- TABLE: scoring_logs
-- ============================================================
CREATE TABLE scoring_logs (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    application_id  TEXT REFERENCES applications(id),
    client_id       TEXT NOT NULL REFERENCES clients(id),
    income_score    INTEGER NOT NULL,
    credit_score    INTEGER NOT NULL,
    age_score       INTEGER NOT NULL,
    tariff_score    INTEGER NOT NULL,
    total_score     INTEGER NOT NULL,
    outcome         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE audit_logs (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id     TEXT NOT NULL REFERENCES users(id),
    action      TEXT NOT NULL,
    resource    TEXT NOT NULL,
    resource_id TEXT NOT NULL DEFAULT '',
    ip_address  TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add image_url to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
