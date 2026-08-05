-- Run in Supabase SQL editor

-- Marketing campaigns
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text    NOT NULL,
  subject         text,
  body_html       text,
  body_text       text,
  body_sms        text,
  channels        text[]  DEFAULT ARRAY['email'],
  segment_type    text    NOT NULL DEFAULT 'all',
  status          text    NOT NULL DEFAULT 'draft',
  sent_at         timestamptz,
  recipient_count int     DEFAULT 0,
  sent_count      int     DEFAULT 0,
  created_by      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Unsubscribes (soft-flag, never deleted)
CREATE TABLE IF NOT EXISTS marketing_unsubscribes (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text,
  phone       text,
  unsub_email boolean DEFAULT true,
  unsub_sms   boolean DEFAULT false,
  source      text    DEFAULT 'manual',  -- 'link', 'manual', 'reply_stop'
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS mkt_unsub_email_idx ON marketing_unsubscribes(email);

-- Page builder (jsonb blocks)
CREATE TABLE IF NOT EXISTS site_pages (
  id               uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text    NOT NULL,
  slug             text    UNIQUE NOT NULL,
  meta_description text,
  blocks           jsonb   DEFAULT '[]'::jsonb,
  status           text    NOT NULL DEFAULT 'draft',  -- draft | published
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_pages_slug_idx   ON site_pages(slug);
CREATE INDEX IF NOT EXISTS site_pages_status_idx ON site_pages(status);
