'use strict';

/**
 * POST /.netlify/functions/careers-submission
 * Saves a career application to Supabase.
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

  const { name, email, phone, role, experience, why_bliss, availability } = body;
  if (!name || !email || !phone || !role) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name, email, phone, and role are required' }) };
  }

  const record = {
    name:           nullIfEmpty(name),
    email:          nullIfEmpty(email)?.toLowerCase(),
    phone:          nullIfEmpty(phone),
    role:           nullIfEmpty(role),
    license_number: nullIfEmpty(body.license_number),
    experience:     nullIfEmpty(experience),
    why_bliss:      nullIfEmpty(why_bliss),
    portfolio_url:  nullIfEmpty(body.portfolio_url),
    availability:   nullIfEmpty(availability),
    ip:             (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || event.headers['client-ip'] || null,
    user_agent:     event.headers['user-agent'] || null,
    referrer:       event.headers['referer']    || null,
    created_at:     new Date().toISOString(),
  };

  try {
    const { error } = await getSupabase().from('career_submissions').insert(record);
    if (error) throw new Error(error.message);

    // Owner notification (non-fatal)
    try {
      const ns = await getNotificationSettings();
      const bodyText = `💼 Career Application\n${record.name} — ${record.role}\n📱 ${record.phone}\n✉️ ${record.email}\nAvailability: ${record.availability || '—'}`;
      if (ns.sms_enabled && ns.owner_phone) await sendSMS(ns.owner_phone, bodyText);
      if (ns.email_enabled && ns.owner_email) {
        await sendEmail(ns.owner_email, 'New Career Application — Bliss Dermacare', `<p>${bodyText.replace(/\n/g, '<br>')}</p>`);
      }
    } catch (notifErr) {
      console.warn('Careers notification failed (non-fatal):', notifErr.message);
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('careers-submission error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
