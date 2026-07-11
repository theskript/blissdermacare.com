'use strict';

/**
 * Shared utilities for Bliss Dermacare admin functions.
 * Covers: JWT (sign/verify), Airtable REST, Twilio SMS, SendGrid email.
 */

const crypto = require('crypto');

// ── JWT ──────────────────────────────────────────────────────────────────────

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

// ── Auth middleware ───────────────────────────────────────────────────────────

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

// ── Airtable ──────────────────────────────────────────────────────────────────

function airtableBase() {
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!baseId) throw new Error('AIRTABLE_BASE_ID is not configured');
  return `https://api.airtable.com/v0/${baseId}`;
}

function airtableHeaders() {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error('AIRTABLE_API_KEY is not configured');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function airtableList(table, params = {}) {
  const url = new URL(`${airtableBase()}/${encodeURIComponent(table)}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), { headers: airtableHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable list ${res.status}: ${err}`);
  }
  return res.json();
}

async function airtableCreate(table, fields) {
  const res = await fetch(`${airtableBase()}/${encodeURIComponent(table)}`, {
    method: 'POST',
    headers: airtableHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable create ${res.status}: ${err}`);
  }
  return res.json();
}

async function airtablePatch(table, recordId, fields) {
  const res = await fetch(`${airtableBase()}/${encodeURIComponent(table)}/${recordId}`, {
    method: 'PATCH',
    headers: airtableHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable patch ${res.status}: ${err}`);
  }
  return res.json();
}

async function airtableDelete(table, recordId) {
  const res = await fetch(`${airtableBase()}/${encodeURIComponent(table)}/${recordId}`, {
    method: 'DELETE',
    headers: airtableHeaders(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable delete ${res.status}: ${err}`);
  }
  return res.json();
}

/** Fetches all records handling Airtable pagination automatically. */
async function airtableListAll(table, params = {}) {
  let records = [];
  let offset;
  do {
    const p = { ...params };
    if (offset) p.offset = offset;
    const data = await airtableList(table, p);
    records = records.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return records;
}

// ── Twilio SMS ────────────────────────────────────────────────────────────────

async function sendSMS(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn('[SMS] Twilio not configured — skipping SMS to', to);
    return null;
  }
  // Normalize to E.164
  const digits = String(to).replace(/\D/g, '');
  const phone = digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: phone, From: TWILIO_FROM_NUMBER, Body: body }).toString(),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`[SMS] Twilio error → ${phone}:`, err);
    return null;
  }
  return res.json();
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
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: toArr.map(e => ({ email: e })) }],
      from: { email: 'noreply@blissdermacare.com', name: 'Bliss Dermacare' },
      reply_to: { email: 'info@blissdermacare.com', name: 'Bliss Dermacare' },
      subject,
      content: [
        ...(html ? [{ type: 'text/html', value: html }] : []),
        ...(text ? [{ type: 'text/plain', value: text }] : []),
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[Email] SendGrid error:', err);
    return null;
  }
  return true;
}

// ── Date/time helpers ─────────────────────────────────────────────────────────

function toDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Convert slot value like "12:30pm" → display string "12:30 PM".
 */
function formatTime(raw) {
  if (!raw) return '';
  return raw.trim().replace(/([ap]m)$/i, m => ' ' + m.toUpperCase());
}

/**
 * Parse display time "12:30 PM" → minutes since midnight.
 */
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

/** Current Eastern Time offset (simplified: EDT = UTC-4 Mar–Nov, EST = UTC-5 otherwise). */
function etOffsetHours(date = new Date()) {
  const month = date.getUTCMonth() + 1;
  return month >= 3 && month <= 11 ? -4 : -5;
}

module.exports = {
  jwtSign,
  jwtVerify,
  requireAuth,
  airtableList,
  airtableCreate,
  airtablePatch,
  airtableDelete,
  airtableListAll,
  sendSMS,
  sendEmail,
  toDateStr,
  formatTime,
  timeToMinutes,
  etOffsetHours,
};
