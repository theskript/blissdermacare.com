#!/usr/bin/env node
'use strict';

/**
 * Migrate pre-service questionnaire submissions from a Netlify Forms CSV export
 * into the Supabase `pre_service_forms` table.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/migrate-questionnaires.cjs
 *
 * Or add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to a .env file in the
 * project root and run without prefixes.
 *
 * The CSV path defaults to the Downloads location but can be overridden:
 *   CSV_PATH=/path/to/file.csv node scripts/migrate-questionnaires.cjs
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────
const CSV_PATH    = process.env.CSV_PATH
  || path.join(require('os').homedir(), 'Downloads', 'pre-service-questionnaire (1).csv');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE        = 'pre_service_forms';
const BATCH_SIZE   = 25;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n' +
    'Add them to a .env file or pass as environment variables.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── RFC 4180-compliant CSV parser ─────────────────────────────────────────────
// Handles quoted fields, escaped quotes (""), and embedded newlines.
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const row = [];

    // Parse one field at a time
    while (i <= n) {
      let field = '';

      if (i < n && text[i] === '"') {
        // Quoted field
        i++; // skip opening "
        while (i < n) {
          if (text[i] === '"') {
            if (i + 1 < n && text[i + 1] === '"') {
              field += '"'; // escaped quote
              i += 2;
            } else {
              i++; // closing "
              break;
            }
          } else {
            field += text[i++];
          }
        }
      } else {
        // Unquoted field — read until comma or newline
        while (i < n && text[i] !== ',' && text[i] !== '\r' && text[i] !== '\n') {
          field += text[i++];
        }
      }

      row.push(field);

      // Decide what follows the field
      if (i < n && text[i] === ',') {
        i++; // next field in same row
      } else {
        break; // end of row
      }
    }

    // Consume line ending
    if (i < n && text[i] === '\r') i++;
    if (i < n && text[i] === '\n') i++;

    if (row.length > 0) rows.push(row);
  }

  return rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise multi-select fields: empty → [], JSON array → array, plain string → [string] */
function toArray(val) {
  if (!val || !val.trim()) return [];
  const v = val.trim();
  if (v.startsWith('[')) {
    try { return JSON.parse(v); } catch { /* fall through */ }
  }
  return [v];
}

/** Return null for blank strings, otherwise the trimmed value. */
function nullIfEmpty(val) {
  const v = (val || '').trim();
  return v === '' ? null : v;
}

/** Convert a date string to ISO date (YYYY-MM-DD) or null. */
function toDate(val) {
  if (!val || !val.trim()) return null;
  const d = new Date(val.trim());
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at: ${CSV_PATH}`);
    console.error('Set CSV_PATH env var to the correct path.');
    process.exit(1);
  }

  console.log(`Reading CSV: ${CSV_PATH}`);
  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(text);

  if (rows.length < 2) {
    console.error('No data rows found in CSV.');
    process.exit(1);
  }

  const headers  = rows[0];
  const dataRows = rows.slice(1);
  console.log(`Parsed ${dataRows.length} data rows, ${headers.length} columns.\n`);

  // Columns stored as text[] in Supabase
  const ARRAY_FIELDS = new Set(['skin_conditions', 'medical_history', 'skin_prep']);
  // Columns stored as date
  const DATE_FIELDS  = new Set(['appointment_date']);

  const records = dataRows.map((row, rowIdx) => {
    const obj = {};
    headers.forEach((header, colIdx) => {
      const raw = row[colIdx] ?? '';
      if (ARRAY_FIELDS.has(header)) {
        obj[header] = toArray(raw);
      } else if (DATE_FIELDS.has(header)) {
        obj[header] = toDate(raw);
      } else {
        obj[header] = nullIfEmpty(raw);
      }
    });

    // Ensure created_at is a valid ISO timestamp (required for the unique constraint)
    if (!obj.created_at) {
      console.warn(`  Row ${rowIdx + 2}: missing created_at — skipping`);
      return null;
    }

    return obj;
  }).filter(Boolean);

  console.log(`Upserting ${records.length} records into "${TABLE}"…\n`);

  let inserted = 0;
  let failed   = 0;

  for (let start = 0; start < records.length; start += BATCH_SIZE) {
    const batch = records.slice(start, start + BATCH_SIZE);
    const end   = Math.min(start + BATCH_SIZE, records.length);

    const { error } = await supabase
      .from(TABLE)
      .upsert(batch, { onConflict: 'email,created_at', ignoreDuplicates: true });

    if (error) {
      console.error(`  ✗ Rows ${start + 1}–${end}: ${error.message}`);
      failed += batch.length;
    } else {
      console.log(`  ✓ Rows ${start + 1}–${end}`);
      inserted += batch.length;
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`Inserted / updated : ${inserted}`);
  if (failed) console.log(`Failed             : ${failed}`);
  console.log(`─────────────────────────────`);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
