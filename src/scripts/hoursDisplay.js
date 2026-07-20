/**
 * Shared client-side utility — build and render business hours from availability schedule.
 * Used by the booking page, contact page, and any other public pages showing hours.
 */

const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmt24to12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}

/**
 * Collapse a 7-day schedule into grouped rows (e.g. Wednesday – Friday: 12:30 PM – 7:00 PM).
 * @param {Array} schedule - array of {day_of_week, is_open, open_time, close_time}
 * @returns {Array<{label: string, value: string, closed: boolean}>}
 */
export function buildHoursRows(schedule) {
  const rows = [];
  let i = 0;
  while (i < 7) {
    const day = schedule.find(s => s.day_of_week === i) || { day_of_week: i, is_open: false };
    const k = day.is_open ? `${day.open_time}|${day.close_time}` : 'closed';
    let j = i + 1;
    while (j < 7) {
      const next = schedule.find(s => s.day_of_week === j) || { day_of_week: j, is_open: false };
      const nk = next.is_open ? `${next.open_time}|${next.close_time}` : 'closed';
      if (nk !== k) break;
      j++;
    }
    const label = i === j - 1
      ? DAYS_FULL[i]
      : `${DAYS_FULL[i]} \u2013 ${DAYS_FULL[j - 1]}`;
    const value = k === 'closed'
      ? 'Closed'
      : `${fmt24to12(day.open_time)} \u2013 ${fmt24to12(day.close_time)}`;
    rows.push({ label, value, closed: k === 'closed' });
    i = j;
  }
  return rows;
}

/**
 * Render hours rows into a DOM element, replacing its children.
 * @param {HTMLElement} el
 * @param {Array} schedule
 */
export function renderHoursInto(el, schedule) {
  if (!el || !schedule?.length) return;
  const rows = buildHoursRows(schedule);
  el.innerHTML = rows.map(r =>
    `<div class="flex justify-between">
      <span class="text-neutral-600">${r.label}</span>
      <span class="font-medium ${r.closed ? 'text-neutral-400' : 'text-neutral-900'}">${r.value}</span>
    </div>`
  ).join('');
}

/**
 * Fetch availability from the API and render into a DOM element by id.
 * Silently keeps the static HTML fallback on any error.
 * @param {string} elementId
 */
export async function loadAndRenderHours(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  try {
    const resp = await fetch('/.netlify/functions/get-availability');
    if (!resp.ok) return;
    const { schedule } = await resp.json();
    if (schedule?.length) renderHoursInto(el, schedule);
  } catch { /* keep static fallback */ }
}
