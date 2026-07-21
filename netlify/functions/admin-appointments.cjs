'use strict';

const { requireAuth, getSupabase, apptFromDB, apptToDB, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

const WRITABLE_FIELDS = new Set([
  'Client Name', 'Client Email', 'Client Phone', 'Date', 'Time', 'Services',
  'Status', 'Price', 'Notes', 'Internal Notes', 'Source', 'Discount',
  'Referral', 'Groupon Code', 'Stripe Session ID',
  'Reminder 24h Sent', 'Reminder 2h Sent',
  'Confirm Phone', 'Confirm Text', 'Confirm Email',
]);

function sanitize(fields = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(fields)) { if (WRITABLE_FIELDS.has(k)) clean[k] = v; }
  return clean;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  const sb = getSupabase();
  const ip = getClientIP(event);

  try {
    // GET
    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};
      let query = sb.from('appointments').select('*');

      const targetDate = (user.role === 'staff' && !q.date) ? new Date().toISOString().split('T')[0] : (q.date || null);
      if (targetDate) {
        query = query.eq('date', targetDate);
      } else if (q.startDate && q.endDate) {
        query = query.gte('date', q.startDate).lte('date', q.endDate);
      }
      if (q.status) query = query.eq('status', q.status);
      if (q.search) {
        const s = q.search.replace(/'/g, '').substring(0, 100);
        query = query.or(`client_name.ilike.%${s}%,client_email.ilike.%${s}%,client_phone.ilike.%${s}%`);
      }
      query = query.order('date', { ascending: true }).order('time', { ascending: true }).limit(100);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      let records = (data || []).map(apptFromDB);

      // Enrich with PSF status — flag which appointments have a matching form submission
      try {
        const emails = [...new Set((data || []).map(r => r.client_email).filter(Boolean))];
        if (emails.length) {
          const { data: psfs } = await sb
            .from('pre_service_forms')
            .select('email, appointment_date')
            .in('email', emails);
          const psfSet = new Set((psfs || []).map(p => `${(p.email || '').toLowerCase()}::${p.appointment_date}`));
          records = records.map(r => ({
            ...r,
            fields: {
              ...r.fields,
              hasPSF: psfSet.has(`${(r.fields['Client Email'] || '').toLowerCase()}::${r.fields['Date']}`),
            },
          }));
        }
      } catch (psfErr) {
        console.warn('PSF enrichment failed (non-fatal):', psfErr.message);
      }
      if (user.role === 'staff') {
        records = records.map(r => {
          const f = { ...r.fields };
          delete f['Price']; delete f['Stripe Session ID'];
          return { ...r, fields: f };
        });
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ records }) };
    }

    // POST
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { data, error } = await sb.from('appointments').insert(apptToDB(sanitize(body))).select().single();
      if (error) throw new Error(error.message);
      const record = apptFromDB(data);
      logAudit({ action: 'Create Appointment', username: user.username, role: user.role, details: `Client: ${body['Client Name'] || '?'}, Date: ${body['Date'] || '?'}, Services: ${(body['Services'] || '').substring(0, 80)}`, targetId: data.id, ip });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(record) };
    }

    // PATCH
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id, fields } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Record ID required' }) };

      const allowed = user.role === 'owner'
        ? sanitize(fields)
        : Object.fromEntries(Object.entries(fields || {}).filter(([k]) => k === 'Status' || k === 'Internal Notes'));

      const { data, error } = await sb.from('appointments').update(apptToDB(allowed)).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      logAudit({ action: 'Update Appointment', username: user.username, role: user.role, details: `Updated: ${Object.keys(allowed).join(', ')}`, targetId: id, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(apptFromDB(data)) };
    }

    // DELETE
    if (event.httpMethod === 'DELETE') {
      if (user.role !== 'owner') return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Owner access required' }) };
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Record ID required' }) };

      const { error } = await sb.from('appointments').delete().eq('id', id);
      if (error) throw new Error(error.message);
      logAudit({ action: 'Delete Appointment', username: user.username, role: user.role, details: `Deleted appointment ${id}`, targetId: id, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ deleted: true, id }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-appointments error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
