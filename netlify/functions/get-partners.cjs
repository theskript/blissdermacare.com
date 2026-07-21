'use strict';

const { getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const sb = getSupabase();
    const featured = event.queryStringParameters?.featured === 'true';

    let query = sb
      .from('partners')
      .select('id, name, category, tagline, url, logo_url, badge_text, featured')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (featured) query = query.eq('featured', true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ records: data || [] }) };
  } catch (err) {
    console.error('[get-partners]', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to load partners' }) };
  }
};
