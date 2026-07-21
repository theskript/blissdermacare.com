'use strict';

const { requireAuth, getSupabase, sendSMS, sendEmail, logAudit, getClientIP } = require('./_utils.cjs');

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let user;
  try { user = requireAuth(event); } catch (e) {
    return { statusCode: e.statusCode || 401, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const {
    appointmentId,
    channel = 'sms',
    message = '',
    subject = 'Your Appointment Reminder — Bliss Dermacare',
    overridePhone = '',
    overrideEmail = '',
  } = body;

  if (!appointmentId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'appointmentId required' }) };
  }
  if (!message.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'message is required' }) };
  }
  if (!['sms', 'email', 'both'].includes(channel)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'channel must be sms, email, or both' }) };
  }

  const ip = getClientIP(event);

  try {
    const { data: appt, error: fetchErr } = await getSupabase()
      .from('appointments')
      .select('id,client_name,client_email,client_phone,date,time,services')
      .eq('id', appointmentId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!appt) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Appointment not found' }) };

    const results = { smsSent: false, emailSent: false, errors: [] };
    const phoneTarget = (overridePhone || '').replace(/\D/g,'').length >= 10
      ? overridePhone.trim() : appt.client_phone;
    const emailTarget = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(overrideEmail)
      ? overrideEmail.trim() : appt.client_email;
    const usedOverride = !!(overridePhone || overrideEmail);

    if (channel === 'sms' || channel === 'both') {
      if (phoneTarget) {
        const r = await sendSMS(phoneTarget, message.substring(0, 1600));
        results.smsSent = r?.ok === true;
        if (!results.smsSent) {
          const detail = r?.error ? r.error : 'Salesmsg not configured';
          results.errors.push(`SMS failed: ${detail}`);
        }
      } else {
        results.errors.push('No phone number on file for this client');
      }
    }

    if (channel === 'email' || channel === 'both') {
      if (emailTarget) {
        const r = await sendEmail({
          to: emailTarget,
          subject: subject.substring(0, 200),
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;line-height:1.6">${message.replace(/\n/g, '<br/>')}<br/><br/><p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;margin-top:20px">Bliss Dermacare &middot; 8905 Regents Park Dr, Tampa, FL 33647 &middot; (609) 366-0857</p></div>`,
          text: message,
        });
        results.emailSent = !!r;
        if (!r) results.errors.push('Email not delivered — check SendGrid configuration');
      } else {
        results.errors.push('No email address on file for this client');
      }
    }

    logAudit({
      action: 'Send Reminder',
      username: user.username,
      role: user.role,
      details: `Manual ${channel} reminder${usedOverride ? ' (override recipient)' : ''} for ${appt.client_name || appt.id} (${appt.date} @ ${appt.time})`,
      targetId: appointmentId,
      ip,
    });

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ...results }) };
  } catch (err) {
    console.error('admin-send-reminder error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
