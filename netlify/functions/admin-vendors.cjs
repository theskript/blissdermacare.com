'use strict';

/**
 * GET    /.netlify/functions/admin-vendors — list applications + capacity
 * PATCH  /.netlify/functions/admin-vendors — read/unread, readAll, {reconcile:true} (ask Stripe about unpaid applications), or set status (+ optional refund)
 * DELETE /.netlify/functions/admin-vendors — delete an unpaid/refunded application
 */

const Stripe = require('stripe');
const { requireAuth, getSupabase, sendEmail, logAudit, getClientIP } = require('./_utils.cjs');
const { EVENT, countReserved, vendorApprovedEmail, vendorDeclinedEmail, reconcilePending } = require('./_vendor-event.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type, Authorization',
  'Access-Control-Allow-Methods':'GET, PATCH, DELETE, OPTIONS',
};

const reply = (statusCode, obj) => ({ statusCode, headers: CORS, body: JSON.stringify(obj) });
const STATUSES = ['pending', 'approved', 'declined', 'withdrawn'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) { return reply(e.statusCode || 401, { error: e.message }); }

  const sb = getSupabase();
  const audit = (action, details, targetId) =>
    logAudit({ action, username: user.username, role: user.role, details, targetId, ip: getClientIP(event) });

  if (event.httpMethod === 'GET') {
    try {
      const q = event.queryStringParameters || {};
      let query = sb.from('vendor_applications').select('*')
        .eq('event_slug', EVENT.slug).order('created_at', { ascending: false }).limit(500);
      if (q.status)          query = query.eq('status', q.status);
      if (q.unread === 'true') query = query.is('read_at', null);
      if (q.paid === 'true')   query = query.neq('payment_status', 'unpaid');
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const reserved = await countReserved(sb);
      return reply(200, { records: data || [], capacity: EVENT.capacity, reserved });
    } catch (err) {
      console.error('admin-vendors GET error:', err);
      return reply(500, { error: err.message });
    }
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid JSON' }); }

  if (event.httpMethod === 'PATCH') {
    const { id, read, readAll, status, refund, reconcile } = body;

    if (reconcile) {
      if (!process.env.STRIPE_SECRET_KEY) return reply(500, { error: 'STRIPE_SECRET_KEY is not configured' });
      try {
        const result = await reconcilePending(sb, Stripe(process.env.STRIPE_SECRET_KEY), { sinceHours: 24 * 14 });
        audit('Vendor Reconcile', JSON.stringify(result), '');
        return reply(200, { ok: true, ...result });
      } catch (err) {
        console.error('admin-vendors reconcile error:', err);
        return reply(500, { error: err.message });
      }
    }

    if (readAll) {
      const { error } = await sb.from('vendor_applications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      return error ? reply(500, { error: error.message }) : reply(200, { ok: true });
    }
    if (!id) return reply(400, { error: 'id required' });

    if (status === undefined) {
      const { error } = await sb.from('vendor_applications').update({ read_at: read ? new Date().toISOString() : null }).eq('id', id);
      return error ? reply(500, { error: error.message }) : reply(200, { ok: true });
    }

    if (!STATUSES.includes(status)) return reply(400, { error: 'Invalid status' });

    try {
      const { data: app, error: getErr } = await sb.from('vendor_applications').select('*').eq('id', id).single();
      if (getErr || !app) return reply(404, { error: 'Application not found' });

      if (status === 'approved' && app.payment_status !== 'paid') {
        return reply(400, { error: 'Only paid applications can be approved.' });
      }

      const update = { status, read_at: app.read_at || new Date().toISOString() };

      // Refund first: if Stripe fails, nothing changes in our DB.
      if (refund && app.payment_status === 'paid') {
        if (!app.stripe_payment_intent_id) return reply(400, { error: 'No Stripe payment on file to refund.' });
        await Stripe(process.env.STRIPE_SECRET_KEY).refunds.create(
          { payment_intent: app.stripe_payment_intent_id, metadata: { application_id: app.id } },
          { idempotencyKey: `vendor-refund-${app.id}` }
        );
        update.payment_status = 'refunded';
        audit('Vendor Refund', `${app.business_name} — $${(app.amount_paid / 100).toFixed(2)}`, app.id);
      }

      const { error } = await sb.from('vendor_applications').update(update).eq('id', id);
      if (error) throw new Error(error.message);
      audit('Vendor Status', `${app.business_name}: ${app.status} → ${status}`, app.id);

      if (status !== app.status && (status === 'approved' || status === 'declined')) {
        const mail = status === 'approved' ? vendorApprovedEmail(app) : vendorDeclinedEmail(app, update.payment_status === 'refunded');
        await sendEmail({ to: app.email, subject: mail.subject, html: mail.html }).catch(e => console.warn('Vendor email failed:', e.message));
      }
      return reply(200, { ok: true, payment_status: update.payment_status || app.payment_status });
    } catch (err) {
      console.error('admin-vendors PATCH error:', err);
      return reply(500, { error: err.message });
    }
  }

  if (event.httpMethod === 'DELETE') {
    const { id } = body;
    if (!id) return reply(400, { error: 'id required' });
    const { data: app } = await sb.from('vendor_applications').select('payment_status').eq('id', id).maybeSingle();
    if (app && app.payment_status === 'paid') {
      return reply(400, { error: 'This application has a payment on file. Decline & refund it first.' });
    }
    const { error } = await sb.from('vendor_applications').delete().eq('id', id);
    return error ? reply(500, { error: error.message }) : reply(200, { ok: true });
  }

  return reply(405, { error: 'Method not allowed' });
};
