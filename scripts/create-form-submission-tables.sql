-- ============================================================
-- Migration: Add form submission tables + PSF time fields
-- Run in your Supabase SQL editor
-- ============================================================

-- 1. Add new fields to pre_service_forms
ALTER TABLE pre_service_forms
  ADD COLUMN IF NOT EXISTS appointment_time TEXT,
  ADD COLUMN IF NOT EXISTS service_requested TEXT;

-- 2. Demo model applications
CREATE TABLE IF NOT EXISTS demo_model_submissions (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT         NOT NULL,
  email         TEXT         NOT NULL,
  phone         TEXT         NOT NULL,
  skin_type     TEXT,
  skin_concern  TEXT,
  notes         TEXT,
  photo_consent TEXT,
  ip            TEXT,
  user_agent    TEXT,
  referrer      TEXT,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS demo_model_submissions_email_idx   ON demo_model_submissions (email);
CREATE INDEX IF NOT EXISTS demo_model_submissions_created_idx ON demo_model_submissions (created_at DESC);

-- 3. Career applications
CREATE TABLE IF NOT EXISTS career_submissions (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT        NOT NULL,
  email          TEXT        NOT NULL,
  phone          TEXT        NOT NULL,
  role           TEXT        NOT NULL,
  license_number TEXT,
  experience     TEXT,
  why_bliss      TEXT,
  portfolio_url  TEXT,
  availability   TEXT,
  ip             TEXT,
  user_agent     TEXT,
  referrer       TEXT,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS career_submissions_email_idx   ON career_submissions (email);
CREATE INDEX IF NOT EXISTS career_submissions_role_idx    ON career_submissions (role);
CREATE INDEX IF NOT EXISTS career_submissions_created_idx ON career_submissions (created_at DESC);

-- 4. Consultation requests
CREATE TABLE IF NOT EXISTS consultation_submissions (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name               TEXT        NOT NULL,
  email              TEXT        NOT NULL,
  phone              TEXT        NOT NULL,
  skin_type          TEXT,
  concerns           TEXT[],
  current_routine    TEXT,
  goals              TEXT,
  contact_preference TEXT,
  ip                 TEXT,
  user_agent         TEXT,
  referrer           TEXT,
  read_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS consultation_submissions_email_idx   ON consultation_submissions (email);
CREATE INDEX IF NOT EXISTS consultation_submissions_created_idx ON consultation_submissions (created_at DESC);

-- Enable Row Level Security (allow service role full access, no public access)
ALTER TABLE demo_model_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_submissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_submissions  ENABLE ROW LEVEL SECURITY;
