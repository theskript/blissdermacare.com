'use strict';

/**
 * One-time migration: import pre-service questionnaire CSV into Supabase.
 * Usage: node scripts/migrate-psf.cjs [path-to-csv]
 *
 * Requires the pre_service_forms table to exist first.
 * Run scripts/create-pre-service-forms-table.sql in the Supabase SQL Editor if it doesn't.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const { parse }        = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────

const CSV_PATH = process.argv[2] || path.join(
  require('os').homedir(),
  'Downloads/pre-service-questionnaire (1).csv'
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a CSV cell that may be a JSON array or a plain string */
function toArray(val) {
  if (!val || !val.trim()) return null;
  const trimmed = val.trim();
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch {}
  }
  return [trimmed];
}

function nullIfEmpty(val) {
  const t = (val || '').trim();
  return t === '' ? null : t;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Verify table exists
  const { error: tableCheck } = await supabase.from('pre_service_forms').select('id').limit(1);
  if (tableCheck?.code === '42P01') {
    console.error('\n❌ Table "pre_service_forms" does not exist.');
    console.error('   Run scripts/create-pre-service-forms-table.sql in the Supabase SQL Editor first.\n');
    process.exit(1);
  }

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`\n❌ CSV not found: ${CSV_PATH}`);
    console.error('   Usage: node scripts/migrate-psf.cjs /path/to/file.csv\n');
    process.exit(1);
  }

  const csvText = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parse(csvText, {
    columns:            true,
    skip_empty_lines:   true,
    relax_column_count: true,
    trim:               false,
  });

  console.log(`\nFound ${rows.length} rows in CSV. Importing…\n`);

  let inserted = 0;
  let skipped  = 0;

  for (const r of rows) {
    const record = {
      name:                         nullIfEmpty(r.name),
      appointment_date:             nullIfEmpty(r.appointment_date),
      phone:                        nullIfEmpty(r.phone),
      email:                        nullIfEmpty(r.email)?.toLowerCase(),
      age_category:                 nullIfEmpty(r.age_category),
      guardian_name:                nullIfEmpty(r.guardian_name),
      guardian_relationship:        nullIfEmpty(r.guardian_relationship),
      guardian_phone:               nullIfEmpty(r.guardian_phone),
      guardian_email:               nullIfEmpty(r.guardian_email),
      guardian_id_type:             nullIfEmpty(r.guardian_id_type),
      guardian_presence_commitment: nullIfEmpty(r.guardian_presence_commitment),
      guardian_medical_accuracy:    nullIfEmpty(r.guardian_medical_accuracy),
      age_confirmation_adult:       nullIfEmpty(r.age_confirmation_adult),
      skin_conditions:              toArray(r.skin_conditions),
      allergies:                    nullIfEmpty(r.allergies),
      medical_history:              toArray(r.medical_history),
      medications:                  nullIfEmpty(r.medications),
      recent_treatments:            nullIfEmpty(r.recent_treatments),
      alcohol_consumption:          nullIfEmpty(r.alcohol_consumption),
      skin_prep:                    toArray(r.skin_prep),
      hygiene_acknowledgment:       nullIfEmpty(r.hygiene_acknowledgment),
      appointment_acknowledgment:   nullIfEmpty(r.appointment_acknowledgment),
      post_care_acknowledgment:     nullIfEmpty(r.post_care_acknowledgment),
      refuse_service_acknowledgment:nullIfEmpty(r.refuse_service_acknowledgment),
      refund_policy_acknowledgment: nullIfEmpty(r.refund_policy_acknowledgment),
      health_agreement:             nullIfEmpty(r.health_agreement),
      ip:                           nullIfEmpty(r.ip),
      user_agent:                   nullIfEmpty(r.user_agent),
      referrer:                     nullIfEmpty(r.referrer),
      created_at:                   nullIfEmpty(r.created_at),
    };

    const { error } = await supabase
      .from('pre_service_forms')
      .upsert(record, { onConflict: 'email,created_at', ignoreDuplicates: true });

    if (error) {
      console.warn(`  ⚠  Skipped ${record.name} <${record.email}>: ${error.message}`);
      skipped++;
    } else {
      console.log(`  ✓  ${record.name} <${record.email}>`);
      inserted++;
    }
  }

  console.log(`\n✅ Done — ${inserted} imported, ${skipped} skipped.\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
