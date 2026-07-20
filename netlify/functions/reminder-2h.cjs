'use strict';

const { getSupabase, sendSMS, sendEmail, timeToMinutes, etOffsetHours, getNotificationSettings } = require('./_utils.cjs');

exports.handler = async () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const etMins = ((utcMins + etOffsetHours(now) * 60) % 1440 + 1440) % 1440;
  const windowStart = etMins + 105;
  const windowEnd   = etMins + 135;
  console.log(`[reminder-2h] Running for ${todayStr}, ET ${Math.floor(etMins/60)}:${String(etMins%60).padStart(2,'0')}`);

  try {
    const ns = await getNotificationSettings();
    if (!ns.reminder2hEnabled) {
      console.log('[reminder-2h] Disabled via notification settings — skipping');
      return { statusCode: 200, body: '[reminder-2h] Disabled' };
    }

    const { data: rows, error } = await getSupabase()
      .from('appointments')
      .select('id,client_name,client_phone,client_email,time,services')
      .eq('date', todayStr)
      .in('status', ns.reminderStatuses)
      .eq('reminder_2h_sent', false);
    if (error) throw new Error(error.message);

    let sent = 0;
    const sb = getSupabase();
    for (const row of (rows || [])) {
      const slotMins = timeToMinutes(row.time || '');
      if (slotMins < 0) continue;
      const norm = ((slotMins % 1440) + 1440) % 1440;
      const wS   = ((windowStart % 1440) + 1440) % 1440;
      const wE   = ((windowEnd   % 1440) + 1440) % 1440;
      const inWindow = wE >= wS ? (norm >= wS && norm <= wE) : (norm >= wS || norm <= wE);
      if (!inWindow) continue;

      const firstName = (row.client_name || 'there').split(' ')[0];
      const smsBody =
        `Hi ${firstName}! Quick reminder — your Bliss Dermacare appointment is in about 2 hours ` +
        `(${row.time} today) for ${row.services || 'your appointment'}. ` +
        `We're at 8905 Regents Park Dr, Tampa, FL 33647. See you soon! 💗`;
      const emailHtml =
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;line-height:1.6">` +
        `<h2 style="font-size:18px;color:#c26b7a;margin-bottom:8px">Your appointment is in ~2 hours!</h2>` +
        `<p>Hi ${firstName},</p>` +
        `<p>Just a reminder that your appointment is coming up <strong>today at ${row.time}</strong>` +
        ` for <strong>${row.services || 'your appointment'}</strong>.</p>` +
        `<p>📍 <strong>8905 Regents Park Dr, Tampa, FL 33647</strong></p>` +
        `<p>See you soon! Call or text (813) 534-6839 if you need anything.</p>` +
        `<p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">Bliss Dermacare &middot; Wesley Chapel, FL</p></div>`;
      try {
        let notified = false;
        if (row.client_phone) { await sendSMS(row.client_phone, smsBody); notified = true; }
        if (row.client_email) {
          await sendEmail({ to: row.client_email, subject: `Your Bliss Dermacare appointment is in ~2 hours`, html: emailHtml, text: smsBody });
          notified = true;
        }
        if (notified) {
          await sb.from('appointments').update({ reminder_2h_sent: true }).eq('id', row.id);
          sent++;
        }
      } catch (err) { console.error(`[reminder-2h] Failed for record ${row.id}:`, err.message); }
    }

    return { statusCode: 200, body: `[reminder-2h] Sent ${sent} reminders` };
  } catch (err) {
    console.error('[reminder-2h] Fatal error:', err);
    return { statusCode: 500, body: err.message };
  }
};
