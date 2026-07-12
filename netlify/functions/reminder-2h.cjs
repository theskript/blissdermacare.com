'use strict';

const { getSupabase, sendSMS, timeToMinutes, etOffsetHours } = require('./_utils.cjs');

exports.handler = async () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const etMins = ((utcMins + etOffsetHours(now) * 60) % 1440 + 1440) % 1440;
  const windowStart = etMins + 105;
  const windowEnd   = etMins + 135;
  console.log(`[reminder-2h] Running for ${todayStr}, ET ${Math.floor(etMins/60)}:${String(etMins%60).padStart(2,'0')}`);

  try {
    const { data: rows, error } = await getSupabase()
      .from('appointments')
      .select('id,client_name,client_phone,time,services')
      .eq('date', todayStr)
      .eq('status', 'Confirmed')
      .eq('reminder_2h_sent', false)
      .not('client_phone', 'is', null)
      .neq('client_phone', '');
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
      const message =
        `Hi ${firstName}! Quick reminder — your Bliss Dermacare appointment is in about 2 hours ` +
        `(${row.time} today) for ${row.services || 'your appointment'}. ` +
        `We're at 29007 Bridgegrove Dr, Wesley Chapel, FL 33543. See you soon! 💗`;
      try {
        await sendSMS(row.client_phone, message);
        await sb.from('appointments').update({ reminder_2h_sent: true }).eq('id', row.id);
        sent++;
      } catch (err) { console.error(`[reminder-2h] Failed for record ${row.id}:`, err.message); }
    }

    return { statusCode: 200, body: `[reminder-2h] Sent ${sent} reminders` };
  } catch (err) {
    console.error('[reminder-2h] Fatal error:', err);
    return { statusCode: 500, body: err.message };
  }
};
