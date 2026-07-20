'use strict';

const Stripe = require('stripe');
const { getSupabase } = require('./_utils.cjs');

const PLAN_LABELS = {
  'glow-ritual':   'The Glow Ritual',
  'radiance-plan': 'The Radiance Plan',
  'vip-luxe':      'The Bliss VIP',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !stripeKey) {
    console.error('Stripe webhook not configured');
    return { statusCode: 500, body: 'Webhook not configured' };
  }

  let stripeEvent;
  try {
    stripeEvent = Stripe(stripeKey).webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const sb = getSupabase();

  // ── checkout.session.completed ────────────────────────────────────────────
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    // One-time appointment payment
    if (session.mode === 'payment') {
      try {
        const { data: appt } = await sb.from('appointments').select('id').eq('stripe_session_id', session.id).maybeSingle();
        if (appt) {
          const { error } = await sb.from('appointments').update({ status: 'Confirmed' }).eq('id', appt.id);
          if (error) throw new Error(error.message);
          console.log(`Appointment ${appt.id} marked Confirmed`);
        } else {
          console.warn(`No appointment found for Stripe session ${session.id}`);
        }
      } catch (err) {
        console.error('Supabase update error in webhook:', err.message);
        return { statusCode: 500, body: 'DB update failed' };
      }
    }

    // Subscription / membership
    if (session.mode === 'subscription' && session.subscription) {
      try {
        const meta = session.metadata || {};
        const plan = meta.plan || '';
        await sb.from('memberships').upsert({
          email:                  (session.customer_email || '').toLowerCase().trim(),
          customer_name:          meta.customerName || '',
          plan,
          plan_label:             meta.planLabel || PLAN_LABELS[plan] || plan,
          stripe_customer_id:     session.customer || null,
          stripe_subscription_id: session.subscription,
          stripe_session_id:      session.id,
          status:                 'active',
          updated_at:             new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' });
        console.log(`Membership created for ${session.customer_email} — ${plan}`);
      } catch (err) {
        console.error('Memberships insert error:', err.message);
      }
    }
  }

  // ── customer.subscription.updated ────────────────────────────────────────
  if (stripeEvent.type === 'customer.subscription.updated') {
    const sub = stripeEvent.data.object;
    try {
      await sb.from('memberships').update({
        status:             sub.status,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        updated_at:         new Date().toISOString(),
      }).eq('stripe_subscription_id', sub.id);
      console.log(`Membership ${sub.id} status → ${sub.status}`);
    } catch (err) {
      console.error('Memberships update error:', err.message);
    }
  }

  // ── customer.subscription.deleted ────────────────────────────────────────
  if (stripeEvent.type === 'customer.subscription.deleted') {
    const sub = stripeEvent.data.object;
    try {
      await sb.from('memberships').update({
        status:     'cancelled',
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', sub.id);
      console.log(`Membership ${sub.id} cancelled`);
    } catch (err) {
      console.error('Memberships cancel error:', err.message);
    }
  }

  // ── invoice.payment_failed ────────────────────────────────────────────────
  if (stripeEvent.type === 'invoice.payment_failed') {
    const invoice = stripeEvent.data.object;
    if (invoice.subscription) {
      try {
        await sb.from('memberships').update({
          status:     'past_due',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', invoice.subscription);
        console.log(`Membership ${invoice.subscription} marked past_due`);
      } catch (err) {
        console.error('Memberships past_due error:', err.message);
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
