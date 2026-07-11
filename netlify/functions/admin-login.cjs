'use strict';

/**
 * POST /.netlify/functions/admin-login
 * Body: { username, password }
 *
 * Auth priority:
 *   1. Look up username in Airtable Staff table (bcrypt compare)
 *   2. Fall back to ADMIN_PASSWORD env var for the owner bootstrap account
 *
 * Returns: { token, role, name, expiresIn }
 */

const bcrypt = require('bcryptjs');
const { jwtSign, airtableList, airtablePatch, logAudit, getClientIP } = require('./_utils.cjs');

const STAFF_TABLE = () => process.env.AIRTABLE_STAFF_TABLE || 'Staff';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { username = '', password = '' } = body;
  const secret = process.env.ADMIN_JWT_SECRET;
  const ip = getClientIP(event);

  if (!secret) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server not configured: ADMIN_JWT_SECRET missing' }) };
  }

  const deny = async () => {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid username or password' }) };
  };

  // 1. Airtable Staff table lookup
  try {
    const data = await airtableList(STAFF_TABLE(), {
      filterByFormula: `LOWER({Username})="${username.toLowerCase().replace(/"/g, '')}"`,
      maxRecords: 1,
    });

    if (data.records && data.records.length > 0) {
      const rec = data.records[0];
      const f = rec.fields;

      if (!f['Active']) {
        logAudit({ action: 'Failed Login', username, role: f['Role'] || '', details: 'Account is deactivated', ip });
        return deny();
      }

      const match = await bcrypt.compare(password, f['Password Hash'] || '');
      if (!match) {
        logAudit({ action: 'Failed Login', username, role: f['Role'] || '', details: 'Wrong password', ip });
        return deny();
      }

      const role = f['Role'] || 'staff';
      const name = f['Name'] || username;

      airtablePatch(STAFF_TABLE(), rec.id, { 'Last Login': new Date().toISOString() }).catch(() => {});
      logAudit({ action: 'Login', username, role, details: `Successful login — ${name}`, ip });

      const expiresIn = role === 'owner' ? 86400 : 28800;
      const token = jwtSign({ role, username, name }, secret, expiresIn);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ token, role, name, expiresIn }) };
    }
  } catch (err) {
    console.warn('[login] Airtable staff lookup unavailable, falling back to env var:', err.message);
  }

  // 2. Owner env var bootstrap fallback
  if (!process.env.ADMIN_PASSWORD) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server not configured: no Staff table or ADMIN_PASSWORD set' }) };
  }

  if (username === 'owner' && password === process.env.ADMIN_PASSWORD) {
    logAudit({ action: 'Login', username: 'owner', role: 'owner', details: 'Login via ADMIN_PASSWORD env var (bootstrap)', ip });
    const token = jwtSign({ role: 'owner', username: 'owner', name: 'Owner' }, secret, 86400);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ token, role: 'owner', name: 'Owner', expiresIn: 86400 }) };
  }

  logAudit({ action: 'Failed Login', username, role: '', details: 'Username not found in Staff table or env var', ip });
  return deny();
};
