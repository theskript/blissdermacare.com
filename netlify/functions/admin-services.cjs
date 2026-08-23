'use strict';

/**
 * GET    — list/search services
 * POST   — create service (owner only)
 * PATCH  — update service (owner only)
 * DELETE — delete service (owner only)
 */

const { requireAuth, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
  'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS',
};

const WRITABLE = new Set(['slug','name','category','price','duration','description','tagline','image_url','is_package','is_bookable','active','featured','badge','sort_order']);

// Converts any string into a URL-safe lowercase slug
function slugify(str) {
  return String(str || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

  const sb  = getSupabase();
  const ip  = getClientIP(event);

  try {
    // ── GET ───────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};
      let query = sb.from('services').select('*').order('category').order('sort_order');
      if (q.category) query = query.eq('category', q.category);
      if (q.active === 'true')  query = query.eq('active', true);
      if (q.active === 'false') query = query.eq('active', false);
      if (q.search) {
        const s = q.search.replace(/'/g, '').substring(0, 80);
        query = query.or(`name.ilike.%${s}%,slug.ilike.%${s}%`);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ services: data || [] }) };
    }

    // Owner-only mutations
    if (user.role !== 'owner') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Owner access required' }) };
    }

    // ── POST — create ────────────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const fields = sanitize(body);
      if (!fields.name || !fields.category) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name and category are required' }) };
      }
      // Auto-generate slug from name — never trust a user-submitted slug
      fields.slug = slugify(fields.name);
      if (!fields.slug) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Could not generate a valid slug from the name provided' }) };
      if (typeof fields.price !== 'number') fields.price = parseInt(fields.price || 0, 10);
      fields.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('services').insert(fields).select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Create Service', username: user.username, role: user.role, targetId: data.id, details: { name: fields.name }, ip });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(data) };
    }

    // ── PATCH — update ───────────────────────────────────────────────────────
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id, ...rest } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) };
      const fields = sanitize(rest);
      if (typeof fields.price === 'string') fields.price = parseInt(fields.price, 10);
      // Sanitize slug if explicitly provided; otherwise preserve existing slug
      if (fields.slug !== undefined) fields.slug = slugify(fields.slug);
      // is_bookable always mirrors active — no separate toggle needed
      if (fields.active !== undefined) fields.is_bookable = fields.active;
      fields.updated_at = new Date().toISOString();
      // Fetch old data for a meaningful audit trail
      const { data: oldData } = await sb.from('services').select('name,price,active,featured,category,badge').eq('id', id).single();
      const { data, error } = await sb.from('services').update(fields).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      // Build a human-readable changes summary
      const changes = {};
      if (oldData) {
        if (fields.name     !== undefined && fields.name     !== oldData.name)     changes.name     = { from: oldData.name,     to: fields.name };
        if (fields.price    !== undefined && fields.price    !== oldData.price)    changes.price    = { from: `$${(oldData.price/100).toFixed(0)}`, to: `$${(fields.price/100).toFixed(0)}` };
        if (fields.active   !== undefined && fields.active   !== oldData.active)   changes.active   = { from: oldData.active,   to: fields.active };
        if (fields.featured !== undefined && fields.featured !== oldData.featured) changes.featured = { from: oldData.featured, to: fields.featured };
        if (fields.category !== undefined && fields.category !== oldData.category) changes.category = { from: oldData.category, to: fields.category };
        if (fields.badge    !== undefined && fields.badge    !== oldData.badge)    changes.badge    = { from: oldData.badge,    to: fields.badge };
      }
      await logAudit(sb, { action: 'Update Service', username: user.username, role: user.role, targetId: id,
        details: { service: data.name, changes: Object.keys(changes).length ? changes : fields }, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) };
      await sb.from('services').delete().eq('id', id);
      await logAudit(sb, { action: 'Delete Service', username: user.username, role: user.role, targetId: id, details: {}, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true, id }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-services error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
