-- ============================================================
-- Migration 007: Add missing columns (pinfl, face/signature urls)
-- Run this in: Supabase Dashboard → SQL Editor / psql
-- ============================================================

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS pinfl TEXT;

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS face_image_url TEXT,
    ADD COLUMN IF NOT EXISTS signature_url  TEXT;
