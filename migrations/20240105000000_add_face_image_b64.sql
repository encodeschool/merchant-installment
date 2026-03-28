-- ============================================================
-- Migration 005: Add face_image_b64 column to applications
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE applications
    ADD COLUMN IF NOT EXISTS face_image_b64 TEXT;
