'use strict';

const { getSupabase, sendSMS, sendEmail, getNotificationSettings } = require('./_utils.cjs');

function formatDateLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

exports.handler = async () => {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const dateLabel = formatDateLabel(tomorrowStr);
  console.log(`[reminder-24h] Running for ${tomorrowStr}`);

  try {
    const ns = await getNotificationSettings();
    if (!ns.reminder24hEnabled) {
      console.log('[reminder-24h] Disabled via notification settings — skipping');
      return { statusCode: 200, body: '[reminder-24h] Disabled' };
    }

    const { data: rows, error } = await getSupabase()
      .from('appointments')
      .select('id,client_name,client_phone,client_email,time,services')
      .eq('date', tomorrowStr)
      .in('status', ns.reminderStatuses)
      .eq('reminder_24h_sent', false);
    if (error) throw new Error(error.message);

    let sent = 0;
    const sb = getSupabase();
    for (const row of (rows || [])) {
      const firstName = (row.client_name || 'there').split(' ')[0];
      const smsBody =
        `Hi ${firstName}! 💗 A friendly reminder from Bliss Dermacare — ` +
        `you have an appointment tomorrow, ${dateLabel} at ${row.time || 'your scheduled time'} ` +
        `for ${row.services || 'your appointment'}. ` +
        `We're at 8905 Regents Park Dr, Tampa, FL 33647. ` +
        `Questions? Call or text (609) 366-0857. See you soon!`;
      const emailHtml =
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;line-height:1.6">` +
        `<h2 style="font-size:18px;color:#c26b7a;margin-bottom:8px">Appointment Reminder ✨</h2>` +
        `<p>Hi ${firstName},</p>` +
        `<p>This is a friendly reminder that you have an appointment <strong>tomorrow, ${dateLabel}</strong>` +
        ` at <strong>${row.time || 'your scheduled time'}</strong>` +
        ` for <strong>${row.services || 'your appointment'}</strong>.</p>` +
        `<p>📍 <strong>8905 Regents Park Dr, Tampa, FL 33647</strong></p>` +
        `<p>Questions? Call or text us at <strong>(609) 366-0857</strong>. We look forward to seeing you!</p>` +
        `<p style="color:#999;font-size:12px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">Bliss Dermacare &middot; Wesley Chapel, FL</p></div>`;
      try {
        let notified = false;
        if (row.client_phone) { const sr = await sendSMS(row.client_phone, smsBody); if (sr?.ok) notified = true; }
        if (row.client_email) {
          await sendEmail({ to: row.client_email, subject: `Appointment Reminder: ${dateLabel} — Bliss Dermacare`, html: emailHtml, text: smsBody });
          notified = true;
        }
        if (notified) {
          await sb.from('appointments').update({ reminder_24h_sent: true }).eq('id', row.id);
          sent++;
        }
      } catch (err) { console.error(`[reminder-24h] Failed for record ${row.id}:`, err.message); }
    }

    return { statusCode: 200, body: `[reminder-24h] Sent ${sent}/${(rows || []).length} reminders for ${tomorrowStr}` };
  } catch (err) {
    console.error('[reminder-24h] Fatal error:', err);
    return { statusCode: 500, body: err.message };
  }
};
