'use strict';

/**
 * GET  /.netlify/functions/unsubscribe?email=X&token=Y — one-click unsubscribe
 * POST /.netlify/functions/unsubscribe — add/update unsubscribe record (admin)
 */

const crypto = require('crypto');
const { getSupabase, requireAuth } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function unsubToken(email) {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'bliss-secret';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase()).digest('hex').slice(0, 16);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const sb = getSupabase();

  // ── GET — one-click link unsubscribe ─────────────────────────────────────
  if (event.httpMethod === 'GET') {
    const { email, token } = event.queryStringParameters || {};
    if (!email || !token) {
      return { statusCode: 400, headers: { 'Content-Type': 'text/html' }, body: '<p>Invalid unsubscribe link.</p>' };
    }
    const expected = unsubToken(decodeURIComponent(email));
    if (token !== expected) {
      return { statusCode: 400, headers: { 'Content-Type': 'text/html' }, body: '<p>Invalid or expired unsubscribe link.</p>' };
    }
    const clean = decodeURIComponent(email).toLowerCase().trim();
    await sb.from('marketing_unsubscribes').upsert(
      { email: clean, unsub_email: true, source: 'link', updated_at: new Date().toISOString() },
      { onConflict: 'email' }
    );
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unsubscribed</title>
        <style>body{font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#333}
        h1{color:#1a1a1a}a{color:#7c3aed}</style></head><body>
        <h1>You've been unsubscribed</h1>
        <p>You won't receive promotional emails from Bliss Dermacare anymore.</p>
        <p><a href="/">Visit our website</a></p></body></html>`,
    };
  }

  // ── POST — admin: add or update unsubscribe ───────────────────────────────
  if (event.httpMethod === 'POST') {
    let user;
    try { user = requireAuth(event); } catch (e: any) {
      return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
    }
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const { email, phone, unsub_email = true, unsub_sms = false, notes, resubscribe = false } = body;
    if (!email && !phone) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'email or phone required' }) };
    void user;
    const record: Record<string, any> = {
      unsub_email: resubscribe ? false : unsub_email,
      unsub_sms:   resubscribe ? false : unsub_sms,
      source:      resubscribe ? 're-subscribe' : 'manual',
      notes,
      updated_at:  new Date().toISOString(),
    };
    if (email) record.email = email.toLowerCase().trim();
    if (phone) record.phone = phone;
    await sb.from('marketing_unsubscribes').upsert(record, { onConflict: 'email' });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
