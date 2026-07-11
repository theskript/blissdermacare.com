'use strict';

/**
 * POST /.netlify/functions/admin-login
 * Body: { username: "owner"|"staff", password: string }
 * Returns: { token, role, expiresIn }
 */

const { jwtSign } = require('./_utils.cjs');

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

  const { username, password } = body;
  const secret = process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server is not configured. Set ADMIN_JWT_SECRET.' }) };
  }
  if (!process.env.ADMIN_PASSWORD || !process.env.STAFF_PASSWORD) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Server is not configured. Set ADMIN_PASSWORD and STAFF_PASSWORD.' }) };
  }

  let role = null;
  if (username === 'owner' && password === process.env.ADMIN_PASSWORD) role = 'owner';
  else if (username === 'staff' && password === process.env.STAFF_PASSWORD) role = 'staff';

  if (!role) {
    // Delay to mitigate timing-based username enumeration
    await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid username or password' }) };
  }

  // Owner: 24h session. Staff: 8h session.
  const expiresIn = role === 'owner' ? 86400 : 28800;
  const token = jwtSign({ role, username }, secret, expiresIn);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ token, role, expiresIn }),
  };
};
