'use strict';

/**
 * Shared config + helpers for the vendor application flow.
 * Used by vendor-application, stripe-webhook and admin-vendors.
 */

const { sendEmail, sendSMS, getNotificationSettings } = require('./_utils.cjs');

const EVENT = {
  slug:      'health-financial-wellness-2026',
  name:      'Health & Financial Wellness Event',
  dateLabel: 'Friday, November 6, 2026',
  timeLabel: '10:00 AM – 1:00 PM',
  location:  'Bliss Dermacare · 8905 Regents Park Dr, Tampa, FL 33647',
  capacity:  15,
  feeCents:  2500,
};

const CATEGORIES = [
  'Health & Wellness',
  'Financial Services',
  'Beauty & Skincare',
  'Food & Beverage',
  'Nonprofit / Community',
  'Other',
];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Only paid, still-active applications hold one of the limited spots.
async function countReserved(sb) {
  const { count, error } = await sb
    .from('vendor_applications')
    .select('id', { count: 'exact', head: true })
    .eq('event_slug', EVENT.slug)
    .eq('payment_status', 'paid')
    .in('status', ['pending', 'approved']);
  if (error) throw new Error(error.message);
  return count || 0;
}

// Public-facing availability. Derived from real reservations; exact counts are never exposed.
function availabilityTier(reserved) {
  const pct = reserved / EVENT.capacity;
  if (reserved >= EVENT.capacity) return { tier: 'full', open: false, label: 'All vendor spots reserved' };
  if (pct >= 0.5) {
    const over = Math.min(Math.floor(pct * 10) * 10, 90);
    return { tier: pct >= 0.8 ? 'almost' : 'filling', open: true, label: pct >= 0.8 ? `Almost full — over ${over}% reserved` : `Filling fast — over ${over}% reserved` };
  }
  if (pct >= 1 / 3) return { tier: 'filling', open: true, label: 'Filling fast — limited vendor spots' };
  return { tier: 'limited', open: true, label: 'Limited vendor spots available' };
}

const SAMPLE_POLICY = 'Sample-size items only: trial/travel sizes, single-use packets, or small tasting portions. Full-size products are not permitted at vendor tables.';

function emailShell(heading, bodyHtml) {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#1a1714;padding:20px 24px;border-radius:8px 8px 0 0"><h1 style="color:#f0ebe6;font-size:20px;margin:0">${esc(heading)}</h1><p style="color:#9e9590;font-size:13px;margin:6px 0 0">${esc(EVENT.name)} · Bliss Dermacare</p></div><div style="background:#fafaf9;border:1px solid #e8e2dc;border-top:none;padding:24px;border-radius:0 0 8px 8px;color:#44403c;font-size:14px;line-height:1.6">${bodyHtml}<p style="color:#78716c;font-size:13px;margin-top:24px">Questions? Call or text <a href="tel:+16093660857" style="color:#c2410c">(609) 366-0857</a>.<br>— The Bliss Dermacare Team</p></div></div>`;
}

const eventBlock = () =>
  `<div style="background:#fff;border:1px solid #e7e5e4;border-radius:8px;padding:14px 16px;margin:16px 0"><strong>${esc(EVENT.name)}</strong><br>${esc(EVENT.dateLabel)} · ${esc(EVENT.timeLabel)}<br>${esc(EVENT.location)}</div>`;

function vendorPaidEmail(app) {
  return {
    subject: `Application received — ${EVENT.name}`,
    html: emailShell('Application received ✓', `<p>Hi ${esc(app.contact_name.split(' ')[0])},</p><p>Thanks for applying to vend with <strong>${esc(app.business_name)}</strong>. Your $${(EVENT.feeCents / 100).toFixed(2)} reservation fee has been received and your application is now under review.</p>${eventBlock()}<p>We'll confirm your spot by email soon. If we're unable to offer you a space, your reservation fee will be <strong>refunded in full</strong>.</p><p><strong>Reminder:</strong> ${esc(SAMPLE_POLICY)}</p>`),
  };
}

function vendorApprovedEmail(app) {
  return {
    subject: `You're in! ${EVENT.name} — vendor spot confirmed`,
    html: emailShell("You're in! 🎉", `<p>Hi ${esc(app.contact_name.split(' ')[0])},</p><p>Great news — <strong>${esc(app.business_name)}</strong> has been approved as a vendor.</p>${eventBlock()}<p>We'll email setup and load-in details closer to the event. Just reply to this email if anything changes on your end.</p><p><strong>Reminder:</strong> ${esc(SAMPLE_POLICY)}</p>`),
  };
}

function vendorDeclinedEmail(app, refunded) {
  const refundLine = refunded
    ? `Your $${(EVENT.feeCents / 100).toFixed(2)} reservation fee has been <strong>refunded in full</strong> to your original payment method (allow 5–10 business days to appear).`
    : 'If you paid a reservation fee, it will be refunded to your original payment method.';
  return {
    subject: `Update on your vendor application — ${EVENT.name}`,
    html: emailShell('Vendor application update', `<p>Hi ${esc(app.contact_name.split(' ')[0])},</p><p>Thank you for applying to vend with <strong>${esc(app.business_name)}</strong>. Unfortunately we're unable to offer you a space at this event.</p><p>${refundLine}</p><p>We'd love to have you in the loop for future events.</p>`),
  };
}

