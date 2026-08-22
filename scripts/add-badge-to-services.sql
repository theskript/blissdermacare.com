-- Admin-controlled badge text shown on service cards (e.g. "NEW", "TRENDING")
ALTER TABLE services ADD COLUMN IF NOT EXISTS badge varchar(40) DEFAULT NULL;
