'use strict';

/**
 * GET    — list promo codes (owner-only)
 * POST   — create (owner-only)
 * PATCH  — update (owner-only)
 * DELETE — deactivate (owner-only)
 */

const { requireAuth, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
  'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS',
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

  const sb  = getSupabase();
  const ip  = getClientIP(event);

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await sb.from('promo_codes').select('*').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ promoCodes: data || [] }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    if (event.httpMethod === 'POST') {
      const { code, type, value, max_uses, expires_at, min_subtotal, description } = body;
      if (!code || !type || value == null)
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'code, type, and value are required' }) };
      if (!['percent', 'fixed'].includes(type))
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'type must be percent or fixed' }) };

      const { data, error } = await sb.from('promo_codes').insert({
        code:        code.trim().toUpperCase(),
        type,
        value:       parseInt(value, 10),
        max_uses:    max_uses ? parseInt(max_uses, 10) : null,
        expires_at:  expires_at || null,
        min_subtotal: min_subtotal ? parseInt(min_subtotal, 10) : null,
        description: description || null,
        active:      true,
      }).select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Create Promo Code', username: user.username, role: user.role, targetId: data.id, details: { code: data.code }, ip });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'PATCH') {
      const { id, ...rest } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) };
      const fields = {};
      if (rest.code        !== undefined) fields.code        = rest.code.trim().toUpperCase();
      if (rest.type        !== undefined) fields.type        = rest.type;
      if (rest.value       !== undefined) fields.value       = parseInt(rest.value, 10);
      if (rest.max_uses    !== undefined) fields.max_uses    = rest.max_uses ? parseInt(rest.max_uses, 10) : null;
      if (rest.expires_at  !== undefined) fields.expires_at  = rest.expires_at || null;
      if (rest.min_subtotal!== undefined) fields.min_subtotal= rest.min_subtotal ? parseInt(rest.min_subtotal, 10) : null;
      if (rest.description !== undefined) fields.description = rest.description;
      if (rest.active      !== undefined) fields.active      = rest.active;
      if (rest.uses        !== undefined) fields.uses        = parseInt(rest.uses, 10);
      const { data, error } = await sb.from('promo_codes').update(fields).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Update Promo Code', username: user.username, role: user.role, targetId: id, details: fields, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'DELETE') {
      const { id } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) };
      await sb.from('promo_codes').update({ active: false }).eq('id', id);
      await logAudit(sb, { action: 'Deactivate Promo Code', username: user.username, role: user.role, targetId: id, details: {}, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ deactivated: true, id }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-promo-codes error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
