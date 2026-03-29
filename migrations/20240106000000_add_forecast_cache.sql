-- ============================================================
-- Migration 006: Add forecast_cache table
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS forecast_cache (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mfo_user_id UUID NOT NULL,
    result      JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forecast_cache_mfo_expires
    ON forecast_cache (mfo_user_id, expires_at DESC);
