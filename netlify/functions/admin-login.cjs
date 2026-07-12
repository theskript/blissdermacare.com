'use strict';

const bcrypt = require('bcryptjs');
const { jwtSign, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

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

  // 1. Supabase staff table lookup
  try {
    const { data: staffRow } = await getSupabase()
      .from('staff')
      .select('*')
      .ilike('username', username.replace(/'/g, ''))
      .maybeSingle();

    if (staffRow) {
      if (!staffRow.active) {
        logAudit({ action: 'Failed Login', username, role: staffRow.role || '', details: 'Account is deactivated', ip });
        return deny();
      }
      const match = await bcrypt.compare(password, staffRow.password_hash || '');
      if (!match) {
        logAudit({ action: 'Failed Login', username, role: staffRow.role || '', details: 'Wrong password', ip });
        return deny();
      }
      const role = staffRow.role || 'staff';
      const name = staffRow.name || username;

      // Update last_login (non-blocking)
      getSupabase().from('staff').update({ last_login: new Date().toISOString() }).eq('id', staffRow.id).then(() => {});
      logAudit({ action: 'Login', username, role, details: `Successful login — ${name}`, ip });

      const expiresIn = role === 'owner' ? 86400 : 28800;
      const token = jwtSign({ role, username, name }, secret, expiresIn);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ token, role, name, expiresIn }) };
    }
  } catch (err) {
    console.warn('[login] Supabase staff lookup failed, falling back to env var:', err.message);
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

  logAudit({ action: 'Failed Login', username, role: '', details: 'Username not found in staff table or env var', ip });
  return deny();
};
