'use strict';

/** GET /.netlify/functions/get-content?page=about — returns all sections for a page. */

const { getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=30',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET')
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const { page } = event.queryStringParameters || {};
  if (!page) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'page is required' }) };

  try {
    const { data, error } = await getSupabase()
      .from('site_content')
      .select('section_key, type, value')
      .eq('page_key', page)
      .order('sort_order');
    if (error) throw new Error(error.message);
    // Build a key→value map for easy consumption
    const map = {};
    for (const row of (data || [])) {
      map[row.section_key] = { type: row.type, value: row.value };
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ content: map }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
