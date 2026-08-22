'use strict';

const { requireAuth, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

const WRITABLE = new Set(['slug','name','tagline','description','page_url','image_url','sort_order','active']);

function sanitize(body = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(body)) { if (WRITABLE.has(k)) clean[k] = v; }
  return clean;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
  if (user.role !== 'owner') {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Owner access required' }) };
  }

  const sb  = getSupabase();
  const ip  = getClientIP(event);

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await sb.from('service_categories').select('*').order('sort_order');
      if (error) throw new Error(error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ categories: data || [] }) };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const fields = sanitize(body);
      if (!fields.slug || !fields.name) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'slug and name are required' }) };
      }
      fields.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('service_categories').insert(fields).select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Create Category', username: user.username, role: user.role, targetId: data.id, details: { name: fields.name }, ip });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id, ...rest } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) };
      const fields = sanitize(rest);
      fields.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('service_categories').update(fields).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Update Category', username: user.username, role: user.role, targetId: id, details: fields, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) };
      const { error } = await sb.from('service_categories').delete().eq('id', id);
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Delete Category', username: user.username, role: user.role, targetId: id, details: {}, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
