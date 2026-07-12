'use strict';

const { requireAuth, getSupabase, auditFromDB } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  try { requireAuth(event, 'owner'); } catch (e) {
    return { statusCode: e.statusCode || 403, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  try {
    const q = event.queryStringParameters || {};
    const limit = Math.min(parseInt(q.limit || '200', 10), 500);

    let query = getSupabase()
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (q.username) query = query.ilike('username', q.username.replace(/'/g, ''));
    if (q.action)   query = query.eq('action', q.action);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const records = (data || []).map(auditFromDB);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ records }) };
  } catch (err) {
    console.error('admin-audit error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
