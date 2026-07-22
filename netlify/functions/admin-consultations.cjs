'use strict';

/**
 * GET    /.netlify/functions/admin-consultations   — list submissions
 * PATCH  /.netlify/functions/admin-consultations   — mark read/unread
 * DELETE /.netlify/functions/admin-consultations   — delete
 */

const { requireAuth, getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
  'Access-Control-Allow-Methods':'GET, PATCH, DELETE, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
  void user;

  if (event.httpMethod === 'PATCH') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const { id, read, readAll } = body;
    if (readAll) {
      const { error } = await getSupabase().from('consultation_submissions').update({ read_at: new Date().toISOString() }).is('read_at', null);
      if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }
    if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id or readAll required' }) };
    const { error } = await getSupabase().from('consultation_submissions').update({ read_at: read ? new Date().toISOString() : null }).eq('id', id);
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const { id } = body;
    if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };
    const { error } = await getSupabase().from('consultation_submissions').delete().eq('id', id);
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const q = event.queryStringParameters || {};
    const limit = Math.min(parseInt(q.limit || '100', 10), 500);
    let query = getSupabase()
      .from('consultation_submissions')
      .select('id, name, email, phone, skin_type, concerns, current_routine, goals, contact_preference, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (q.since)          query = query.gte('created_at', q.since);
    if (q.unread === 'true') query = query.is('read_at', null);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: data || [] }) };
  } catch (err) {
    console.error('admin-consultations error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
