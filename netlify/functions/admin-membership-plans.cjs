'use strict';

/**
 * GET    — list membership plans
 * POST   — create plan (owner only)
 * PATCH  — update plan; if price changes, creates a new Stripe recurring Price (owner only)
 * DELETE — deactivate plan (owner only)
 */

const Stripe = require('stripe');
const { requireAuth, getSupabase, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
  'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  const sb = getSupabase();
  const ip = getClientIP(event);

  try {
    // ── GET ───────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const { data, error } = await sb
        .from('membership_plans')
        .select('*')
        .order('sort_order');
      if (error) throw new Error(error.message);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ plans: data || [] }) };
    }

    if (user.role !== 'owner') {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Owner access required' }) };
    }

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    // ── POST — create ────────────────────────────────────────────────────────
    if (event.httpMethod === 'POST') {
      const { slug, name, price, description, perks, sort_order, active } = body;
      if (!slug || !name || !price) {
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'slug, name, and price are required' }) };
      }
      const priceInt = parseInt(price, 10);
      let stripePriceId = null, stripeProductId = null;

      // Create Stripe product + recurring price
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        const product = await stripe.products.create({ name, description: description || name });
        const stripePrice = await stripe.prices.create({
          product: product.id,
          unit_amount: priceInt,
          currency: 'usd',
          recurring: { interval: 'month' },
        });
        stripePriceId   = stripePrice.id;
        stripeProductId = product.id;
      } catch (stripeErr) {
        console.warn('Stripe product/price creation failed (non-fatal):', stripeErr.message);
      }

      const { data, error } = await sb.from('membership_plans').insert({
        slug, name, price: priceInt, description, perks: perks || [],
        sort_order: sort_order || 0, active: active !== false,
        stripe_price_id: stripePriceId, stripe_product_id: stripeProductId,
        updated_at: new Date().toISOString(),
      }).select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Create Membership Plan', username: user.username, role: user.role, targetId: data.id, details: { name, price: priceInt }, ip });
      return { statusCode: 201, headers: CORS, body: JSON.stringify(data) };
    }

    // ── PATCH — update ───────────────────────────────────────────────────────
    if (event.httpMethod === 'PATCH') {
      const { id, ...rest } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) };

      // Fetch current plan
      const { data: current } = await sb.from('membership_plans').select('*').eq('id', id).single();
      if (!current) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Plan not found' }) };

      const fields = {};
      if (rest.name        !== undefined) fields.name        = rest.name;
      if (rest.description !== undefined) fields.description = rest.description;
      if (rest.perks       !== undefined) fields.perks       = rest.perks;
      if (rest.sort_order  !== undefined) fields.sort_order  = rest.sort_order;
      if (rest.active      !== undefined) fields.active      = rest.active;

      // Price change → create new Stripe recurring Price
      if (rest.price !== undefined) {
        const newPrice = parseInt(rest.price, 10);
        if (newPrice !== current.price) {
          try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            let productId = current.stripe_product_id;
            if (!productId) {
              const product = await stripe.products.create({ name: current.name });
              productId = product.id;
              fields.stripe_product_id = productId;
            }
            // Archive old price
            if (current.stripe_price_id) {
              await stripe.prices.update(current.stripe_price_id, { active: false }).catch(() => {});
            }
            const newStripePrice = await stripe.prices.create({
              product:   productId,
              unit_amount: newPrice,
              currency:  'usd',
              recurring: { interval: 'month' },
            });
            fields.stripe_price_id = newStripePrice.id;
          } catch (stripeErr) {
            console.warn('Stripe price update failed (non-fatal):', stripeErr.message);
          }
          fields.price = newPrice;
        }
      }

      fields.updated_at = new Date().toISOString();
      const { data, error } = await sb.from('membership_plans').update(fields).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      await logAudit(sb, { action: 'Update Membership Plan', username: user.username, role: user.role, targetId: id, details: fields, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };
    }

    // ── DELETE — deactivate (soft delete) ─────────────────────────────────────
    if (event.httpMethod === 'DELETE') {
      const { id } = body;
      if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'id is required' }) };
      await sb.from('membership_plans').update({ active: false, updated_at: new Date().toISOString() }).eq('id', id);
      await logAudit(sb, { action: 'Deactivate Membership Plan', username: user.username, role: user.role, targetId: id, details: {}, ip });
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ deactivated: true, id }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('admin-membership-plans error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
