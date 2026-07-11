'use strict';

/**
 * Scheduled function — runs daily at ~9 AM ET (1 PM UTC).
 * Finds all Confirmed appointments for tomorrow that haven't received a 24h reminder.
 * Sends a personalized SMS via Twilio and marks the record in Airtable.
 */

const { airtableListAll, airtablePatch, sendSMS } = require('./_utils.cjs');

const TABLE = () => process.env.AIRTABLE_APPOINTMENTS_TABLE || 'Appointments';

function formatDateLabel(dateStr) {
  // dateStr = "YYYY-MM-DD"
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

exports.handler = async () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const dateLabel = formatDateLabel(tomorrowStr);

  console.log(`[reminder-24h] Running for ${tomorrowStr}`);

  try {
    const records = await airtableListAll(TABLE(), {
      filterByFormula: `AND(DATESTR({Date})="${tomorrowStr}",{Status}="Confirmed",NOT({Reminder 24h Sent}),{Client Phone}!="")`,
    });

    console.log(`[reminder-24h] Found ${records.length} appointments needing reminders`);

    let sent = 0;
    for (const rec of records) {
      const f = rec.fields;
      const firstName = (f['Client Name'] || 'there').split(' ')[0];
      const time = f['Time'] || 'your scheduled time';
      const services = f['Services'] || 'your appointment';
      const phone = f['Client Phone'];

      const message =
        `Hi ${firstName}! 💗 A friendly reminder from Bliss Dermacare — ` +
        `you have an appointment tomorrow, ${dateLabel} at ${time} for ${services}. ` +
        `We're located at 29007 Bridgegrove Dr, Wesley Chapel, FL 33543. ` +
        `Questions? Call or text (609) 366-0857. See you soon!`;

      try {
        await sendSMS(phone, message);
        await airtablePatch(TABLE(), rec.id, { 'Reminder 24h Sent': true });
        sent++;
        console.log(`[reminder-24h] SMS sent to ${phone} (rec ${rec.id})`);
      } catch (err) {
        console.error(`[reminder-24h] Failed for ${phone} (rec ${rec.id}):`, err.message);
      }
    }

    return { statusCode: 200, body: `[reminder-24h] Sent ${sent}/${records.length} reminders for ${tomorrowStr}` };
  } catch (err) {
    console.error('[reminder-24h] Fatal error:', err);
    return { statusCode: 500, body: err.message };
  }
};
