'use strict';

/**
 * POST /.netlify/functions/consultation-submission
 * Saves a skincare consultation request to Supabase.
 */

const { getSupabase, sendSMS, sendEmail, getNotificationSettings } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};

function nullIfEmpty(val) {
  const t = (val || '').trim();
  return t === '' ? null : t;
}

function toArray(val) {
  if (Array.isArray(val)) return val.length ? val : null;
  if (val && typeof val === 'string' && val.trim()) return [val.trim()];
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, phone } = body;
  if (!name || !email || !phone) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name, email, and phone are required' }) };
  }

  const record = {
    name:               nullIfEmpty(name),
    email:              nullIfEmpty(email)?.toLowerCase(),
    phone:              nullIfEmpty(phone),
    skin_type:          nullIfEmpty(body['skin-type'] || body.skin_type),
    concerns:           toArray(body.concerns),
    current_routine:    nullIfEmpty(body['current-routine'] || body.current_routine),
    goals:              nullIfEmpty(body.goals),
    contact_preference: nullIfEmpty(body['contact-preference'] || body.contact_preference),
    ip:                 (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || event.headers['client-ip'] || null,
    user_agent:         event.headers['user-agent'] || null,
    referrer:           event.headers['referer']    || null,
    created_at:         new Date().toISOString(),
  };

  try {
    const { error } = await getSupabase().from('consultation_submissions').insert(record);
    if (error) throw new Error(error.message);

    // Owner notification (non-fatal)
    try {
      const ns = await getNotificationSettings();
      const concernsList = (record.concerns || []).join(', ') || '—';
      const bodyText = `✨ Consultation Request\n${record.name}\n📱 ${record.phone}\n✉️ ${record.email}\nSkin: ${record.skin_type || '—'} · Concerns: ${concernsList}\nContact via: ${record.contact_preference || '—'}`;
      if (ns.sms_enabled && ns.owner_phone) await sendSMS(ns.owner_phone, bodyText);
      if (ns.email_enabled && ns.owner_email) {
        await sendEmail(ns.owner_email, 'New Consultation Request — Bliss Dermacare', `<p>${bodyText.replace(/\n/g, '<br>')}</p>`);
      }
    } catch (notifErr) {
      console.warn('Consultation notification failed (non-fatal):', notifErr.message);
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('consultation-submission error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
