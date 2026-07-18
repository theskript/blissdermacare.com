'use strict';

// Netlify serverless function — creates a Stripe Checkout Session for memberships/subscriptions
//
// Required env vars (set in Netlify dashboard):
//   STRIPE_SECRET_KEY            — your Stripe secret key
//   STRIPE_PRICE_GLOW_RITUAL     — Stripe Price ID for The Glow Ritual ($89/mo recurring)
//   STRIPE_PRICE_RADIANCE_PLAN   — Stripe Price ID for The Radiance Plan ($159/mo recurring)
//   STRIPE_PRICE_VIP_LUXE        — Stripe Price ID for The Bliss VIP ($249/mo recurring)
//
// How to create these Price IDs in Stripe:
//   Dashboard → Products → Add product → Add price (recurring, monthly)
//   Copy the price_XXXX ID and add it as the env var above.

const Stripe = require('stripe');

const PLAN_CONFIG = {
  'glow-ritual': {
    label:   'The Glow Ritual Membership',
    price:   8900, // $89.00/mo in cents
    envKey:  'STRIPE_PRICE_GLOW_RITUAL',
    desc:    '1 facial credit/month (up to $99 value) + 10% off additional services. Priority booking. Credits roll over 30 days.',
  },
  'radiance-plan': {
    label:   'The Radiance Plan Membership',
    price:  15900, // $159.00/mo in cents
    envKey:  'STRIPE_PRICE_RADIANCE_PLAN',
    desc:    '1 premium facial credit (up to $128) + 1 lash/brow/body credit (up to $87)/month + 15% off additional services. Priority booking.',
  },
  'vip-luxe': {
    label:   'The Bliss VIP Membership',
    price:  24900, // $249.00/mo in cents
    envKey:  'STRIPE_PRICE_VIP_LUXE',
    desc:    '1 premium facial + 1 lash + 1 body credit/month + 20% off all services + quarterly bonus package. VIP priority booking.',
  },
};

const ALLOWED_PLANS = new Set(Object.keys(PLAN_CONFIG));

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

  // Validate plan
  if (!ALLOWED_PLANS.has(plan)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid membership plan.' }) };
  }

  // Validate email
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid email address is required.' }) };
  }

  const planInfo = PLAN_CONFIG[plan];
  const priceId  = process.env[planInfo.envKey];
  const siteUrl  = (process.env.URL || 'https://blissdermacare.com').replace(/\/$/, '');
  const stripe   = Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    let sessionParams;

    if (priceId) {
      // Use pre-created recurring Stripe Price (preferred — shows correct recurring billing UI)
      sessionParams = {
        payment_method_types: ['card'],
        customer_email: customerEmail,
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        subscription_data: {
          metadata: {
            plan,
            planLabel:     planInfo.label,
            customerName:  customerName.substring(0, 200),
            customerPhone: customerPhone.substring(0, 50),
            notes:         notes.substring(0, 500),
          },
        },
        success_url: `${siteUrl}/memberships/success?plan=${encodeURIComponent(plan)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${siteUrl}/memberships/#plans`,
        metadata: {
          plan,
          planLabel:     planInfo.label,
          customerName:  customerName.substring(0, 200),
          customerPhone: customerPhone.substring(0, 50),
          notes:         notes.substring(0, 500),
        },
      };
    } else {
      // Fallback: one-time payment with clear description if no Price ID is configured yet
      // Owner should set up proper recurring Price IDs in Stripe for production
      console.warn(`No Stripe Price ID configured for plan: ${plan} (env: ${planInfo.envKey}). Falling back to one-time payment.`);
      sessionParams = {
        payment_method_types: ['card'],
        customer_email: customerEmail,
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: planInfo.label,
              description: planInfo.desc,
            },
            unit_amount:    planInfo.price,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${siteUrl}/memberships/success?plan=${encodeURIComponent(plan)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${siteUrl}/memberships/#plans`,
        metadata: {
          plan,
          planLabel:     planInfo.label,
          customerName:  customerName.substring(0, 200),
          customerPhone: customerPhone.substring(0, 50),
          notes:         notes.substring(0, 500),
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Stripe error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create membership session. Please try again or call (813) 766-6416.' }),
    };
  }
};
