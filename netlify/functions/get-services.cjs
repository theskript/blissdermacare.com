'use strict';

/**
 * GET /.netlify/functions/get-services
 * Public endpoint — returns active services (optionally filtered by category).
 * No authentication required.
 */

const { getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Allow-Methods':'GET, OPTIONS',
  'Cache-Control':               'public, max-age=60',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET')     return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const q = event.queryStringParameters || {};
    let query = getSupabase()
      .from('services')
      .select('id,slug,name,category,price,duration,description,tagline,image_url,is_package,is_bookable,featured,sort_order')
      .neq('active', false)
      .order('category')
      .order('sort_order');

    if (q.category) query = query.eq('category', q.category);
    if (q.featured === 'true') query = query.eq('featured', true);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Also return membership plans if requested
    let plans = null;
    if (q.includePlans === 'true') {
      const { data: planData } = await getSupabase()
        .from('membership_plans')
        .select('id,slug,name,price,description,perks,sort_order')
        .eq('active', true)
        .order('sort_order');
      plans = planData || [];
    }

    const resp = { services: data || [] };
    if (plans !== null) resp.plans = plans;
    return { statusCode: 200, headers: CORS, body: JSON.stringify(resp) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
