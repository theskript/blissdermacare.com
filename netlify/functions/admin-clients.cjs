'use strict';

/**
 * GET /.netlify/functions/admin-clients?search=...
 *
 * Derives client profiles by grouping all appointment records by email.
 * Returns unique clients with visit history summary.
 * Requires: Authorization: Bearer <token>
 */

const { requireAuth, airtableListAll } = require('./_utils.cjs');

const TABLE = () => process.env.AIRTABLE_APPOINTMENTS_TABLE || 'Appointments';

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
    const search = (q.search || '').toLowerCase().replace(/"/g, '').substring(0, 100);

    const params = {
      'sort[0][field]': 'Date',
      'sort[0][direction]': 'desc',
    };

    if (search) {
      params.filterByFormula =
        `OR(SEARCH("${search}",LOWER({Client Name})),SEARCH("${search}",LOWER({Client Email})),SEARCH("${search}",LOWER({Client Phone})))`;
    }

    const records = await airtableListAll(TABLE(), params);

    // Group appointments by client email (fall back to name if no email)
    const clientMap = new Map();

    for (const rec of records) {
      const f = rec.fields;
      const email = (f['Client Email'] || '').toLowerCase().trim();
      const key = email || (f['Client Name'] || '').toLowerCase().trim() || rec.id;

      if (!clientMap.has(key)) {
        clientMap.set(key, {
          email: f['Client Email'] || '',
          name: f['Client Name'] || '',
          phone: f['Client Phone'] || '',
          source: f['Source'] || '',
          totalVisits: 0,
          firstVisit: f['Date'] || null,
          lastVisit: f['Date'] || null,
          appointments: [],
        });
      }

      const c = clientMap.get(key);
      // Keep latest name/phone in case it was updated on a more recent booking
      if (f['Date'] && f['Date'] >= (c.lastVisit || '')) {
        if (f['Client Name']) c.name = f['Client Name'];
        if (f['Client Phone']) c.phone = f['Client Phone'];
      }
      c.totalVisits += 1;
      if (f['Date'] && (!c.firstVisit || f['Date'] < c.firstVisit)) c.firstVisit = f['Date'];
      if (f['Date'] && (!c.lastVisit || f['Date'] > c.lastVisit)) c.lastVisit = f['Date'];

      c.appointments.push({
        id: rec.id,
        date: f['Date'] || '',
        time: f['Time'] || '',
        services: f['Services'] || '',
        status: f['Status'] || '',
        source: f['Source'] || '',
        notes: f['Notes'] || '',
        internalNotes: f['Internal Notes'] || '',
        // Only include price for owner role
        ...(user.role === 'owner' ? { price: f['Price'] || 0 } : {}),
      });
    }

    const clients = Array.from(clientMap.values())
      .sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''));

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ clients, total: clients.length }) };
  } catch (err) {
    console.error('admin-clients error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message || 'Internal server error' }) };
  }
};
