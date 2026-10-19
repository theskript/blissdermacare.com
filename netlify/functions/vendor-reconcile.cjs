'use strict';

/**
 * Scheduled (see netlify.toml): every 10 minutes, ask Stripe about recent unpaid vendor applications and record any that
 * were actually paid. This is what makes vendor payments independent of the Stripe webhook: a vendor who pays and closes
 * the tab, or a missing/failed webhook, is still recorded within minutes (and they and the owners are notified).
 * Idempotent: safe to run as often as you like and alongside the webhook.
 */

const Stripe = require('stripe');
const { getSupabase } = require('./_utils.cjs');
const { reconcilePending } = require('./_vendor-event.cjs');

exports.handler = async () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('vendor-reconcile skipped: STRIPE_SECRET_KEY is not configured');
    return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
  }
  try {
    const result = await reconcilePending(getSupabase(), Stripe(process.env.STRIPE_SECRET_KEY));
    if (result.checked) console.log('vendor-reconcile', JSON.stringify(result));
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error('vendor-reconcile error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
