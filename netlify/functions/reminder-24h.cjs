'use strict';

const { getSupabase, sendSMS } = require('./_utils.cjs');

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
    const { data: rows, error } = await getSupabase()
      .from('appointments')
      .select('id,client_name,client_phone,time,services')
      .eq('date', tomorrowStr)
      .eq('status', 'Confirmed')
      .eq('reminder_24h_sent', false)
      .not('client_phone', 'is', null)
      .neq('client_phone', '');
    if (error) throw new Error(error.message);

    let sent = 0;
    const sb = getSupabase();
    for (const row of (rows || [])) {
      const firstName = (row.client_name || 'there').split(' ')[0];
      const message =
        `Hi ${firstName}! 💗 A friendly reminder from Bliss Dermacare — ` +
        `you have an appointment tomorrow, ${dateLabel} at ${row.time || 'your scheduled time'} ` +
        `for ${row.services || 'your appointment'}. ` +
        `We're at 29007 Bridgegrove Dr, Wesley Chapel, FL 33543. ` +
        `Questions? Call or text (813) 766-6416. See you soon!`;
      try {
        await sendSMS(row.client_phone, message);
        await sb.from('appointments').update({ reminder_24h_sent: true }).eq('id', row.id);
        sent++;
      } catch (err) { console.error(`[reminder-24h] Failed for record ${row.id}:`, err.message); }
    }

    return { statusCode: 200, body: `[reminder-24h] Sent ${sent}/${(rows || []).length} reminders for ${tomorrowStr}` };
  } catch (err) {
    console.error('[reminder-24h] Fatal error:', err);
    return { statusCode: 500, body: err.message };
  }
};
