'use strict';

const { requireAuth, getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
};

const EDITABLE_FIELDS = new Set(['client_name', 'service_name', 'rating', 'review_text', 'published', 'featured', 'sort_order']);

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try { requireAuth(event); } catch (error) {
    return { statusCode: error.statusCode || 401, headers: CORS, body: JSON.stringify({ error: error.message }) };
  }

  if (event.httpMethod === 'PATCH') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    if (!body.id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };

    const updates = { updated_at: new Date().toISOString() };
    for (const [key, value] of Object.entries(body)) {
      if (EDITABLE_FIELDS.has(key)) updates[key] = value;
    }
    if (Object.hasOwn(body, 'published')) updates.moderated_at = new Date().toISOString();
    if (updates.rating && (!Number.isInteger(Number(updates.rating)) || Number(updates.rating) < 1 || Number(updates.rating) > 5)) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Rating must be between 1 and 5.' }) };
    }

    const { data, error } = await getSupabase().from('reviews').update(updates).eq('id', body.id).select().single();
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ record: data }) };
  }

  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    if (!body.id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };
    const { error } = await getSupabase().from('reviews').delete().eq('id', body.id);
    if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { data, error } = await getSupabase()
    .from('reviews')
    .select('id,client_name,email,service_name,rating,review_text,consent,published,featured,sort_order,moderated_at,created_at,updated_at')
    .order('created_at', { ascending: false });
  if (error) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: error.message }) };
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: data || [] }) };
};