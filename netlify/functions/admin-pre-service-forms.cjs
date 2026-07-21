'use strict';

/**
 * GET    /.netlify/functions/admin-pre-service-forms  — list submissions
 * PATCH  /.netlify/functions/admin-pre-service-forms  — mark read/unread (single or all)
 * DELETE /.netlify/functions/admin-pre-service-forms  — delete a submission
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

  // ── PATCH — mark a submission (or all) as read / unread ──────────────────
  if (event.httpMethod === 'PATCH') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const { id, read, readAll } = body;

    if (readAll) {
      // Mark every unread record as read
      const { error } = await getSupabase()
        .from('pre_service_forms')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null);
      if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id or readAll is required' }) };

    const { error } = await getSupabase()
      .from('pre_service_forms')
      .update({ read_at: read ? new Date().toISOString() : null })
      .eq('id', id);
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  // ── DELETE — remove a submission ─────────────────────────────────────────
  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const { id } = body;
    if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) };

    const { error } = await getSupabase()
      .from('pre_service_forms')
      .delete()
      .eq('id', id);
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  // ── GET — list submissions ────────────────────────────────────────────────
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const q = event.queryStringParameters || {};
    const limit = Math.min(parseInt(q.limit || '100', 10), 500);

    let query = getSupabase()
      .from('pre_service_forms')
      .select('id, name, email, phone, appointment_date, skin_conditions, medical_history, medications, allergies, created_at, read_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (q.since)          query = query.gte('created_at', q.since);
    if (q.email)          query = query.eq('email', q.email.toLowerCase());
    if (q.unread === 'true') query = query.is('read_at', null);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: data || [], total: (data || []).length }) };
  } catch (err) {
    console.error('admin-pre-service-forms error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
