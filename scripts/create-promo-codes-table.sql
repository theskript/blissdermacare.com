-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS promo_codes (
  id           uuid   DEFAULT gen_random_uuid() PRIMARY KEY,
  code         text   UNIQUE NOT NULL,                          -- stored uppercase
  type         text   NOT NULL CHECK (type IN ('percent','fixed')),
  value        int    NOT NULL,                                  -- percent 1–100 or cents
  max_uses     int,                                              -- null = unlimited
  uses         int    DEFAULT 0,
  expires_at   timestamptz,                                      -- null = no expiry
  min_subtotal int,                                              -- in cents, null = no min
  active       boolean DEFAULT true,
  description  text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_codes_code_idx ON promo_codes(code);
