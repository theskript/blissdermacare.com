'use strict';

/**
 * GET /.netlify/functions/calendar-ics
 * Returns all upcoming appointments as an ICS (iCalendar) file.
 *
 * Auth: Pass ?token=<JWT> in the URL (for calendar subscriptions that can't
 * send Authorization headers). The token is validated identically to the
 * standard Authorization header bearer check.
 *
 * Optional query params:
 *   ?days=N     — include appointments from today + N days (default 90)
 *   ?past=true  — also include past appointments (up to 30 days back)
 */

const { requireAuth, getSupabase } = require('./_utils.cjs');

function padZ(n) { return String(n).padStart(2, '0'); }

/**
 * Parse a time string like "2:00 PM" or "14:30" → [hour24, minute]
 */
function parseTime(timeStr) {
  if (!timeStr) return [9, 0];
  const pm = /PM/i.test(timeStr);
  const am = /AM/i.test(timeStr);
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return [9, 0];
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (pm && h !== 12) h += 12;
  if (am && h === 12) h = 0;
  return [h, m];
}

function icsDate(dateStr, timeStr) {
  const [h, m] = parseTime(timeStr);
  const d = dateStr.replace(/-/g, '');
  return `${d}T${padZ(h)}${padZ(m)}00`;
}

function icsEscape(str) {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldLine(line) {
  // RFC 5545: lines > 75 octets must be folded
  const result = [];
  while (line.length > 75) {
    result.push(line.substring(0, 75));
    line = ' ' + line.substring(75);
  }
  result.push(line);
  return result.join('\r\n');
}

exports.handler = async (event) => {
  // Support token in query param for calendar subscription URLs
  const q = event.queryStringParameters || {};
  if (q.token && !event.headers['authorization']) {
    event = {
      ...event,
      headers: { ...event.headers, authorization: `Bearer ${q.token}` },
    };
  }

  let user;
  try { user = requireAuth(event); } catch (e) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'text/plain', 'WWW-Authenticate': 'Bearer' },
      body: 'Unauthorized',
    };
  }
  void user;

  const days = Math.min(parseInt(q.days || '90', 10), 365);
  const includePast = q.past === 'true';

  const today = new Date();
  const startDate = includePast
    ? new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]
    : today.toISOString().split('T')[0];
  const endDate = new Date(today.getTime() + days * 86400000).toISOString().split('T')[0];

  try {
    const { data, error } = await getSupabase()
      .from('appointments')
      .select('id, client_name, client_email, client_phone, date, time, services, status, notes, internal_notes')
      .gte('date', startDate)
      .lte('date', endDate)
      .neq('status', 'Cancelled')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) throw new Error(error.message);

    const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bliss Dermacare//Admin Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Bliss Dermacare',
      'X-WR-TIMEZONE:America/New_York',
    ];

    for (const row of (data || [])) {
      if (!row.date) continue;
      const [startH, startM] = parseTime(row.time);
      const endH = startH + 1;
      const startDT = icsDate(row.date, row.time);
      const endDT = `${row.date.replace(/-/g, '')}T${padZ(endH % 24)}${padZ(startM)}00`;

      const summary = icsEscape(`${row.client_name || 'Client'} — ${row.services || 'Appointment'}`);
      const descParts = [
        row.services   ? `Services: ${row.services}` : '',
        row.client_phone ? `Phone: ${row.client_phone}` : '',
        row.client_email ? `Email: ${row.client_email}` : '',
        row.notes ? `Notes: ${row.notes}` : '',
      ].filter(Boolean);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:bliss-appt-${row.id}@blissdermacare.com`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART;TZID=America/New_York:${startDT}`);
      lines.push(`DTEND;TZID=America/New_York:${endDT}`);
      lines.push(foldLine(`SUMMARY:${summary}`));
      if (descParts.length) lines.push(foldLine(`DESCRIPTION:${icsEscape(descParts.join('\\n'))}`));
      lines.push('LOCATION:Bliss Dermacare\\, Tampa FL');
      lines.push(`STATUS:CONFIRMED`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    const icsContent = lines.join('\r\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=UTF-8',
        'Content-Disposition': 'attachment; filename="bliss-appointments.ics"',
        'Cache-Control': 'no-cache, no-store',
      },
      body: icsContent,
    };
  } catch (err) {
    console.error('calendar-ics error:', err);
    return { statusCode: 500, headers: { 'Content-Type': 'text/plain' }, body: err.message };
  }
};
