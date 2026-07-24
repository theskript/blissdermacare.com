'use strict';

/**
 * Shared utilities — JWT, Supabase, Twilio SMS, SendGrid email.
 * Includes Airtable-style ↔ snake_case field translation so admin panel
 * pages require no changes when switching databases.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// ── Supabase client ───────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Field mapping: Appointments ───────────────────────────────────────────────
// Admin panel uses Airtable-style names; DB uses snake_case.

const APPT_TO_DB = {
  'Client Name':       'client_name',
  'Client Email':      'client_email',
  'Client Phone':      'client_phone',
  'Date':              'date',
  'Time':              'time',
  'Services':          'services',
  'Status':            'status',
  'Price':             'price',
  'Notes':             'notes',
  'Internal Notes':    'internal_notes',
  'Source':            'source',
  'Discount':          'discount',
  'Referral':          'referral',
  'Groupon Code':      'groupon_code',
  'Stripe Session ID': 'stripe_session_id',
  'Reminder 24h Sent': 'reminder_24h_sent',
  'Reminder 2h Sent':  'reminder_2h_sent',
  'Confirm Phone':     'confirm_phone',
  'Confirm Text':      'confirm_text',
  'Confirm Email':     'confirm_email',
  'Payment Method':    'payment_method',
};
const DB_TO_APPT = Object.fromEntries(Object.entries(APPT_TO_DB).map(([k, v]) => [v, k]));

/** DB row → Airtable-style { id, fields } record for the admin panel API. */
function apptFromDB(row) {
  if (!row) return null;
  const fields = {};
  for (const [col, name] of Object.entries(DB_TO_APPT)) {
    if (row[col] !== undefined) fields[name] = row[col];
  }
  return { id: row.id, fields };
}

/** Airtable-style fields object → DB columns for insert/update. */
function apptToDB(fields) {
  const row = {};
  for (const [name, col] of Object.entries(APPT_TO_DB)) {
    if (fields[name] !== undefined) row[col] = fields[name];
  }
  return row;
}

// ── Field mapping: Staff ──────────────────────────────────────────────────────

const STAFF_TO_DB = {
  'Username':      'username',
  'Name':          'name',
  'Email':         'email',
  'Phone':         'phone',
  'Password Hash': 'password_hash',
  'Role':          'role',
  'Active':        'active',
  'Last Login':    'last_login',
};
const DB_TO_STAFF = Object.fromEntries(Object.entries(STAFF_TO_DB).map(([k, v]) => [v, k]));

function staffFromDB(row) {
  if (!row) return null;
  const fields = {};
  for (const [col, name] of Object.entries(DB_TO_STAFF)) {
    if (row[col] !== undefined) fields[name] = row[col];
  }
  return { id: row.id, fields };
}

function staffToDB(fields) {
  const row = {};
  for (const [name, col] of Object.entries(STAFF_TO_DB)) {
    if (fields[name] !== undefined) row[col] = fields[name];
  }
  return row;
}

// ── Field mapping: Partners ──────────────────────────────────────────────────

const PARTNER_TO_DB = {
  'Name':        'name',
  'Category':    'category',
  'Tagline':     'tagline',
  'Description': 'description',
  'URL':         'url',
  'Logo URL':    'logo_url',
  'Badge Text':  'badge_text',
  'Featured':    'featured',
  'Active':      'active',
  'Sort Order':  'sort_order',
};
const DB_TO_PARTNER = Object.fromEntries(Object.entries(PARTNER_TO_DB).map(([k, v]) => [v, k]));

function partnerFromDB(row) {
  if (!row) return null;
  const fields = {};
  for (const [col, name] of Object.entries(DB_TO_PARTNER)) {
    if (row[col] !== undefined) fields[name] = row[col];
  }
  return { id: row.id, fields, created_at: row.created_at };
}

function partnerToDB(fields) {
  const row = {};
  for (const [name, col] of Object.entries(PARTNER_TO_DB)) {
    if (fields[name] !== undefined) row[col] = fields[name];
  }
  return row;
}

// ── Field mapping: Audit Log ──────────────────────────────────────────────────

function auditFromDB(row) {
  if (!row) return null;
  return {
    id: row.id,
    fields: {
      'Action':     row.action,
      'Username':   row.username,
      'Role':       row.role,
      'Details':    row.details,
      'Target ID':  row.target_id,
      'IP Address': row.ip_address,
      'Timestamp':  row.created_at, // maps created_at → Timestamp for frontend
    },
  };
}

// ── JWT ───────────────────────────────────────────────────────────────────────

function jwtSign(payload, secret, expiresInSeconds = 86400) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + expiresInSeconds })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function jwtVerify(token, secret) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
    throw new Error('Invalid signature');
  }
  const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return data;
}

function requireAuth(event, requiredRole = null) {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw { statusCode: 401, message: 'Authentication required' };
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw { statusCode: 500, message: 'Server configuration error' };
  const decoded = jwtVerify(token, secret);
  if (requiredRole && decoded.role !== requiredRole) {
    throw { statusCode: 403, message: 'Insufficient permissions' };
  }
  return decoded;
}

// ── Twilio SMS ────────────────────────────────────────────────────────────────

