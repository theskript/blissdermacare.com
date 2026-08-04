'use strict';

// Netlify serverless function — creates a Stripe Checkout Session for memberships/subscriptions
// Plan config is now loaded from the membership_plans Supabase table.

const Stripe    = require('stripe');
const { getSupabase } = require('./_utils.cjs');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not configured');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment system is not configured. Please call us to book.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const {
    plan          = '',
    customerName  = '',
    customerEmail = '',
    customerPhone = '',
    notes         = '',
  } = body;

  // Load plan from DB
  const { data: planInfo, error: planErr } = await getSupabase()
    .from('membership_plans')
    .select('slug, name, price, description, stripe_price_id')
    .eq('slug', plan)
    .eq('active', true)
    .single();

  if (planErr || !planInfo) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid or inactive membership plan.' }) };
  }

  // Validate email
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid email address is required.' }) };
  }

  const priceId = planInfo.stripe_price_id;
  const siteUrl = (process.env.URL || 'https://blissdermacare.com').replace(/\/$/, '');
  const stripe  = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    let sessionParams;

    const meta = {
      plan,
      planLabel:     planInfo.name,
      customerName:  customerName.substring(0, 200),
      customerPhone: customerPhone.substring(0, 50),
      notes:         notes.substring(0, 500),
    };

    if (priceId) {
      sessionParams = {
        payment_method_types: ['card'],
        customer_email: customerEmail,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        subscription_data: { metadata: meta },
        success_url: `${siteUrl}/memberships/success?plan=${encodeURIComponent(plan)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${siteUrl}/memberships/#plans`,
        metadata: meta,
      };
    } else {
      console.warn(`No Stripe Price ID configured for plan: ${plan}. Falling back to inline price.`);
      sessionParams = {
        payment_method_types: ['card'],
        customer_email: customerEmail,
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: { name: planInfo.name, description: planInfo.description || planInfo.name },
            unit_amount: planInfo.price,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${siteUrl}/memberships/success?plan=${encodeURIComponent(plan)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${siteUrl}/memberships/#plans`,
        metadata: meta,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create membership session. Please try again or call (609) 366-0857.' }),
    };
  }
};
