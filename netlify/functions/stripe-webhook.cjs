'use strict';

const Stripe = require('stripe');
const { getSupabase } = require('./_utils.cjs');

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

  if (stripeEvent.type === 'checkout.session.completed') {
    const sessionId = stripeEvent.data.object.id;
    console.log(`Processing checkout.session.completed for session ${sessionId}`);
    try {
      const { data: appt } = await getSupabase()
        .from('appointments')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();

      if (appt) {
        const { error } = await getSupabase().from('appointments').update({ status: 'Confirmed' }).eq('id', appt.id);
        if (error) throw new Error(error.message);
        console.log(`Appointment ${appt.id} marked Confirmed`);
      } else {
        console.warn(`No appointment found for Stripe session ${sessionId}`);
      }
    } catch (err) {
      console.error('Supabase update error in webhook:', err.message);
      return { statusCode: 500, body: 'DB update failed' };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
