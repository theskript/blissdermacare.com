'use strict';

/**
 * GET /.netlify/functions/validate-promo-code?code=WELCOME20&subtotal=9900
 * Public — validates a promo code and returns discount info.
 * Does NOT increment uses (that happens at booking submission).
 */

const { getSupabase } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Allow-Methods':'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'GET')     return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const { code, subtotal } = event.queryStringParameters || {};
  if (!code) return { statusCode: 400, headers: CORS, body: JSON.stringify({ valid: false, error: 'No code provided.' }) };

  const subtotalCents = parseInt(subtotal || '0', 10);

  try {
    const { data: promo, error } = await getSupabase()
      .from('promo_codes')
      .select('id, code, type, value, max_uses, uses, expires_at, min_subtotal, description, active')
      .eq('code', code.trim().toUpperCase())
      .single();

    if (error || !promo) return { statusCode: 200, headers: CORS, body: JSON.stringify({ valid: false, error: 'Invalid promo code.' }) };
    if (!promo.active)   return { statusCode: 200, headers: CORS, body: JSON.stringify({ valid: false, error: 'This promo code is no longer active.' }) };
    if (promo.expires_at && new Date(promo.expires_at) < new Date())
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ valid: false, error: 'This promo code has expired.' }) };
    if (promo.max_uses != null && promo.uses >= promo.max_uses)
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ valid: false, error: 'This promo code has reached its maximum uses.' }) };
    if (promo.min_subtotal != null && subtotalCents < promo.min_subtotal)
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        valid: false,
        error: `Minimum order of $${(promo.min_subtotal / 100).toFixed(0)} required for this code.`,
      }) };

    const discountCents = promo.type === 'percent'
      ? Math.round(subtotalCents * promo.value / 100)
      : Math.min(promo.value, subtotalCents);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      valid:         true,
      code:          promo.code,
      type:          promo.type,
      value:         promo.value,
      description:   promo.description || null,
      discountCents,
      newTotalCents: subtotalCents - discountCents,
    }) };
  } catch (err) {
    console.error('validate-promo-code error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ valid: false, error: 'Could not validate code. Please try again.' }) };
  }
};
