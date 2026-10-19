-- ============================================================
-- Migration: Vendor applications (Health & Financial Wellness Event)
-- Run in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_applications (
  id                       UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  event_slug               TEXT         NOT NULL DEFAULT 'health-financial-wellness-2026',
  business_name            TEXT         NOT NULL,
  contact_name             TEXT         NOT NULL,
  email                    TEXT         NOT NULL,
  phone                    TEXT         NOT NULL,
  website                  TEXT,
  category                 TEXT         NOT NULL,
  description              TEXT         NOT NULL,
  license_info             TEXT,
  special_requests         TEXT,
  agreed_terms_at          TIMESTAMPTZ  NOT NULL,
  agreed_sample_only       BOOLEAN      NOT NULL DEFAULT FALSE,

  -- review workflow: pending | approved | declined | withdrawn
  status                   TEXT         NOT NULL DEFAULT 'pending',
  admin_notes              TEXT,

  -- payment: unpaid | paid | refunded
  payment_status           TEXT         NOT NULL DEFAULT 'unpaid',
  amount_paid              INTEGER,
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,
  paid_at                  TIMESTAMPTZ,

  ip                       TEXT,
  user_agent               TEXT,
  referrer                 TEXT,
  read_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS vendor_applications_event_email_idx ON vendor_applications (event_slug, email);
CREATE INDEX IF NOT EXISTS vendor_applications_session_idx     ON vendor_applications (stripe_session_id);
CREATE INDEX IF NOT EXISTS vendor_applications_created_idx     ON vendor_applications (created_at DESC);

-- Service role only; no public access
ALTER TABLE vendor_applications ENABLE ROW LEVEL SECURITY;
