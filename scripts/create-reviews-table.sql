-- Run in the Supabase SQL editor before enabling reviews.
CREATE TABLE IF NOT EXISTS reviews (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name    TEXT        NOT NULL,
  email          TEXT        NOT NULL,
  service_name   TEXT        NOT NULL,
  rating         SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text    TEXT        NOT NULL CHECK (char_length(review_text) BETWEEN 20 AND 1200),
  consent        BOOLEAN     NOT NULL DEFAULT FALSE,
  published      BOOLEAN     NOT NULL DEFAULT FALSE,
  featured       BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  ip             TEXT,
  user_agent     TEXT,
  referrer       TEXT,
  moderated_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_published_idx ON reviews (published, featured, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_created_idx ON reviews (created_at DESC);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;