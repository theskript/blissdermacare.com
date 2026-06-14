'use strict';

// Netlify serverless function — creates a Stripe Checkout session
// Required env var: STRIPE_SECRET_KEY (set in Netlify dashboard)

const Stripe = require('stripe');

// Prices in cents — must mirror the booking page UI
const PRICES = {
  'other':                              100,
  'signature-radiance-facial':         9900,
  'brightening-peel':                 12800,
  'diamond-glow':                     11900,
  'teen-skincare-facial':              6400,
  'high-frequency-skin-tightening':    9500,
  'pumpkin-enzyme-facial':             8500,
  'chlorophyll-skin-tightening-facial':10500,
  'pineapple-enzyme-facial':           8800,
  'skin-recovery-facial':              9200,
  'lash-extensions':                  15900,
  'lash-extensions-fill':              4300,
  'lash-lift-brow-lamination':         7900,
  'body-and-face-waxing':              6500,
  'brazilian-wax':                     8700,
  'spray-tan':                         6500,
  'bronze-bare-glow':                 11000,
  'dermaplane-glow-facial':           10500,
  'smooth-canvas-facial':              8900,
  'vampire-facial-prp':               38000,
  'scalp-therapy':                    21900,
  'hairline-restoration':             68000,
  'lash-body-smooth':                 18500,
  'brow-lash-wax-ritual':             11500,
  'glow-smooth-escape':               13500,
  'mix-match-package':                12900,
};

const SERVICE_LABELS = {
  'other':                             'Other / Not Sure',
  'signature-radiance-facial':         'Signature Radiance Facial',
  'brightening-peel':                  'Brightening Peel',
  'diamond-glow':                      'Diamond Glow',
  'teen-skincare-facial':              'Teen Skincare Facial',
  'high-frequency-skin-tightening':    'High Frequency Skin Tightening',
  'pumpkin-enzyme-facial':             'Pumpkin Enzyme Facial',
  'chlorophyll-skin-tightening-facial':'Chlorophyll Skin Tightening Facial',
  'pineapple-enzyme-facial':           'Pineapple Enzyme Facial',
  'skin-recovery-facial':             'Skin Recovery Facial',
  'lash-extensions':                   'Lash Extensions',
  'lash-extensions-fill':              'Lash Extensions Fill',
  'lash-lift-brow-lamination':         'Lash Lift & Brow Lamination',
  'body-and-face-waxing':              'Body & Face Waxing',
  'brazilian-wax':                     'Brazilian Wax',
  'spray-tan':                         'Custom Airbrush Spray Tan',
  'bronze-bare-glow':                  'Bronze & Bare Glow Package',
  'dermaplane-glow-facial':            'Dermaplane Glow Facial',
  'smooth-canvas-facial':              'Smooth Canvas Facial',
  'vampire-facial-prp':                'Vampire Facial (PRP)',
  'scalp-therapy':                     'Scalp Therapy',
  'hairline-restoration':              'Hairline Restoration',
  'lash-body-smooth':                  'Lash & Body Smooth Package',
  'brow-lash-wax-ritual':              'Brow, Lash & Wax Ritual Package',
  'glow-smooth-escape':                'Glow & Smooth Escape Package',
  'mix-match-package':                 'Mix & Match Escape Package',
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
    services: servicesParam,
    service:  serviceParam     = '',
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

  // Support both services (array) and legacy service (string)
  const serviceList = Array.isArray(servicesParam) && servicesParam.length > 0
    ? servicesParam
    : (serviceParam ? [serviceParam] : []);

  // Server-side validation
  if (serviceList.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please select at least one service.' }) };
  }
  for (const svc of serviceList) {
    if (!ALLOWED_SERVICES.has(svc)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid service selection.' }) };
    }
  }
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid email address is required.' }) };
  }
  if (!appointmentDate || !appointmentTime) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Appointment date and time are required.' }) };
  }

  const discountKey       = ALLOWED_DISCOUNTS.has(discount) ? discount : 'none';
  const basePriceCents    = serviceList.reduce((sum, svc) => sum + (PRICES[svc] || 0), 0);
  const discountPct       = DISCOUNT_PCT[discountKey] ?? 0;
  const serviceNames      = serviceList.map(svc => SERVICE_LABELS[svc] || svc);
  const discountLabel     = DISCOUNT_LABELS[discountKey];
  const siteUrl           = (process.env.URL || 'https://blissdermacare.com').replace(/\/$/, '');
  const stripe            = Stripe(process.env.STRIPE_SECRET_KEY);

  const apptDesc = `Appointment: ${appointmentDate} at ${appointmentTime} · Bliss Dermacare`;

  try {
    const lineItems = serviceList.map((svc, i) => {
      const desc = i === 0
        ? (discountPct > 0
            ? `${apptDesc} · ${discountLabel} applied (credentials verified at appointment)`
            : apptDesc)
        : undefined;
      return {
        price_data: {
          currency: 'usd',
          product_data: { name: SERVICE_LABELS[svc] || svc, ...(desc ? { description: desc } : {}) },
          unit_amount: PRICES[svc],
        },
        quantity: 1,
      };
    });

    const sessionParams = {
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: lineItems,
      mode: 'payment',
      success_url: `${siteUrl}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/book/cancel`,
      metadata: {
        services:     serviceList.join(', '),
        serviceNames: serviceNames.join(', '),
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
        metadata: { services: serviceList.join(', '), discount: discountKey },
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
