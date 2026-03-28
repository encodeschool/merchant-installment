-- ============================================================
-- Migration 003: Extended fields for multi-product wizard
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- CLIENTS: identity fields added by new wizard Step 2
ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'EMPLOYED',
    ADD COLUMN IF NOT EXISTS birth_date      TEXT;

-- APPLICATIONS: multi-product + fraud + override fields
ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS application_items JSONB,
    ADD COLUMN IF NOT EXISTS fraud_gate        TEXT NOT NULL DEFAULT 'PASS',
    ADD COLUMN IF NOT EXISTS override_reason   TEXT;

-- TARIFFS: backfill weight columns for rows that were created before
-- migration 002 ran, or where Supabase stored 0 instead of the default.
UPDATE tariffs
SET
    w_affordability  = 0.40,
    w_credit_history = 0.30,
    w_behavioral     = 0.20,
    w_demographic    = 0.10
WHERE
    w_affordability IS NULL
    OR w_credit_history IS NULL
    OR (w_affordability + w_credit_history + w_behavioral + w_demographic) = 0;
