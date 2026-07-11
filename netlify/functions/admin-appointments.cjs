'use strict';

/**
 * /.netlify/functions/admin-appointments
 *
 * GET    ?date=YYYY-MM-DD | ?startDate=...&endDate=... | ?status=... | ?search=...
 * POST   body: appointment fields  → create
 * PATCH  body: { id, fields }      → update
 * DELETE body: { id }              → delete (owner only)
 *
 * All methods require: Authorization: Bearer <token>
 */

const { requireAuth, airtableList, airtableCreate, airtablePatch, airtableDelete } = require('./_utils.cjs');

const TABLE = () => process.env.AIRTABLE_APPOINTMENTS_TABLE || 'Appointments';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

// Fields that clients/staff are allowed to write
const WRITABLE_FIELDS = new Set([
  'Client Name', 'Client Email', 'Client Phone',
  'Date', 'Time', 'Services', 'Status', 'Price',
  'Notes', 'Internal Notes', 'Source', 'Discount',
  'Referral', 'Groupon Code', 'Stripe Session ID',
  'Reminder 24h Sent', 'Reminder 2h Sent',
  'Confirm Phone', 'Confirm Text', 'Confirm Email',
]);

function sanitize(fields = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(fields)) {
    if (WRITABLE_FIELDS.has(k)) clean[k] = v;
  }
  return clean;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  try {
    // ── GET ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};
      const filters = [];

      // Staff can only see today's appointments
      if (user.role === 'staff' && !q.date) {
        const today = new Date().toISOString().split('T')[0];
        filters.push(`DATESTR({Date})="${today}"`);
      } else if (q.date) {
        filters.push(`DATESTR({Date})="${q.date}"`);
      } else if (q.startDate && q.endDate) {
        filters.push(`AND(DATESTR({Date})>="${q.startDate}",DATESTR({Date})<="${q.endDate}")`);
      }

      if (q.status) filters.push(`{Status}="${q.status}"`);

      if (q.search) {
        const s = q.search.toLowerCase().replace(/"/g, '').substring(0, 100);
        filters.push(
          `OR(SEARCH("${s}",LOWER({Client Name})),SEARCH("${s}",LOWER({Client Email})),SEARCH("${s}",LOWER({Client Phone})))`
        );
      }

      const params = {
        pageSize: 100,
        'sort[0][field]': 'Date',
        'sort[0][direction]': 'asc',
        'sort[1][field]': 'Time',
        'sort[1][direction]': 'asc',
      };
      if (filters.length > 0) {
        params.filterByFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(',')})`;
      }

      const data = await airtableList(TABLE(), params);

      // Strip pricing data for staff role
      if (user.role === 'staff') {
        data.records = (data.records || []).map(r => {
          const f = { ...r.fields };
          delete f['Price'];
          delete f['Stripe Session ID'];
          return { ...r, fields: f };
        });
      }

      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const record = await airtableCreate(TABLE(), sanitize(body));
      return { statusCode: 201, headers: CORS, body: JSON.stringify(record) };
    }

    // ── PATCH ────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'PATCH') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id, fields } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Record ID required' }) };

      // Staff may only update Status and Internal Notes
      const allowed = user.role === 'owner'
        ? sanitize(fields)
        : Object.fromEntries(
            Object.entries(fields || {}).filter(([k]) => k === 'Status' || k === 'Internal Notes')
          );

      const record = await airtablePatch(TABLE(), id, allowed);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(record) };
    }

    // ── DELETE ───────────────────────────────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      if (user.role !== 'owner') {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Owner access required for deletion' }) };
      }
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
      }
      const { id } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Record ID required' }) };

      const result = await airtableDelete(TABLE(), id);
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-appointments error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message || 'Internal server error' }) };
  }
};
