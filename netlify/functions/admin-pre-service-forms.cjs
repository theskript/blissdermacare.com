'use strict';

/**
 * GET  /.netlify/functions/admin-pre-service-forms
 * Returns PSF submissions. Owner/staff auth required.
 *
 * Query params:
 *   since=<ISO timestamp>   — filter to submissions created after this date
 *   email=<email>           — filter to a specific client
 *   limit=<n>               — max rows (default 100)
 */

const { requireAuth, getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
  'Access-Control-Allow-Methods':'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
  void user;

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const q = event.queryStringParameters || {};
    const limit = Math.min(parseInt(q.limit || '100', 10), 500);

    let query = getSupabase()
      .from('pre_service_forms')
      .select('id, name, email, phone, appointment_date, skin_conditions, medical_history, medications, allergies, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (q.since) query = query.gte('created_at', q.since);
    if (q.email) query = query.eq('email', q.email.toLowerCase());

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: data || [], total: (data || []).length }) };
  } catch (err) {
    console.error('admin-pre-service-forms error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
