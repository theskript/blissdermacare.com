-- Run this in the Supabase SQL Editor before running the migration script.

CREATE TABLE IF NOT EXISTS pre_service_forms (
  id                            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                          text,
  appointment_date              date,
  phone                         text,
  email                         text,
  age_category                  text,
  guardian_name                 text,
  guardian_relationship         text,
  guardian_phone                text,
  guardian_email                text,
  guardian_id_type              text,
  guardian_presence_commitment  text,
  guardian_medical_accuracy     text,
  age_confirmation_adult        text,
  skin_conditions               text[],
  allergies                     text,
  medical_history               text[],
  medications                   text,
  recent_treatments             text,
  alcohol_consumption           text,
  skin_prep                     text[],
  hygiene_acknowledgment        text,
  appointment_acknowledgment    text,
  post_care_acknowledgment      text,
  refuse_service_acknowledgment text,
  refund_policy_acknowledgment  text,
  health_agreement              text,
  ip                            text,
  user_agent                    text,
  referrer                      text,
  created_at                    timestamptz,
  read_at                       timestamptz,

  UNIQUE (email, created_at)
);

CREATE INDEX IF NOT EXISTS idx_psf_email ON pre_service_forms (email);
CREATE INDEX IF NOT EXISTS idx_psf_phone ON pre_service_forms (phone);
CREATE INDEX IF NOT EXISTS idx_psf_appointment_date ON pre_service_forms (appointment_date);
CREATE INDEX IF NOT EXISTS idx_psf_read_at          ON pre_service_forms (read_at);

-- If the table already exists, run this migration to add the read_at column:
-- ALTER TABLE pre_service_forms ADD COLUMN IF NOT EXISTS read_at timestamptz;
