'use strict';

/**
 * GET    — list pages or single page by id/slug
 * POST   — create page
 * PATCH  — update page (blocks, title, meta, status)
 * DELETE — delete page
 */

const { requireAuth, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  const sb = getSupabase();
  const ip = getClientIP(event);
  const q  = event.queryStringParameters || {};

  try {
    if (event.httpMethod === 'GET') {
      if (q.id) {
        const { data, error } = await sb.from('site_pages').select('*').eq('id', q.id).single();
        if (error) throw new Error(error.message);
        return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
      }
      const { data, error } = await sb.from('site_pages')
        .select('id, title, slug, status, meta_description, updated_at, created_at')
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ pages: data || [] }) };
    }

    if (user.role !== 'owner') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Owner access required' }) };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { title, slug, meta_description, blocks = [], status = 'draft' } = body;
      if (!title || !slug) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'title and slug are required' }) };
      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const { data, error } = await sb.from('site_pages').insert({
        title, slug: cleanSlug, meta_description, blocks, status,
        updated_at: new Date().toISOString(),
      }).select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Create Page', username: user.username, role: user.role, targetId: data.id, details: { title, slug: cleanSlug }, ip });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id, ...rest } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };
      const allowed = ['title', 'slug', 'meta_description', 'blocks', 'status'];
      const update = Object.fromEntries(Object.entries(rest).filter(([k]) => allowed.includes(k)));
      if (update.slug) update.slug = update.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      update.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('site_pages').update(update).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Update Page', username: user.username, role: user.role, targetId: id, details: { title: data.title, status: data.status }, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'DELETE') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };
      await sb.from('site_pages').delete().eq('id', id);
      await logAudit(sb, { action: 'Delete Page', username: user.username, role: user.role, targetId: id, details: {}, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-pages error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
