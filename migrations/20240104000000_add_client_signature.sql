-- ============================================================
-- Migration 004: Add client_signature column to applications
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS client_signature TEXT;
