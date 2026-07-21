'use strict';

const { requireAuth, getSupabase, partnerFromDB, partnerToDB, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

// Allowed categories (validated on create/update if desired)
const ALLOWED_CATEGORIES = [
  'Skincare Products',
  'Wellness & Supplements',
  'Beauty Tools',
  'Nutrition & Diet',
  'Fitness & Health',
  'Other',
];
void ALLOWED_CATEGORIES; // exported for potential future validation

function validateUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try {
    user = requireAuth(event, 'owner');
  } catch (e) {
    return { statusCode: e.statusCode || 403, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  const sb = getSupabase();
  const ip = getClientIP(event);

  try {
    // GET — list all partners
    if (event.httpMethod === 'GET') {
      const { data, error } = await sb
        .from('partners')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: (data || []).map(partnerFromDB) }) };
    }

    // POST — create partner
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }

      const { name, category, tagline, description, url, logo_url, badge_text, featured, active, sort_order } = body;
      if (!name?.trim()) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Name is required' }) };
      if (!url?.trim()) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'URL is required' }) };
      if (!validateUrl(url.trim())) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'URL must start with http:// or https://' }) };

      const row = {
        name: name.trim(),
        category: category?.trim() || 'Other',
        tagline: tagline?.trim() || null,
        description: description?.trim() || null,
        url: url.trim(),
        logo_url: logo_url?.trim() || null,
        badge_text: badge_text?.trim() || null,
        featured: Boolean(featured),
        active: active !== false,
        sort_order: Number(sort_order) || 0,
      };

      const { data, error } = await sb.from('partners').insert(row).select().single();
      if (error) throw new Error(error.message);

      logAudit({ action: 'Create Partner', username: user.username, role: user.role, details: `Created partner: ${name}`, targetId: data.id, ip });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(partnerFromDB(data)) };
    }

    // PATCH — update partner
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }

      const { id, fields } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Record ID required' }) };
      if (!fields || Object.keys(fields).length === 0) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No fields to update' }) };
      }

      if (fields.URL && !validateUrl(fields.URL)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'URL must start with http:// or https://' }) };
      }

      const updates = partnerToDB(fields);
      const { data, error } = await sb.from('partners').update(updates).eq('id', id).select().single();
      if (error) throw new Error(error.message);

      logAudit({ action: 'Update Partner', username: user.username, role: user.role, details: `Updated partner: ${data.name}`, targetId: id, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(partnerFromDB(data)) };
    }

    // DELETE — remove partner
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Record ID required' }) };

      const { data: existing } = await sb.from('partners').select('name').eq('id', id).maybeSingle();
      const { error } = await sb.from('partners').delete().eq('id', id);
      if (error) throw new Error(error.message);

      logAudit({ action: 'Delete Partner', username: user.username, role: user.role, details: `Deleted partner: ${existing?.name || id}`, targetId: id, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('[admin-partners]', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message || 'Internal server error' }) };
  }
};
