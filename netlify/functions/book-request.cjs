'use strict';

// Netlify serverless function — handles "pay in person" appointment requests.
// Writes directly to Supabase (status: Pending Confirmation) and notifies the owner.
// No Stripe involved.

const { getSupabase, sendEmail, sendSMS, formatTime } = require('./_utils.cjs');

const APPOINTMENTS_TABLE = 'appointments';

const SERVICE_LABELS = {
  'other':                             'Other / Not Sure',
  'signature-radiance-facial':         'Signature Radiance Facial',
  'brightening-peel':                  'Brightening Peel',
  'diamond-glow':                      'Diamond Glow',
  'teen-skincare-facial':              'Teen Skincare Facial',
  'high-frequency-skin-tightening':    'High Frequency Skin Tightening',
  'pumpkin-enzyme-facial':             'Pumpkin Enzyme Facial',
  'chlorophyll-skin-tightening-facial':'Chlorophyll Skin Tightening Facial',
  'pineapple-enzyme-facial':           'Pineapple Enzyme Facial',
  'skin-recovery-facial':              'Skin Recovery Facial',
  'lash-extensions':                   'Lash Extensions',
  'lash-extensions-fill':              'Lash Extensions Fill',
  'lash-lift-brow-lamination':         'Lash Lift & Brow Lamination',
  'body-and-face-waxing':              'Body & Face Waxing',
  'brazilian-wax':                     'Brazilian Wax',
  'spray-tan':                         'Custom Airbrush Spray Tan',
  'bronze-bare-glow':                  'Bronze & Bare Glow Package',
  'dermaplane-glow-facial':            'Dermaplane Glow Facial',
  'smooth-canvas-facial':              'Smooth Canvas Facial',
  'vampire-facial-prp':                'Vampire Facial (PRP)',
  'lash-body-smooth':                  'Lash & Body Smooth Package',
  'brow-lash-wax-ritual':              'Brow, Lash & Wax Ritual Package',
  'glow-smooth-escape':                'Glow & Smooth Escape Package',
  'mix-match-package':                 'Mix & Match Escape Package',
  'prp-treatment':                     'PRP (Platelet-Rich Plasma)',
  'lip-filler':                        'Lip Filler',
  'ed-injectables':                    'Erectile Dysfunction Injectables',
  'collagen-induction-therapy':        'Collagen Induction Therapy',
  'weight-loss-program':               'Weight Loss Program (GLP-1/Semiglutide)',
  'scalp-micropigmentation':           'Scalp Micropigmentation',
  'lip-neutralization':                'Lip Neutralization',
  'lip-blush':                         'Lip Blush',
  'nano-brows':                        'Nano Brows',
  'powder-brows':                      'Powder Brows',
  'custom-semipermanent-makeup':       'Custom Semipermanent Makeup',
  'iv-hydration-therapy':              'IV Hydration Therapy',
  'lab-collection':                    'Personalized Lab Collection',
  'hormone-lab-panel':                 'Hormone Lab Panel Support',
  'regenerative-blood-services':       'Regenerative Blood-Based Services',
};

const PRICES = {
  'other':                              1,
  'signature-radiance-facial':         99,
  'brightening-peel':                 128,
  'diamond-glow':                     119,
  'teen-skincare-facial':              64,
  'high-frequency-skin-tightening':    95,
  'pumpkin-enzyme-facial':             85,
  'chlorophyll-skin-tightening-facial':105,
  'pineapple-enzyme-facial':           88,
  'skin-recovery-facial':              92,
  'lash-extensions':                  159,
  'lash-extensions-fill':              43,
  'lash-lift-brow-lamination':         79,
  'body-and-face-waxing':              65,
  'brazilian-wax':                     87,
  'spray-tan':                         65,
  'bronze-bare-glow':                 110,
  'dermaplane-glow-facial':           105,
  'smooth-canvas-facial':              89,
  'vampire-facial-prp':               380,
  'lash-body-smooth':                 185,
  'brow-lash-wax-ritual':             115,
  'glow-smooth-escape':               135,
  'mix-match-package':                129,
  'prp-treatment':                    399,
  'lip-filler':                       599,
  'ed-injectables':                   499,
  'collagen-induction-therapy':       299,
  'weight-loss-program':              299,
  'scalp-micropigmentation':          650,
  'lip-neutralization':               399,
  'lip-blush':                        499,
  'nano-brows':                       499,
  'powder-brows':                     549,
  'custom-semipermanent-makeup':      450,
  'iv-hydration-therapy':             149,
  'lab-collection':                   199,
  'hormone-lab-panel':                349,
  'regenerative-blood-services':      450,
};

