'use strict';

/** GET /.netlify/functions/get-page?slug=X — returns published page with blocks. */

const { getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=60',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET')
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const { slug } = event.queryStringParameters || {};
  if (!slug) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'slug is required' }) };

  try {
    const { data, error } = await getSupabase()
      .from('site_pages')
      .select('id, title, slug, meta_description, blocks')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();
    if (error || !data) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Page not found' }) };
    return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
  } catch (err: any) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