async function sendSMS(to, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_FROM;
  if (!accountSid || !authToken || !from) {
    console.warn('[SMS] Twilio not configured — skipping SMS to', to);
    return null;
  }
  const digits = String(to).replace(/\D/g, '');
  const phone  = digits.startsWith('1') ? `+${digits}` : `+1${digits}`;

  const params = new URLSearchParams({ To: phone, From: from, Body: body });
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type':  'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error(`[SMS] Twilio error → ${phone}:`, JSON.stringify(data));
      return { ok: false, error: data.message || 'Unknown Twilio error', status: data.status };
    }
    return { ok: true, sid: data.sid, status: data.status };
  } catch (err) {
    console.error('[SMS] Twilio unexpected error:', err.message);
    return { ok: false, error: err.message };
  }
}

// ── SendGrid Email ────────────────────────────────────────────────────────────

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[Email] SendGrid not configured — skipping email to', to);
    return null;
  }
  const toArr = (Array.isArray(to) ? to : [to]).filter(Boolean);
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: toArr.map(e => ({ email: e })) }],
      from: { email: 'noreply@blissdermacare.com', name: 'Bliss Dermacare' },
      reply_to: { email: 'info@blissdermacare.com', name: 'Bliss Dermacare' },
      subject,
      content: [
        ...(text ? [{ type: 'text/plain', value: text }] : []),
        ...(html ? [{ type: 'text/html',  value: html }] : []),
      ],
    }),
  });
  if (!res.ok) { console.error('[Email] SendGrid error:', await res.text()); return null; }
  return true;
}

// ── Audit logging ─────────────────────────────────────────────────────────────

async function logAudit({ action, username = '', role = '', details = '', targetId = '', ip = '' }) {
  try {
    const { error } = await getSupabase().from('audit_log').insert({
      action,
      username,
      role,
      details: String(details).substring(0, 1000),
      target_id: targetId,
      ip_address: ip,
    });
    if (error) console.error('[audit] Supabase insert error:', error.message);
  } catch (err) {
    console.error('[audit] Failed to write log:', err.message);
  }
}

function getClientIP(event) {
  return (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || event.headers['client-ip']
    || 'unknown';
}

// ── Date / time helpers ───────────────────────────────────────────────────────

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(raw) {
  if (!raw) return '';
  return raw.trim().replace(/([ap]m)$/i, m => ' ' + m.toUpperCase());
}

function timeToMinutes(timeStr) {
  if (!timeStr) return -1;
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return -1;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function etOffsetHours(date = new Date()) {
  const month = date.getUTCMonth() + 1;
  return month >= 3 && month <= 11 ? -4 : -5;
}

// ── Notification settings ──────────────────────────────────────────────────

async function getNotificationSettings() {
  const envEmails = (process.env.OWNER_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean);
  const envPhones = (process.env.OWNER_PHONE || '').split(',').map(p => p.trim()).filter(Boolean);

  let staffEmails = [];
  let staffPhones = [];
  let settingsMap = {};

  try {
    const [staffResult, settingsResult] = await Promise.all([
      getSupabase().from('staff').select('email,phone').eq('role', 'owner').eq('active', true),
      getSupabase().from('notification_settings').select('key,value'),
    ]);
    staffEmails = (staffResult.data || []).map(o => o.email).filter(Boolean);
    staffPhones = (staffResult.data || []).map(o => o.phone).filter(Boolean);
    for (const { key, value } of (settingsResult.data || [])) settingsMap[key] = value;
  } catch (err) {
    console.warn('[getNotificationSettings] DB error, using env fallback:', err.message);
  }

  // Additional recipients from notification_settings (merged with staff owners)
  const extraEmails = (settingsMap.owner_emails || '').split(',').map(e => e.trim()).filter(Boolean);
  const extraPhones = (settingsMap.owner_phones || '').split(',').map(p => p.trim()).filter(Boolean);
  const mergedEmails = [...new Set([...staffEmails, ...extraEmails])];
  const mergedPhones = [...new Set([...staffPhones, ...extraPhones])];

  return {
    ownerEmails:  mergedEmails.length  ? mergedEmails  : envEmails,
    ownerPhones:  mergedPhones.length  ? mergedPhones  : envPhones,
    notifyOwnerOnNewBooking:    settingsMap.notify_owner_on_new_booking    !== 'false',
    notifyOwnerOnStripePayment: settingsMap.notify_owner_on_stripe_payment !== 'false',
    notifyClientSmsOnBooking:   settingsMap.notify_client_sms_on_booking   !== 'false',
    notifyClientEmailOnBooking: settingsMap.notify_client_email_on_booking !== 'false',
    reminderStatuses: (settingsMap.reminder_statuses || 'Confirmed,Pending Payment').split(',').map(x => x.trim()).filter(Boolean),
    reminder24hEnabled: settingsMap.reminder_24h_enabled !== 'false',
    reminder2hEnabled:  settingsMap.reminder_2h_enabled  !== 'false',
  };
}

module.exports = {
  getSupabase,
  apptFromDB, apptToDB,
  staffFromDB, staffToDB,
  partnerFromDB, partnerToDB,
  auditFromDB,
  jwtSign, jwtVerify, requireAuth,
  sendSMS, sendEmail,
  logAudit, getClientIP,
  toDateStr, formatTime, timeToMinutes, etOffsetHours,
  getNotificationSettings,
};
