'use strict';

/**
 * One-time backfill: for every existing pre_service_forms row, either:
 *   - backfill missing time/services on a matching appointment (email + date), or
 *   - create a Pending Confirmation stub appointment if none exists.
 *
 * Usage:
 *   node scripts/backfill-appointments-from-psf.cjs [--dry-run]
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  console.log(DRY_RUN ? '--- DRY RUN (no writes) ---\n' : '--- LIVE RUN ---\n');

  // Fetch all PSF rows ordered oldest-first so newer submissions win on conflicts
  const { data: forms, error: fetchErr } = await sb
    .from('pre_service_forms')
    .select('id, name, email, phone, appointment_date, appointment_time, service_requested')
    .not('email', 'is', null)
    .not('appointment_date', 'is', null)
    .order('created_at', { ascending: true });

  if (fetchErr) { console.error('Failed to fetch PSFs:', fetchErr.message); process.exit(1); }
  console.log(`Found ${forms.length} PSF records with email + appointment_date.\n`);

  let backfilled = 0;
  let created    = 0;
  let skipped    = 0;

  for (const form of forms) {
    const email = (form.email || '').toLowerCase().trim();
    const date  = form.appointment_date;

    // Find the most-recently-created appointment for this email + date
    const { data: existing, error: lookupErr } = await sb
      .from('appointments')
      .select('id, time, services')
      .eq('client_email', email)
      .eq('date', date)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      console.warn(`  [WARN] lookup failed for ${email} / ${date}: ${lookupErr.message}`);
      continue;
    }

    if (existing) {
      const patch = {};
      if (!existing.time     && form.appointment_time)  patch.time     = form.appointment_time;
      if (!existing.services && form.service_requested) patch.services = form.service_requested;

      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      console.log(`  [BACKFILL] ${email} / ${date} — patching:`, patch);
      if (!DRY_RUN) {
        const { error: patchErr } = await sb.from('appointments').update(patch).eq('id', existing.id);
        if (patchErr) console.warn(`    [WARN] patch failed: ${patchErr.message}`);
        else backfilled++;
      } else {
        backfilled++;
      }
    } else {
      console.log(`  [CREATE]   ${email} / ${date} — no appointment found, creating stub`);
      if (!DRY_RUN) {
        const { error: insertErr } = await sb.from('appointments').insert({
          client_name:  form.name,
          client_email: email,
          client_phone: form.phone || null,
          date,
          time:     form.appointment_time  || null,
          services: form.service_requested || null,
          status:   'Pending Confirmation',
          source:   'Pre-Service Form',
        });
        if (insertErr) console.warn(`    [WARN] insert failed: ${insertErr.message}`);
        else created++;
      } else {
        created++;
      }
    }
  }

  console.log(`\nDone.`);
  console.log(`  Backfilled : ${backfilled}`);
  console.log(`  Created    : ${created}`);
  console.log(`  Skipped    : ${skipped} (appointment already had time + services)`);
  if (DRY_RUN) console.log('\nRe-run without --dry-run to apply changes.');
}

main().catch(err => { console.error(err); process.exit(1); });
