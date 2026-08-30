'use strict';

const { requireAuth } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SENDGRID_API_KEY',
  'SALESMSG_API_KEY',
  'ADMIN_JWT_SECRET',
  'STRIPE_SECRET_KEY',
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  try { requireAuth(event, 'owner'); } catch (error) {
    return { statusCode: error.statusCode || 403, headers: CORS, body: JSON.stringify({ error: error.message }) };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const environment = Object.fromEntries(REQUIRED_ENV.map(key => [key, Boolean(process.env[key]?.trim())]));
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ environment }) };
};