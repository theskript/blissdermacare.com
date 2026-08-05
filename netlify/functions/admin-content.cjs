'use strict';

/**
 * GET    — list all content rows (optionally filtered by page)
 * PATCH  — update a section's value
 */

const { requireAuth, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
  if (user.role !== 'owner') {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Owner access required' }) };
  }

  const sb = getSupabase();
  const ip = getClientIP(event);
  const q  = event.queryStringParameters || {};

  try {
    if (event.httpMethod === 'GET') {
      let query = sb.from('site_content').select('*').order('page_key').order('sort_order');
      if (q.page) query = query.eq('page_key', q.page);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ sections: data || [] }) };
    }

    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { page_key, section_key, value } = body;
      if (!page_key || !section_key) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'page_key and section_key are required' }) };
      }
      const { data, error } = await sb.from('site_content')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('page_key', page_key)
        .eq('section_key', section_key)
        .select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Update Site Content', username: user.username, role: user.role,
        targetId: data.id, details: { page_key, section_key }, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-content error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
