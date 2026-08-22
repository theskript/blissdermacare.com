'use strict';

// Netlify serverless function — creates a Stripe Checkout session
// Required env var: STRIPE_SECRET_KEY (set in Netlify dashboard)

const Stripe = require('stripe');
const { getSupabase, formatTime } = require('./_utils.cjs');

const APPOINTMENTS_TABLE = 'appointments';

// Fetch community discount % from site_content; falls back to defaults if rows missing
async function getDiscountPct() {
  const keys = ['discount_first_responder_veteran','discount_teacher_educator','discount_senior_65_plus','discount_student'];
  const { data } = await getSupabase().from('site_content').select('section_key,value').eq('page_key','global').in('section_key',keys);
  const map = { 'none':0, 'first-responder-veteran':15, 'teacher-educator':10, 'senior-65-plus':10, 'student':10 };
  if (data) for (const r of data) {
    const pct = parseInt(r.value || '0', 10);
    if (r.section_key === 'discount_first_responder_veteran') map['first-responder-veteran'] = pct;
    else if (r.section_key === 'discount_teacher_educator')  map['teacher-educator']  = pct;
    else if (r.section_key === 'discount_senior_65_plus')    map['senior-65-plus']    = pct;
    else if (r.section_key === 'discount_student')           map['student']           = pct;
  }
  return map;
}

const ALLOWED_DISCOUNTS = new Set(['none','first-responder-veteran','teacher-educator','senior-65-plus','student']);

const DISCOUNT_LABELS = {
  'first-responder-veteran': 'First Responder / Veteran Discount',
  'teacher-educator':        'Teacher / Educator Discount',
  'senior-65-plus':          'Senior 65+ Discount',
  'student':                 'Student Discount',
};

// Fetch active, bookable services from DB and build lookup maps
async function getServiceMaps() {
  const { data, error } = await getSupabase()
    .from('services')
    .select('slug, name, price')
    .neq('active', false)
    .neq('is_bookable', false);
  if (error || !data?.length) {
    // Fallback to empty — checkout will reject unknown slugs
    console.error('Failed to load services from DB:', error?.message);
    return { PRICES: {}, SERVICE_LABELS: {}, ALLOWED_SERVICES: new Set() };
  }
  const PRICES         = {};
  const SERVICE_LABELS = {};
  for (const s of data) { PRICES[s.slug] = s.price; SERVICE_LABELS[s.slug] = s.name; }
  return { PRICES, SERVICE_LABELS, ALLOWED_SERVICES: new Set(Object.keys(PRICES)) };
}

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

  // Load services from DB
  const { PRICES, SERVICE_LABELS, ALLOWED_SERVICES } = await getServiceMaps();
  const DISCOUNT_PCT = await getDiscountPct();

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
    promoCode      = '',
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

  // Validate promo code server-side
  let promoInfo = null;
  let promoDiscountCents = 0;
  if (promoCode) {
    const { data: promo } = await getSupabase()
      .from('promo_codes')
      .select('id, code, type, value, max_uses, uses, expires_at, min_subtotal')
      .eq('code', promoCode.trim().toUpperCase())
      .eq('active', true)
      .maybeSingle();
    if (promo
        && (!promo.expires_at || new Date(promo.expires_at) > new Date())
        && (promo.max_uses == null || promo.uses < promo.max_uses)
        && (promo.min_subtotal == null || basePriceCents >= promo.min_subtotal)) {
      promoDiscountCents = promo.type === 'percent'
        ? Math.round(basePriceCents * promo.value / 100)
        : Math.min(promo.value, basePriceCents);
      promoInfo = promo;
    }
  }

  // Community discount applied after promo
  const afterPromoCents      = basePriceCents - promoDiscountCents;
  const communityDiscountCents = Math.round(afterPromoCents * discountPct / 100);
  const totalDiscountCents   = promoDiscountCents + communityDiscountCents;
  const finalPriceCents      = basePriceCents - totalDiscountCents;
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
        promoCode:     promoInfo?.code || '',
        notes:         notes.substring(0, 500),
        referral:      referral.substring(0, 100),
        grouponCode:   grouponCode.substring(0, 100),
        confirmPhone,
        confirmText,
        confirmEmail,
      },
    };

    // Single combined coupon for all discounts (Stripe only allows one)
    if (totalDiscountCents > 0) {
      const parts = [];
      if (promoInfo) parts.push(`Promo: ${promoInfo.code}`);
      if (discountPct > 0) parts.push(discountLabel);
      const coupon = await stripe.coupons.create({
        amount_off: totalDiscountCents,
        currency:   'usd',
        duration:   'once',
        name:       parts.join(' + ') || 'Discount',
        metadata:   { services: serviceList.join(', '), discount: discountKey, promoCode: promoInfo?.code || '' },
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    const discountedCents = finalPriceCents;
    const sourceMap = { groupon: 'Groupon', classpass: 'ClassPass' };
    const discountSummary = [discountLabel, promoInfo ? `Promo: ${promoInfo.code}` : ''].filter(Boolean).join(', ') || 'None';

    try {
      getSupabase().from(APPOINTMENTS_TABLE).insert({
        client_name:       customerName,
        client_email:      customerEmail,
        client_phone:      customerPhone,
        date:              appointmentDate,
        time:              formatTime(appointmentTime),
        services:          serviceNames.join(', '),
        status:            'Pending Payment',
        price:             discountedCents / 100,
        notes:             notes,
        source:            sourceMap[referral] || 'Website',
        discount:          discountSummary,
        referral:          referral,
        groupon_code:      grouponCode,
        stripe_session_id: session.id,
        payment_method:    'stripe',
        confirm_phone:     confirmPhone === 'yes',
        confirm_text:      confirmText  === 'yes',
        confirm_email:     confirmEmail === 'yes',
      }).then(({ error }) => { if (error) console.error('Supabase write error (non-fatal):', error.message); });
    } catch (dbErr) {
      console.error('Supabase init error (non-fatal):', dbErr.message);
    }

    // Increment promo code uses (non-blocking)
    if (promoInfo) {
      getSupabase().from('promo_codes').update({ uses: promoInfo.uses + 1 }).eq('id', promoInfo.id).then(() => {});
    }

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('Stripe error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to create payment session. Please try again or call (609) 366-0857.' }) };
  }
};
