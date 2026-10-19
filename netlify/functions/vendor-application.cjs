'use strict';

/**
 * GET  /.netlify/functions/vendor-application — availability tier (no exact counts)
 * POST /.netlify/functions/vendor-application — saves the application (unpaid) and
 *      returns a Stripe Checkout URL for the reservation fee. The webhook marks it paid.
 */

const Stripe = require('stripe');
const { getSupabase } = require('./_utils.cjs');
const { EVENT, CATEGORIES, countReserved, availabilityTier } = require('./_vendor-event.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Cache-Control':               'no-store',
};

const reply = (statusCode, obj) => ({ statusCode, headers: CORS, body: JSON.stringify(obj) });

const clean = (val, max) => {
  const t = String(val ?? '').trim().slice(0, max);
  return t === '' ? null : t;
};
const truthy = (v) => v === true || v === 'true' || v === 'on' || v === 'yes';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  const sb = getSupabase();

  if (event.httpMethod === 'GET') {
    try {
      return reply(200, availabilityTier(await countReserved(sb)));
    } catch (err) {
      console.error('vendor-application GET error:', err);
      return reply(500, { error: 'Could not load availability.' });
    }
  }

  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  // Never take money we can't record: the webhook is what marks an application paid.
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Vendor applications disabled: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is not configured');
    return reply(503, { error: 'Vendor applications are temporarily unavailable. Please call (609) 366-0857 and we will take your application by phone.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid request.' }); }

  if (body.hp) return reply(400, { error: 'Invalid submission.' }); // honeypot

  const record = {
    event_slug:        EVENT.slug,
    business_name:     clean(body.business_name, 150),
    contact_name:      clean(body.contact_name, 100),
    email:             clean(body.email, 200)?.toLowerCase() ?? null,
    phone:             clean(body.phone, 30),
    website:           clean(body.website, 300),
    category:          clean(body.category, 60),
    description:       clean(body.description, 1500),
    license_info:      clean(body.license_info, 300),
    special_requests:  clean(body.special_requests, 500),
  };

  const missing = ['business_name', 'contact_name', 'email', 'phone', 'category', 'description'].filter(k => !record[k]);
  if (missing.length) return reply(400, { error: 'Please complete all required fields.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) return reply(400, { error: 'Please enter a valid email address.' });
  if (!CATEGORIES.includes(record.category)) return reply(400, { error: 'Please choose a valid category.' });
  if (!truthy(body.agree)) return reply(400, { error: 'You must agree to the vendor terms to apply.' });
  if (!truthy(body.agree_samples)) return reply(400, { error: 'You must confirm you will only bring sample-size items.' });

  try {
    if ((await countReserved(sb)) >= EVENT.capacity) {
      return reply(409, { error: 'All vendor spots have been reserved. Call (609) 366-0857 to join the waitlist.' });
    }

    // One application per email per event. Unpaid retries reuse the same row.
    const { data: existing, error: findErr } = await sb.from('vendor_applications')
      .select('id, payment_status')
      .eq('event_slug', EVENT.slug).eq('email', record.email)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (existing && existing.payment_status !== 'unpaid') {
      return reply(409, { error: 'We already have an application from this email. Call (609) 366-0857 if you need help.' });
    }

    const meta = {
      ip:         (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || event.headers['client-ip'] || null,
      user_agent: event.headers['user-agent'] || null,
      referrer:   event.headers['referer'] || null,
    };
    const row = { ...record, ...meta, agreed_terms_at: new Date().toISOString(), agreed_sample_only: true };

    let appId;
    if (existing) {
      const { error } = await sb.from('vendor_applications').update(row).eq('id', existing.id);
      if (error) throw new Error(error.message);
      appId = existing.id;
    } else {
      const { data, error } = await sb.from('vendor_applications').insert(row).select('id').single();
      if (error) throw new Error(error.message);
      appId = data.id;
    }

    const siteUrl = (process.env.URL || 'https://blissdermacare.com').replace(/\/$/, '');
    const metadata = { type: 'vendor_application', application_id: appId, event: EVENT.slug };
    const description = `${EVENT.name} vendor reservation — ${record.business_name}`.slice(0, 200);

    const session = await Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: record.email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Vendor Reservation — ${EVENT.name}`, description: `${EVENT.dateLabel}, ${EVENT.timeLabel} · ${record.business_name}`.slice(0, 300) },
          unit_amount: EVENT.feeCents,
        },
        quantity: 1,
      }],
      success_url: `${siteUrl}/vendors/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/vendors/?payment=cancelled#apply`,
      metadata,
      payment_intent_data: { description, metadata },
    });

    const { error: sessErr } = await sb.from('vendor_applications').update({ stripe_session_id: session.id }).eq('id', appId);
    if (sessErr) console.error('Could not store Stripe session id (webhook still matches by metadata):', sessErr.message);

    return reply(200, { url: session.url });
  } catch (err) {
    console.error('vendor-application error:', err);
    return reply(500, { error: 'Something went wrong. Please try again or call (609) 366-0857.' });
  }
};
