'use strict';

/**
 * POST /.netlify/functions/stripe-webhook
 *
 * Handles Stripe checkout.session.completed events.
 * On successful payment: updates the matching Airtable appointment to Status = "Confirmed".
 *
 * Set up in Stripe Dashboard → Developers → Webhooks:
 *   Endpoint URL: https://blissdermacare.com/.netlify/functions/stripe-webhook
 *   Events: checkout.session.completed
 * Then set STRIPE_WEBHOOK_SECRET in Netlify env vars.
 */

const Stripe = require('stripe');
const { airtableList, airtablePatch } = require('./_utils.cjs');

const TABLE = () => process.env.AIRTABLE_APPOINTMENTS_TABLE || 'Appointments';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !stripeKey) {
    console.error('Stripe webhook not configured: missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY');
    return { statusCode: 500, body: 'Webhook not configured' };
  }

  let stripeEvent;
  try {
    const stripe = Stripe(stripeKey);
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const sessionId = session.id;
    console.log(`Processing checkout.session.completed for session ${sessionId}`);

    try {
      const data = await airtableList(TABLE(), {
        filterByFormula: `{Stripe Session ID}="${sessionId}"`,
        maxRecords: 1,
      });

      if (data.records && data.records.length > 0) {
        const recordId = data.records[0].id;
        await airtablePatch(TABLE(), recordId, { Status: 'Confirmed' });
        console.log(`✓ Appointment ${recordId} marked Confirmed for session ${sessionId}`);
      } else {
        console.warn(`No appointment found in Airtable for Stripe session ${sessionId}`);
      }
    } catch (err) {
      console.error('Airtable update error in webhook:', err.message);
      // Return 500 so Stripe retries the webhook
      return { statusCode: 500, body: 'Airtable update failed' };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
