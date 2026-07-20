'use strict';

const { requireAuth, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, PATCH, POST, DELETE, OPTIONS',
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event, 'owner'); } catch (e) {
    return { statusCode: e.statusCode || 403, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  const sb = getSupabase();
  const ip = getClientIP(event);

  try {
    // GET — fetch weekly schedule + upcoming overrides
    if (event.httpMethod === 'GET') {
      const today = new Date().toISOString().split('T')[0];
      const [schedResult, ovrResult] = await Promise.all([
        sb.from('availability').select('*').order('day_of_week'),
        sb.from('availability_overrides').select('*').gte('date', today).order('date').limit(90),
      ]);
      if (schedResult.error) throw new Error(schedResult.error.message);
      if (ovrResult.error)   throw new Error(ovrResult.error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ schedule: schedResult.data || [], overrides: ovrResult.data || [] }) };
    }

    // PATCH — update a single day's schedule
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { day_of_week, is_open, open_time, close_time, slot_interval } = body;
      if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'day_of_week (0–6) required' }) };
      }
      const update = { updated_at: new Date().toISOString() };
      if (is_open    !== undefined) update.is_open    = Boolean(is_open);
      if (open_time)               update.open_time  = open_time;
      if (close_time)              update.close_time = close_time;
      if (slot_interval)           update.slot_interval = Number(slot_interval);

      const { data, error } = await sb.from('availability').update(update).eq('day_of_week', day_of_week).select().single();
      if (error) throw new Error(error.message);

      logAudit({ action: 'Update Availability', username: user.username, role: user.role, details: `${DAYS[day_of_week]}: ${JSON.stringify(update)}`, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // POST — add or update a date override
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { date, is_closed = true, open_time, close_time, notes } = body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'date (YYYY-MM-DD) required' }) };
      }
      const { data, error } = await sb.from('availability_overrides')
        .upsert(
          { date, is_closed: Boolean(is_closed), open_time: open_time || null, close_time: close_time || null, notes: (notes || '').substring(0, 200) },
          { onConflict: 'date' }
        )
        .select().single();
      if (error) throw new Error(error.message);

      logAudit({ action: 'Add Availability Override', username: user.username, role: user.role, details: `Override ${date}: ${is_closed ? 'closed' : 'special hours'} — ${notes || ''}`, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // DELETE — remove a date override
    if (event.httpMethod === 'DELETE') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id required' }) };

      const { error } = await sb.from('availability_overrides').delete().eq('id', id);
      if (error) throw new Error(error.message);

      logAudit({ action: 'Remove Availability Override', username: user.username, role: user.role, details: `Removed override ${id}`, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-availability error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
