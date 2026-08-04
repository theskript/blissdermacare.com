-- Add pending_payment column to appointments table
-- Run this once in the Supabase SQL editor

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS pending_payment BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing records that had Status = 'Pending Payment':
-- Set the flag, then change their status to 'Pending Confirmation'
UPDATE appointments SET pending_payment = true  WHERE status = 'Pending Payment';
UPDATE appointments SET status = 'Pending Confirmation' WHERE status = 'Pending Payment';
