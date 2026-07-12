'use strict';

const { requireAuth, getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const q = event.queryStringParameters || {};
    const search = (q.search || '').replace(/'/g, '').substring(0, 100);

    let query = getSupabase()
      .from('appointments')
      .select('id,client_name,client_email,client_phone,date,status,source,services,notes,internal_notes,price')
      .order('date', { ascending: false });

    if (search) {
      query = query.or(`client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_phone.ilike.%${search}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Group by email to build client profiles
    const clientMap = new Map();
    for (const row of (rows || [])) {
      const email = (row.client_email || '').toLowerCase().trim();
      const key = email || (row.client_name || '').toLowerCase().trim() || row.id;

      if (!clientMap.has(key)) {
        clientMap.set(key, {
          email: row.client_email || '',
          name: row.client_name || '',
          phone: row.client_phone || '',
          source: row.source || '',
          totalVisits: 0,
          firstVisit: row.date || null,
          lastVisit: row.date || null,
          appointments: [],
        });
      }

      const c = clientMap.get(key);
      if (row.date && row.date >= (c.lastVisit || '')) {
        if (row.client_name) c.name = row.client_name;
        if (row.client_phone) c.phone = row.client_phone;
      }
      c.totalVisits += 1;
      if (row.date && (!c.firstVisit || row.date < c.firstVisit)) c.firstVisit = row.date;
      if (row.date && (!c.lastVisit  || row.date > c.lastVisit))  c.lastVisit  = row.date;

      c.appointments.push({
        id:            row.id,
        date:          row.date || '',
        time:          row.time || '',
        services:      row.services || '',
        status:        row.status || '',
        source:        row.source || '',
        notes:         row.notes || '',
        internalNotes: row.internal_notes || '',
        ...(user.role === 'owner' ? { price: row.price || 0 } : {}),
      });
    }

    const clients = Array.from(clientMap.values())
      .sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''));

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ clients, total: clients.length }) };
  } catch (err) {
    console.error('admin-clients error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
