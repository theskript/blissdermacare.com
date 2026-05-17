'use strict';

// Netlify serverless function — creates a Stripe Checkout session
// Required env var: STRIPE_SECRET_KEY (set in Netlify dashboard)

const Stripe = require('stripe');

// Prices in cents — must mirror the booking page UI
const PRICES = {
  'other':                        100,
  'signature-radiance-facial':   9900,
  'age-defying-renewal':        14900,
  'brightening-peel':           12800,
  'clear-skin-treatment':       11100,
  'diamond-glow':               11500,
  'teen-skincare-facial':        6400,
  'lash-extensions':            15300,
  'lash-extensions-fill':        4300,
  'lash-lift-brow-lamination':   7200,
  'body-and-face-waxing':        5900,
  'brazilian-wax':               8500,
  'vampire-facial-prp':         38000,
  'scalp-therapy':              21300,
  'hairline-restoration':       68000,
  'fresh-start-collection':     28000,
  'radiant-glow-ritual':        66500,
  'ultimate-transformation':   142500,
};

const SERVICE_LABELS = {
  'other':                      'Other / Not Sure',
  'signature-radiance-facial':  'Signature Radiance Facial',
  'age-defying-renewal':        'Age-Defying Renewal',
  'brightening-peel':           'Brightening Peel',
  'clear-skin-treatment':       'Clear Skin Treatment',
  'diamond-glow':               'Diamond Glow',
  'teen-skincare-facial':       'Teen Skincare Facial',
  'lash-extensions':            'Lash Extensions',
  'lash-extensions-fill':       'Lash Extensions Fill',
  'lash-lift-brow-lamination':  'Lash Lift & Brow Lamination',
  'body-and-face-waxing':       'Body & Face Waxing',
  'brazilian-wax':              'Brazilian Wax',
  'vampire-facial-prp':         'Vampire Facial (PRP)',
  'scalp-therapy':              'Scalp Therapy',
  'hairline-restoration':       'Hairline Restoration',
  'fresh-start-collection':     'Fresh Start Collection (3 sessions)',
  'radiant-glow-ritual':        'Radiant Glow Ritual (6 sessions)',
  'ultimate-transformation':    'Ultimate Transformation (12 sessions)',
};

const DISCOUNT_PCT = {
  'none':                    0,
  'first-responder-veteran': 15,
  'teacher-educator':        10,
  'senior-65-plus':          10,
  'student':                 10,
};

const DISCOUNT_LABELS = {
  'first-responder-veteran': 'First Responder / Veteran Discount (15%)',
  'teacher-educator':        'Teacher / Educator Discount (10%)',
  'senior-65-plus':          'Senior 65+ Discount (10%)',
  'student':                 'Student Discount (10%)',
};

const ALLOWED_SERVICES  = new Set(Object.keys(PRICES));
const ALLOWED_DISCOUNTS = new Set(Object.keys(DISCOUNT_PCT));

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
    service        = '',
    discount       = 'none',
    customerName   = '',
    customerEmail  = '',
    customerPhone  = '',
    appointmentDate = '',
    appointmentTime = '',
    notes          = '',
    referral       = '',
    grouponCode    = '',
    confirmPhone   = '',
    confirmText    = '',
    confirmEmail   = '',
  } = body;

  // Server-side validation
  if (!ALLOWED_SERVICES.has(service)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid service selection.' }) };
  }
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid email address is required.' }) };
  }
  if (!appointmentDate || !appointmentTime) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Appointment date and time are required.' }) };
  }

  const discountKey       = ALLOWED_DISCOUNTS.has(discount) ? discount : 'none';
  const basePriceCents    = PRICES[service];
  const discountPct       = DISCOUNT_PCT[discountKey] ?? 0;
  const serviceName       = SERVICE_LABELS[service] || service;
  const discountLabel     = DISCOUNT_LABELS[discountKey];
  const siteUrl           = (process.env.URL || 'https://blissdermacare.com').replace(/\/$/, '');
  const stripe            = Stripe(process.env.STRIPE_SECRET_KEY);

  const apptDesc = `Appointment: ${appointmentDate} at ${appointmentTime} · Bliss Dermacare`;
  const productDesc = discountPct > 0
    ? `${apptDesc} · ${discountLabel} applied (credentials verified at appointment)`
    : apptDesc;

  try {
    const sessionParams = {
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: serviceName, description: productDesc },
          unit_amount: basePriceCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${siteUrl}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/book/cancel`,
      metadata: {
        service,
        serviceName,
        appointmentDate,
        appointmentTime,
        customerName:  customerName.substring(0, 200),
        customerPhone: customerPhone.substring(0, 50),
        discount:      discountKey,
        discountPct:   String(discountPct),
        notes:         notes.substring(0, 500),
        referral:      referral.substring(0, 100),
        grouponCode:   grouponCode.substring(0, 100),
        confirmPhone,
        confirmText,
        confirmEmail,
      },
    };

    // Apply discount as a Stripe coupon so it shows on the hosted checkout page
    if (discountPct > 0) {
      const coupon = await stripe.coupons.create({
        percent_off: discountPct,
        duration: 'once',
        name: discountLabel,
        metadata: { service, discount: discountKey },
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Stripe error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create payment session. Please try again or call (609) 366-0857.' }) };
  }
};
