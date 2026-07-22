'use strict';

/**
 * POST /.netlify/functions/pre-service-form
 * Saves a pre-service questionnaire submission to Supabase.
 */

const { getSupabase, sendSMS, sendEmail, getNotificationSettings } = require('./_utils.cjs');

const CORS = {
  'Content-Type':                'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};

function toArray(val) {
  if (Array.isArray(val)) return val.length ? val : null;
  if (val && typeof val === 'string' && val.trim()) return [val.trim()];
  return null;
}

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

  // Required fields
  const { name, email, phone, appointment_date } = body;
  if (!name || !email || !phone || !appointment_date) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name, email, phone, and appointment_date are required' }) };
  }

  const record = {
    name:                          nullIfEmpty(name),
    appointment_date:              nullIfEmpty(appointment_date),
    appointment_time:              nullIfEmpty(body.appointment_time),
    service_requested:             nullIfEmpty(body.service_requested),
    phone:                         nullIfEmpty(phone),
    email:                         nullIfEmpty(email)?.toLowerCase(),
    age_category:                  nullIfEmpty(body.age_category),
    guardian_name:                 nullIfEmpty(body.guardian_name),
    guardian_relationship:         nullIfEmpty(body.guardian_relationship),
    guardian_phone:                nullIfEmpty(body.guardian_phone),
    guardian_email:                nullIfEmpty(body.guardian_email),
    guardian_id_type:              nullIfEmpty(body.guardian_id_type),
    guardian_presence_commitment:  nullIfEmpty(body.guardian_presence_commitment),
    guardian_medical_accuracy:     nullIfEmpty(body.guardian_medical_accuracy),
    age_confirmation_adult:        nullIfEmpty(body.age_confirmation_adult),
    skin_conditions:               toArray(body.skin_conditions),
    allergies:                     nullIfEmpty(body.allergies),
    medical_history:               toArray(body.medical_history),
    medications:                   nullIfEmpty(body.medications),
    recent_treatments:             toArray(body.recent_treatments)?.join(', ') || null,
    alcohol_consumption:           nullIfEmpty(body.alcohol_consumption),
    skin_prep:                     toArray(body.skin_prep),
    hygiene_acknowledgment:        nullIfEmpty(body.hygiene_acknowledgment),
    appointment_acknowledgment:    nullIfEmpty(body.appointment_acknowledgment),
    post_care_acknowledgment:      nullIfEmpty(body.post_care_acknowledgment),
    refuse_service_acknowledgment: nullIfEmpty(body.refuse_service_acknowledgment),
    refund_policy_acknowledgment:  nullIfEmpty(body.refund_policy_acknowledgment),
    health_agreement:              nullIfEmpty(body.health_agreement),
    ip:       (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || event.headers['client-ip'] || null,
    user_agent: event.headers['user-agent'] || null,
    referrer:   event.headers['referer']    || null,
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await getSupabase().from('pre_service_forms').insert(record);
    if (error) throw new Error(error.message);

    // ── Owner notifications (non-fatal) ───────────────────────────────────────
    try {
      const ns = await getNotificationSettings();
      const apptLabel = record.appointment_date
        ? new Date(record.appointment_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'upcoming appointment';

      const skinList   = (record.skin_conditions || []).join(', ') || 'none';
      const medHistory = (record.medical_history || []).filter(m => m !== 'none').join(', ') || 'none';
      const meds       = record.medications || 'none';
      const allergies  = record.allergies   || 'none';

      const ownerSms = `📋 Pre-Service Form\n${record.name} · ${apptLabel}\n📱 ${record.phone || 'no phone'}\nSkin: ${skinList}\nMedical: ${medHistory}\nMeds: ${meds.substring(0, 80)}${meds.length > 80 ? '…' : ''}`;

      const ownerHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1a1714;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:#f0ebe6;font-size:20px;margin:0">Pre-Service Form Submitted</h1>
    <p style="color:#9e9590;font-size:13px;margin:6px 0 0">Bliss Dermacare</p>
  </div>
  <div style="background:#fafaf9;border:1px solid #e8e2dc;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:7px 0;color:#78716c;width:160px">Client</td><td style="padding:7px 0;font-weight:600;color:#1c1917">${record.name}</td></tr>
      <tr><td style="padding:7px 0;color:#78716c">Appointment</td><td style="padding:7px 0;font-weight:600;color:#1c1917">${apptLabel}</td></tr>
      <tr><td style="padding:7px 0;color:#78716c">Phone</td><td style="padding:7px 0;color:#1c1917">${record.phone || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#78716c">Email</td><td style="padding:7px 0;color:#1c1917">${record.email || '—'}</td></tr>
      <tr><td style="padding:7px 0;color:#78716c">Skin conditions</td><td style="padding:7px 0;color:#1c1917">${skinList}</td></tr>
      <tr><td style="padding:7px 0;color:#78716c">Medical history</td><td style="padding:7px 0;color:#1c1917">${medHistory}</td></tr>
      <tr><td style="padding:7px 0;color:#78716c">Medications</td><td style="padding:7px 0;color:#1c1917">${meds}</td></tr>
      <tr><td style="padding:7px 0;color:#78716c">Allergies</td><td style="padding:7px 0;color:#1c1917">${allergies}</td></tr>
    </table>
    <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;margin-top:20px">
      Bliss Dermacare &middot; 8905 Regents Park Dr, Tampa, FL 33647 &middot; (609) 366-0857
    </p>
  </div>
</div>`;

      const sends = [];
      for (const ph of ns.ownerPhones) sends.push(sendSMS(ph, ownerSms.substring(0, 1600)));
      if (ns.ownerEmails.length) {
        sends.push(sendEmail({
          to: ns.ownerEmails,
          subject: `New Pre-Service Form — ${record.name} · ${apptLabel}`,
          html: ownerHtml,
        }));
      }
      await Promise.allSettled(sends);
    } catch (notifyErr) {
      console.warn('PSF notification failed (non-fatal):', notifyErr.message);
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('pre-service-form error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to save form. Please try again.' }) };
  }
};
