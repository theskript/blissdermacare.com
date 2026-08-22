-- Add featured flag so admin can control which services appear on the home page spotlight
ALTER TABLE services ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
