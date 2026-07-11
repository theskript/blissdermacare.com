'use strict';

/**
 * Scheduled function — runs daily at ~8 AM ET (12 PM UTC).
 * Fetches all confirmed/pending appointments for today and sends
 * an email summary + SMS to the owner/staff.
 */

const { airtableListAll, sendSMS, sendEmail } = require('./_utils.cjs');

const TABLE = () => process.env.AIRTABLE_APPOINTMENTS_TABLE || 'Appointments';

function formatDateLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

async function notifyOwners(smsText, emailSubject, emailHtml) {
  const ownerEmails = (process.env.OWNER_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean);
  const ownerPhones = (process.env.OWNER_PHONE || '').split(',').map(p => p.trim()).filter(Boolean);

  await Promise.allSettled([
    ownerEmails.length > 0
      ? sendEmail({ to: ownerEmails, subject: emailSubject, html: emailHtml, text: smsText })
      : Promise.resolve(),
    ...ownerPhones.map(phone => sendSMS(phone, smsText.substring(0, 1600))),
  ]);
}

exports.handler = async () => {
  const today = new Date().toISOString().split('T')[0];
  const dateLabel = formatDateLabel(today);

  console.log(`[morning-summary] Running for ${today}`);

  try {
    const records = await airtableListAll(TABLE(), {
      filterByFormula: `AND(DATESTR({Date})="${today}",OR({Status}="Confirmed",{Status}="Pending Payment",{Status}="Completed"))`,
      'sort[0][field]': 'Time',
      'sort[0][direction]': 'asc',
    });

    const count = records.length;

    if (count === 0) {
      const msg = `Bliss Dermacare — ${dateLabel}: No appointments scheduled today. Enjoy your day! 🌸`;
      await notifyOwners(
        msg,
        `No Appointments Today — ${dateLabel}`,
        `<p style="font-family:sans-serif;color:#57534e">No appointments scheduled for today, <strong>${dateLabel}</strong>.</p>`
      );
      return { statusCode: 200, body: 'No appointments today — summary sent' };
    }

    // Build text lines for SMS
    const lines = records.map((rec, i) => {
      const f = rec.fields;
      return `${i + 1}. ${f['Time'] || '?'} — ${f['Client Name'] || 'Unknown'} · ${f['Services'] || 'TBD'} [${f['Status'] || ''}]`;
    });
    const smsBody =
      `🌸 Bliss Dermacare — ${dateLabel}\n${count} appointment${count !== 1 ? 's' : ''} today:\n\n` +
      lines.join('\n');

    // Build HTML email
    const rows = records.map(rec => {
      const f = rec.fields;
      const statusColor = {
        'Confirmed': '#16a34a',
        'Completed': '#2563eb',
        'Pending Payment': '#d97706',
        'Cancelled': '#dc2626',
        'No-Show': '#9333ea',
      }[f['Status']] || '#57534e';
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4;font-size:14px;white-space:nowrap">${f['Time'] || '—'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4;font-size:14px;font-weight:600">${f['Client Name'] || '—'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4;font-size:13px;color:#78716c">${f['Client Phone'] || '—'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4;font-size:13px">${f['Services'] || '—'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f5f5f4">
            <span style="font-size:12px;font-weight:600;color:${statusColor}">${f['Status'] || '—'}</span>
          </td>
        </tr>`;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#faf9f7;font-family:Inter,sans-serif">
        <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4">
          <div style="background:linear-gradient(135deg,#c94d63,#e0546d);padding:28px 32px">
            <div style="color:#fff;font-size:22px;font-weight:700">🌸 Bliss Dermacare</div>
            <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px">Daily Schedule Summary</div>
          </div>
          <div style="padding:28px 32px">
            <h2 style="margin:0 0 6px;font-size:18px;color:#1c1917">${dateLabel}</h2>
            <p style="margin:0 0 24px;color:#78716c;font-size:14px"><strong>${count}</strong> appointment${count !== 1 ? 's' : ''} scheduled today</p>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e7e5e4;border-radius:8px;overflow:hidden">
              <thead>
                <tr style="background:#fdf5f6">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#a8a29e;text-transform:uppercase;letter-spacing:.05em">Time</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#a8a29e;text-transform:uppercase;letter-spacing:.05em">Client</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#a8a29e;text-transform:uppercase;letter-spacing:.05em">Phone</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#a8a29e;text-transform:uppercase;letter-spacing:.05em">Service(s)</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#a8a29e;text-transform:uppercase;letter-spacing:.05em">Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div style="padding:16px 32px;background:#faf9f7;border-top:1px solid #e7e5e4">
            <a href="https://blissdermacare.com/admin/" style="font-size:13px;color:#c94d63;text-decoration:none">Open Admin Panel →</a>
            <span style="font-size:12px;color:#a8a29e;margin-left:16px">Sent by Bliss Dermacare automated system</span>
          </div>
        </div>
      </body>
      </html>`;

    await notifyOwners(smsBody, `Today's Schedule — ${count} appts | ${dateLabel}`, html);
    console.log(`[morning-summary] Summary sent for ${count} appointments`);
    return { statusCode: 200, body: `Morning summary sent: ${count} appointments` };
  } catch (err) {
    console.error('[morning-summary] Fatal error:', err);
    return { statusCode: 500, body: err.message };
  }
};
