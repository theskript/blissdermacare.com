'use strict';

const Stripe = require('stripe');
const { getSupabase, sendEmail, sendSMS, getNotificationSettings } = require('./_utils.cjs');

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
        const { data: appt } = await sb.from('appointments').select('*').eq('stripe_session_id', session.id).maybeSingle();
        if (appt) {
          await sb.from('appointments').update({ status: 'Confirmed' }).eq('id', appt.id);
          console.log(`Appointment ${appt.id} marked Confirmed`);

          // Notifications
          const ns = await getNotificationSettings();
          const firstName  = (appt.client_name || 'there').split(' ')[0];
          const dateLabel  = appt.date ? new Date(appt.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'your appointment date';

          if (ns.notifyOwnerOnStripePayment) {
            const ownerSms = `💳 Stripe payment confirmed!\n${appt.client_name} · ${appt.client_phone || 'no phone'}\n${appt.services}\n${dateLabel} at ${appt.time}\n$${Number(appt.price || 0).toFixed(2)}`;
            const ownerEmailHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1714;padding:20px 24px;border-radius:8px 8px 0 0"><h1 style="color:#f0ebe6;font-size:20px;margin:0">Payment Confirmed ✓</h1><p style="color:#9e9590;font-size:13px;margin:6px 0 0">Stripe · Bliss Dermacare</p></div><div style="background:#fafaf9;border:1px solid #e8e2dc;border-top:none;padding:24px;border-radius:0 0 8px 8px"><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:8px 0;color:#78716c;width:140px">Client</td><td style="padding:8px 0;font-weight:600;color:#1c1917">${appt.client_name}</td></tr><tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0;color:#1c1917">${appt.client_email || '—'}</td></tr><tr><td style="padding:8px 0;color:#78716c">Phone</td><td style="padding:8px 0;color:#1c1917">${appt.client_phone || '—'}</td></tr><tr><td style="padding:8px 0;color:#78716c">Date</td><td style="padding:8px 0;font-weight:600;color:#1c1917">${dateLabel}</td></tr><tr><td style="padding:8px 0;color:#78716c">Time</td><td style="padding:8px 0;color:#1c1917">${appt.time || '—'}</td></tr><tr><td style="padding:8px 0;color:#78716c">Services</td><td style="padding:8px 0;color:#1c1917">${appt.services || '—'}</td></tr><tr><td style="padding:8px 0;color:#78716c">Amount Paid</td><td style="padding:8px 0;font-weight:600;color:#15803d">$${Number(appt.price || 0).toFixed(2)}</td></tr></table></div></div>`;
            const ownerNotifs = [];
            if (ns.ownerEmails.length) ownerNotifs.push(sendEmail({ to: ns.ownerEmails, subject: `Payment Confirmed — ${appt.client_name} · ${dateLabel}`, html: ownerEmailHtml }));
            for (const ph of ns.ownerPhones) ownerNotifs.push(sendSMS(ph, ownerSms));
            await Promise.allSettled(ownerNotifs);
          }

          if (ns.notifyClientSmsOnBooking && appt.client_phone) {
            const clientSms = `Hi ${firstName}! 💗 Your payment is confirmed and your appointment is locked in — ${appt.services} on ${dateLabel} at ${appt.time}. See you soon! Questions? (813) 534-6839 — Bliss Dermacare`;
            await sendSMS(appt.client_phone, clientSms.substring(0, 1600));
          }
          if (ns.notifyClientEmailOnBooking && appt.client_email) {
            const clientHtml = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1714;padding:20px 24px;border-radius:8px 8px 0 0"><h1 style="color:#f0ebe6;font-size:22px;margin:0">Booking Confirmed!</h1><p style="color:#9e9590;font-size:13px;margin:6px 0 0">Bliss Dermacare · Tampa, FL</p></div><div style="background:#fafaf9;border:1px solid #e8e2dc;border-top:none;padding:24px;border-radius:0 0 8px 8px"><p style="color:#44403c;font-size:15px">Hi ${firstName},</p><p style="color:#44403c;font-size:14px;line-height:1.6">Your payment has been received and your appointment is <strong>confirmed</strong>.</p><div style="background:#fff;border:1px solid #e7e5e4;border-radius:8px;padding:16px;margin:20px 0"><table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:6px 0;color:#78716c;width:100px">Service</td><td style="padding:6px 0;font-weight:600;color:#1c1917">${appt.services}</td></tr><tr><td style="padding:6px 0;color:#78716c">Date</td><td style="padding:6px 0;color:#1c1917">${dateLabel}</td></tr><tr><td style="padding:6px 0;color:#78716c">Time</td><td style="padding:6px 0;color:#1c1917">${appt.time}</td></tr></table></div><p style="color:#44403c;font-size:13px;line-height:1.6">Questions? Call or text <a href="tel:+18135346839" style="color:#c2410c">(813) 534-6839</a>.</p><p style="color:#78716c;font-size:13px;margin-top:24px">— The Bliss Dermacare Team</p></div></div>`;
            await sendEmail({ to: appt.client_email, subject: 'Appointment Confirmed — Bliss Dermacare', html: clientHtml });
          }
        } else {
          console.warn(`No appointment found for Stripe session ${session.id}`);
        }
      } catch (err) {
        console.error('Supabase/notification error in webhook:', err.message);
        return { statusCode: 500, body: 'Processing failed' };
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