// Marks the application paid (idempotent) and sends notifications. Throws only on DB failure so Stripe retries.
async function handleVendorPayment(sb, session) {
  const id = session.metadata && session.metadata.application_id;
  if (!id) { console.warn('Vendor payment without application_id', session.id); return; }

  const { data: app, error } = await sb.from('vendor_applications')
    .update({
      payment_status:           'paid',
      amount_paid:              session.amount_total,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      stripe_session_id:        session.id,
      paid_at:                  new Date().toISOString(),
    })
    .eq('id', id)
    .eq('payment_status', 'unpaid')
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!app) { console.log(`Vendor application ${id} already processed or missing`); return; }

  const reserved = await countReserved(sb).catch(() => null);
  const overCap  = reserved !== null && reserved > EVENT.capacity;

  const results = [];
  const v = vendorPaidEmail(app);
  results.push(sendEmail({ to: app.email, subject: v.subject, html: v.html }));

  const ns = await getNotificationSettings();
  if (ns.notifyOwnerOnStripePayment) {
    const sms = `🏪 New vendor application (paid)\n${app.business_name} — ${app.category}\n${app.contact_name} · ${app.phone}\n${app.email}${overCap ? `\n⚠️ Over capacity (${reserved}/${EVENT.capacity}) — consider refunding` : ''}`;
    const html = emailShell('New vendor application', `<table style="width:100%;border-collapse:collapse;font-size:14px">${[
      ['Business', app.business_name], ['Category', app.category], ['Contact', app.contact_name],
      ['Email', app.email], ['Phone', app.phone], ['Website', app.website || '—'],
      ['Reservation fee', `$${(app.amount_paid / 100).toFixed(2)} paid`],
    ].map(([k, val]) => `<tr><td style="padding:6px 0;color:#78716c;width:140px">${k}</td><td style="padding:6px 0;color:#1c1917">${esc(val)}</td></tr>`).join('')}</table>${overCap ? `<p style="color:#b91c1c"><strong>⚠️ Over capacity (${reserved}/${EVENT.capacity}).</strong> Consider declining &amp; refunding.</p>` : ''}<p>Review it in the admin panel under People → Vendors.</p>`);
    if (ns.ownerEmails.length) results.push(sendEmail({ to: ns.ownerEmails, subject: `New vendor application — ${app.business_name}`, html }));
    for (const ph of ns.ownerPhones) results.push(sendSMS(ph, sms));
  }
  await Promise.allSettled(results);
}

// ── Reconciliation: record payments by asking Stripe directly, so recording never depends on the webhook ──────────
// handleVendorPayment is idempotent (UPDATE ... WHERE payment_status='unpaid'), so webhook + reconcile racing is safe:
// exactly one of them wins and only the winner sends messages.
const SESSION_GRACE_MS = 60 * 60 * 1000; // an open checkout younger than this is still in progress: do not search yet

async function findPaidPaymentIntent(stripe, app) {
  const r = await stripe.paymentIntents.search({ query: `metadata['application_id']:'${app.id}' AND status:'succeeded'`, limit: 1 });
  return (r && r.data && r.data[0]) || null;
}

// Returns { state: 'paid' | 'pending' | 'expired' | 'skipped' | 'error' }
async function reconcileVendorSession(sb, stripe, app) {
  if (!app) return { state: 'skipped' };
  if (app.payment_status === 'paid' || app.payment_status === 'refunded') return { state: 'paid' };
  if (!app.stripe_session_id) return { state: 'skipped' };
  try {
    const session = await stripe.checkout.sessions.retrieve(app.stripe_session_id);
    if (session.payment_status === 'paid' && session.metadata && session.metadata.application_id === app.id) {
      await handleVendorPayment(sb, session);
      return { state: 'paid' };
    }
    const inProgress = session.status === 'open' && Date.now() - new Date(app.agreed_terms_at).getTime() < SESSION_GRACE_MS;
    if (inProgress) return { state: 'pending' };
    // The applicant may have paid an EARLIER checkout (retry = new session). Every PaymentIntent carries application_id.
    const pi = await findPaidPaymentIntent(stripe, app);
    if (pi) {
      await handleVendorPayment(sb, { id: app.stripe_session_id, amount_total: pi.amount_received ?? pi.amount, payment_intent: pi.id, metadata: { type: 'vendor_application', application_id: app.id } });
      return { state: 'paid' };
    }
    return { state: session.status === 'expired' ? 'expired' : 'pending' };
  } catch (err) {
    console.warn(`Vendor reconcile failed for ${app.id}:`, err.message);
    return { state: 'error' };
  }
}

// Checks every recently-submitted unpaid application that has a Stripe session. Used by the scheduled job and the admin button.
async function reconcilePending(sb, stripe, { sinceHours = 72, limit = 50 } = {}) {
  const since = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
  const { data, error } = await sb.from('vendor_applications').select('*')
    .eq('event_slug', EVENT.slug).eq('payment_status', 'unpaid').not('stripe_session_id', 'is', null)
    .gte('agreed_terms_at', since).order('agreed_terms_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  const out = { checked: (data || []).length, recorded: 0, pending: 0, expired: 0, errors: 0 };
  for (const app of data || []) {
    const { state } = await reconcileVendorSession(sb, stripe, app);
    if (state === 'paid') out.recorded++; else if (state === 'pending') out.pending++; else if (state === 'expired') out.expired++; else if (state === 'error') out.errors++;
  }
  return out;
}

module.exports = {
  EVENT, CATEGORIES, SAMPLE_POLICY, esc, countReserved, availabilityTier,
  vendorApprovedEmail, vendorDeclinedEmail, handleVendorPayment,
  reconcileVendorSession, reconcilePending,
};
