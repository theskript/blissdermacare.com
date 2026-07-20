'use strict';

const { requireAuth, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
};

const PLAN_LABELS = {
  'glow-ritual':   'The Glow Ritual ($89/mo)',
  'radiance-plan': 'The Radiance Plan ($159/mo)',
  'vip-luxe':      'The Bliss VIP ($249/mo)',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event, 'owner'); } catch (e) {
    return { statusCode: e.statusCode || 403, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  const sb = getSupabase();

  try {
    // GET — list all memberships + stats
    if (event.httpMethod === 'GET') {
      const { data, error } = await sb
        .from('memberships')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      const records = data || [];
      const stats = {
        total:     records.length,
        active:    records.filter(r => r.status === 'active').length,
        past_due:  records.filter(r => r.status === 'past_due').length,
        cancelled: records.filter(r => r.status === 'cancelled').length,
      };

      // Enrich with plan labels
      const enriched = records.map(r => ({
        ...r,
        plan_label: r.plan_label || PLAN_LABELS[r.plan] || r.plan,
      }));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: enriched, stats }) };
    }

    // PATCH — manually update a membership status
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id, status } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };

      const allowed = ['active', 'cancelled', 'past_due', 'paused'];
      if (status && !allowed.includes(status)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `status must be one of: ${allowed.join(', ')}` }) };
      }

      const { data, error } = await sb.from('memberships')
        .update({ ...(status ? { status } : {}), updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
      if (error) throw new Error(error.message);

      logAudit({ action: 'Update Membership', username: user.username, role: user.role, details: `Membership ${id} → status: ${status}`, targetId: id, ip: getClientIP(event) });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // DELETE — remove a membership record
    if (event.httpMethod === 'DELETE') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };

      const { error } = await sb.from('memberships').delete().eq('id', id);
      if (error) throw new Error(error.message);

      logAudit({ action: 'Delete Membership', username: user.username, role: user.role, details: `Deleted membership ${id}`, targetId: id, ip: getClientIP(event) });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-memberships error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