const DISCOUNT_PCT = {
  'none':                    0,
  'first-responder-veteran': 15,
  'teacher-educator':        10,
  'senior-65-plus':          10,
  'student':                 10,
};

const DISCOUNT_LABELS = {
  'first-responder-veteran': 'First Responder / Veteran Discount (15%)',
  'teacher-educator':        'Teacher / Educator Discount (10%)',
  'senior-65-plus':          'Senior 65+ Discount (10%)',
  'student':                 'Student Discount (10%)',
};

const ALLOWED_SERVICES  = new Set(Object.keys(PRICES));
const ALLOWED_DISCOUNTS = new Set(Object.keys(DISCOUNT_PCT));

function formatDateLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const {
    services: servicesParam,
    service:  serviceParam    = '',
    discount      = 'none',
    customerName  = '',
    customerEmail = '',
    customerPhone = '',
    appointmentDate = '',
    appointmentTime = '',
    notes         = '',
    referral      = '',
    grouponCode   = '',
    confirmPhone  = '',
    confirmText   = '',
    confirmEmail  = '',
  } = body;

  const serviceList = Array.isArray(servicesParam) && servicesParam.length > 0
    ? servicesParam
    : (serviceParam ? [serviceParam] : []);

  // Validation
  if (serviceList.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please select at least one service.' }) };
  }
  for (const svc of serviceList) {
    if (!ALLOWED_SERVICES.has(svc)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid service selection.' }) };
    }
  }
  if (!customerName.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Your name is required.' }) };
  }
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'A valid email address is required.' }) };
  }
  if (!appointmentDate || !appointmentTime) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Appointment date and time are required.' }) };
  }

  const discountKey    = ALLOWED_DISCOUNTS.has(discount) ? discount : 'none';
  const discountPct    = DISCOUNT_PCT[discountKey] ?? 0;
  const discountLabel  = DISCOUNT_LABELS[discountKey] || 'None';
  const basePrice      = serviceList.reduce((sum, svc) => sum + (PRICES[svc] || 0), 0);
  const finalPrice     = Math.round(basePrice * (1 - discountPct / 100) * 100) / 100;
  const serviceNames   = serviceList.map(svc => SERVICE_LABELS[svc] || svc);
  const dateLabel      = formatDateLabel(appointmentDate);
  const sourceMap      = { groupon: 'Groupon', classpass: 'ClassPass' };
  const source         = sourceMap[referral] || 'Website';

  // ── Write to Supabase ─────────────────────────────────────────────────────
  try {
    const { error: dbError } = await getSupabase().from(APPOINTMENTS_TABLE).insert({
      client_name:    customerName,
      client_email:   customerEmail,
      client_phone:   customerPhone,
      date:           appointmentDate,
      time:           formatTime(appointmentTime),
      services:       serviceNames.join(', '),
      status:         'Pending Confirmation',
      price:          finalPrice,
      notes:          notes,
      source:         source,
      discount:       discountPct > 0 ? discountLabel : 'None',
      referral:       referral,
      groupon_code:   grouponCode,
      stripe_session_id: null,
      confirm_phone:  confirmPhone === 'yes',
      confirm_text:   confirmText  === 'yes',
      confirm_email:  confirmEmail === 'yes',
    });
    if (dbError) {
      console.error('Supabase insert error:', dbError.message);
      // Non-fatal — still proceed to notify
    }
  } catch (dbErr) {
    console.error('Supabase init error (non-fatal):', dbErr.message);
  }

  // ── Notify owner ──────────────────────────────────────────────────────────
  const ownerEmails = (process.env.OWNER_EMAIL || 'info@blissdermacare.com').split(',').map(e => e.trim()).filter(Boolean);
  const ownerPhones = (process.env.OWNER_PHONE || '').split(',').map(p => p.trim()).filter(Boolean);

  const smsText = `📅 New booking request — PAY IN PERSON\n${customerName} · ${customerPhone || 'no phone'}\n${serviceNames.join(', ')}\n${dateLabel} at ${appointmentTime}\nEstimated total: $${finalPrice.toFixed(2)}${discountPct > 0 ? ` (${discountLabel})` : ''}\nNotes: ${notes || 'none'}`;

  const ownerEmailHtml = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1714;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:#f0ebe6;font-size:20px;margin:0">New Appointment Request</h1>
        <p style="color:#9e9590;font-size:13px;margin:6px 0 0">Pay in person · Bliss Dermacare</p>
      </div>
      <div style="background:#fafaf9;border:1px solid #e8e2dc;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#78716c;width:160px">Client</td><td style="padding:8px 0;font-weight:600;color:#1c1917">${customerName}</td></tr>
          <tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0;color:#1c1917">${customerEmail}</td></tr>
          <tr><td style="padding:8px 0;color:#78716c">Phone</td><td style="padding:8px 0;color:#1c1917">${customerPhone || '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#78716c">Date</td><td style="padding:8px 0;font-weight:600;color:#1c1917">${dateLabel}</td></tr>
          <tr><td style="padding:8px 0;color:#78716c">Time</td><td style="padding:8px 0;color:#1c1917">${appointmentTime}</td></tr>
          <tr><td style="padding:8px 0;color:#78716c">Services</td><td style="padding:8px 0;color:#1c1917">${serviceNames.join('<br>')}</td></tr>
          <tr><td style="padding:8px 0;color:#78716c">Est. Total</td><td style="padding:8px 0;font-weight:600;color:#c2410c">$${finalPrice.toFixed(2)}${discountPct > 0 ? ` <span style="color:#78716c;font-weight:400">(${discountLabel})</span>` : ''}</td></tr>
          <tr><td style="padding:8px 0;color:#78716c">Payment</td><td style="padding:8px 0;font-weight:600;color:#b45309">Pay in person at appointment</td></tr>
          ${notes ? `<tr><td style="padding:8px 0;color:#78716c">Notes</td><td style="padding:8px 0;color:#1c1917">${notes}</td></tr>` : ''}
          ${referral ? `<tr><td style="padding:8px 0;color:#78716c">Source</td><td style="padding:8px 0;color:#1c1917">${source}</td></tr>` : ''}
        </table>
      </div>
    </div>`;

  // ── Confirmation email to client ──────────────────────────────────────────
  const clientEmailHtml = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1714;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:#f0ebe6;font-size:22px;margin:0">Booking Request Received</h1>
        <p style="color:#9e9590;font-size:13px;margin:6px 0 0">Bliss Dermacare · Pebble Creek, FL</p>
      </div>
      <div style="background:#fafaf9;border:1px solid #e8e2dc;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="color:#44403c;font-size:15px">Hi ${customerName.split(' ')[0] || customerName},</p>
        <p style="color:#44403c;font-size:14px;line-height:1.6">Thank you for submitting your appointment request. We'll reach out within <strong>24 hours</strong> to confirm your booking.</p>

        <div style="background:#fff;border:1px solid #e7e5e4;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#a8a29e">Your Request</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#78716c;width:120px">Service</td><td style="padding:6px 0;font-weight:600;color:#1c1917">${serviceNames.join(', ')}</td></tr>
            <tr><td style="padding:6px 0;color:#78716c">Date</td><td style="padding:6px 0;color:#1c1917">${dateLabel}</td></tr>
            <tr><td style="padding:6px 0;color:#78716c">Time</td><td style="padding:6px 0;color:#1c1917">${appointmentTime}</td></tr>
            <tr><td style="padding:6px 0;color:#78716c">Payment</td><td style="padding:6px 0;color:#b45309;font-weight:600">Due in person at appointment</td></tr>
          </table>
        </div>

        <p style="color:#44403c;font-size:13px;line-height:1.6">We accept <strong>cash</strong>, <strong>Zelle</strong>, <strong>Venmo</strong>, and all major <strong>credit/debit cards</strong> in person. If you need to cancel or reschedule, please give us at least <strong>24 hours' notice</strong>.</p>
        <p style="color:#44403c;font-size:13px;line-height:1.6">Questions? Reply to this email or call us at <a href="tel:+16093660857" style="color:#c2410c">(609) 366-0857</a>.</p>
        <p style="color:#78716c;font-size:13px;margin-top:24px">— The Bliss Dermacare Team</p>
      </div>
    </div>`;

  await Promise.allSettled([
    sendEmail({ to: ownerEmails, subject: `New Booking Request (Pay In Person) — ${customerName} · ${dateLabel}`, html: ownerEmailHtml }),
    sendEmail({ to: customerEmail, subject: 'Your Appointment Request — Bliss Dermacare', html: clientEmailHtml }),
    ...ownerPhones.map(phone => sendSMS(phone, smsText.substring(0, 1600))),
  ]);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, redirect: '/book/success?payment=in-person' }),
  };
};
