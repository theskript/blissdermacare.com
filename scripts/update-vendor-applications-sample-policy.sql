-- ============================================================
-- Migration: vendor applications — sample-size policy, drop booth needs
-- Run after create-vendor-applications-table.sql (safe to re-run)
-- ============================================================

ALTER TABLE vendor_applications
  ADD COLUMN IF NOT EXISTS agreed_sample_only BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE vendor_applications
  DROP COLUMN IF EXISTS needs_electricity,
  DROP COLUMN IF EXISTS needs_table;
