'use strict';

/**
 * GET /.netlify/functions/admin-audit  — Owner only
 * Query params: ?limit=100&username=...&action=...&startDate=...&endDate=...
 * Returns recent audit log entries from Airtable.
 */

const { requireAuth, airtableList } = require('./_utils.cjs');

const AUDIT_TABLE = () => process.env.AIRTABLE_AUDIT_TABLE || 'Audit Log';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  try { requireAuth(event, 'owner'); } catch (e) {
    return { statusCode: e.statusCode || 403, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const q = event.queryStringParameters || {};
    const limit = Math.min(parseInt(q.limit || '200', 10), 500);
    const filters = [];

    if (q.username) filters.push(`LOWER({Username})="${q.username.toLowerCase().replace(/"/g, '')}"`);
    if (q.action)   filters.push(`{Action}="${q.action.replace(/"/g, '')}"`);

    const params = {
      pageSize: limit,
      'sort[0][field]': 'Timestamp',
      'sort[0][direction]': 'desc',
    };
    if (filters.length > 0) {
      params.filterByFormula = filters.length === 1 ? filters[0] : `AND(${filters.join(',')})`;
    }

    const data = await airtableList(AUDIT_TABLE(), params);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
  } catch (err) {
    console.error('admin-audit error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
