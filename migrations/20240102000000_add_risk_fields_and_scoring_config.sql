-- ============================================================
-- Migration 002: New client risk fields + tariff scoring config
--                + scoring_logs extended columns
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- CLIENTS: new risk fields
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS open_loans    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS overdue_days  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_bankruptcy BOOLEAN NOT NULL DEFAULT FALSE;

-- TARIFFS: scoring config fields
ALTER TABLE tariffs
    ADD COLUMN IF NOT EXISTS w_affordability   FLOAT NOT NULL DEFAULT 0.4,
    ADD COLUMN IF NOT EXISTS w_credit_history  FLOAT NOT NULL DEFAULT 0.3,
    ADD COLUMN IF NOT EXISTS w_behavioral      FLOAT NOT NULL DEFAULT 0.2,
    ADD COLUMN IF NOT EXISTS w_demographic     FLOAT NOT NULL DEFAULT 0.1,
    ADD COLUMN IF NOT EXISTS partial_threshold INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS partial_ratio     FLOAT NOT NULL DEFAULT 0.7,
    ADD COLUMN IF NOT EXISTS hard_dti_min      FLOAT NOT NULL DEFAULT 1.5,
    ADD COLUMN IF NOT EXISTS max_open_loans    INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS max_overdue_days  INTEGER NOT NULL DEFAULT 90,
    ADD COLUMN IF NOT EXISTS bankruptcy_reject BOOLEAN NOT NULL DEFAULT TRUE;

-- SCORING_LOGS: store factor breakdown and weights snapshot
ALTER TABLE scoring_logs
    ADD COLUMN IF NOT EXISTS weights_snapshot   JSONB,
    ADD COLUMN IF NOT EXISTS hard_reject        BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS hard_reject_reason VARCHAR,
    ADD COLUMN IF NOT EXISTS reason_codes       JSONB;
