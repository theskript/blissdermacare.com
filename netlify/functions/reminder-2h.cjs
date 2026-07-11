'use strict';

/**
 * Scheduled function — runs every hour.
 * Finds Confirmed appointments for today whose time slot is ~2 hours from now (ET).
 * Sends a 2-hour heads-up SMS and marks the record.
 */

const { airtableListAll, airtablePatch, sendSMS, timeToMinutes, etOffsetHours } = require('./_utils.cjs');

const TABLE = () => process.env.AIRTABLE_APPOINTMENTS_TABLE || 'Appointments';

exports.handler = async () => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Current time in ET minutes since midnight
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const etMins = ((utcMins + etOffsetHours(now) * 60) % 1440 + 1440) % 1440;

  // Target window: slots between (now + 1h45m) and (now + 2h15m)
  const windowStart = etMins + 105;
  const windowEnd = etMins + 135;

  console.log(`[reminder-2h] Running for ${todayStr}, ET now=${Math.floor(etMins/60)}:${String(etMins%60).padStart(2,'0')}, window=${Math.floor(windowStart/60)}:${String(windowStart%60).padStart(2,'0')}–${Math.floor(windowEnd/60)}:${String(windowEnd%60).padStart(2,'0')}`);

  try {
    const records = await airtableListAll(TABLE(), {
      filterByFormula: `AND(DATESTR({Date})="${todayStr}",{Status}="Confirmed",NOT({Reminder 2h Sent}),{Client Phone}!="")`,
    });

    let sent = 0;
    for (const rec of records) {
      const f = rec.fields;
      const slotMins = timeToMinutes(f['Time'] || '');
      if (slotMins < 0) continue;

      // Normalize the slot into the same day range, accounting for window overflow
      const normSlot = ((slotMins % 1440) + 1440) % 1440;
      const normWindowStart = ((windowStart % 1440) + 1440) % 1440;
      const normWindowEnd = ((windowEnd % 1440) + 1440) % 1440;
      const inWindow = normWindowEnd >= normWindowStart
        ? normSlot >= normWindowStart && normSlot <= normWindowEnd
        : normSlot >= normWindowStart || normSlot <= normWindowEnd;

      if (!inWindow) continue;

      const firstName = (f['Client Name'] || 'there').split(' ')[0];
      const time = f['Time'] || 'your scheduled time';
      const services = f['Services'] || 'your appointment';
      const phone = f['Client Phone'];

      const message =
        `Hi ${firstName}! Quick reminder — your Bliss Dermacare appointment is in about 2 hours ` +
        `(${time} today) for ${services}. ` +
        `We're at 29007 Bridgegrove Dr, Wesley Chapel, FL 33543. See you soon! 💗`;

      try {
        await sendSMS(phone, message);
        await airtablePatch(TABLE(), rec.id, { 'Reminder 2h Sent': true });
        sent++;
        console.log(`[reminder-2h] SMS sent to ${phone} (rec ${rec.id})`);
      } catch (err) {
        console.error(`[reminder-2h] Failed for ${phone} (rec ${rec.id}):`, err.message);
      }
    }

    return { statusCode: 200, body: `[reminder-2h] Sent ${sent} reminders` };
  } catch (err) {
    console.error('[reminder-2h] Fatal error:', err);
    return { statusCode: 500, body: err.message };
  }
};
