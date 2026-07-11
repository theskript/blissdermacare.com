/**
 * Client-side admin authentication utilities.
 * Stored in localStorage under 'bliss_admin_token' and 'bliss_admin_role'.
 */

export const TOKEN_KEY = 'bliss_admin_token';
export const ROLE_KEY  = 'bliss_admin_role';

/** Returns the stored token or null. */
export function getToken() {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
}

/** Returns the stored role ('owner'|'staff') or null. */
export function getRole() {
  return typeof localStorage !== 'undefined' ? localStorage.getItem(ROLE_KEY) : null;
}

/** Decode JWT payload without verifying signature (client-side only). */
export function decodePayload(token) {
  try {
    const part = token.split('.')[1];
    // base64url → base64
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Returns true if token exists and is not expired. */
export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  const payload = decodePayload(token);
  if (!payload) return false;
  return payload.exp > Math.floor(Date.now() / 1000);
}

/**
 * Redirects to /admin/login if not authenticated.
 * Call at the top of every admin page script.
 */
export function requireLogin() {
  if (!isAuthenticated()) {
    clearAuth();
    window.location.href = '/admin/login';
  }
}

/** Clears stored credentials. */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

/** Stores credentials after a successful login. */
export function storeAuth(token, role) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

/**
 * Authenticated fetch wrapper for Netlify function endpoints.
 * @param {string} endpoint
 * @param {{ method?: string, body?: any, params?: Record<string,any> }} [options]
 * @returns {Promise<any>}
 */
export async function apiFetch(endpoint, { method = 'GET', body = null, params = {} } = {}) {
  const token = getToken();
  const url = new URL(`/.netlify/functions/${endpoint}`, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/admin/login';
    return null;
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `API error ${res.status}`);
  }
  return res.json();
}

/** Format a YYYY-MM-DD date string for display. */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Status badge color classes. */
export const STATUS_COLORS = {
  'Confirmed':       'bg-emerald-100 text-emerald-700',
  'Completed':       'bg-blue-100 text-blue-700',
  'Pending Payment': 'bg-amber-100 text-amber-700',
  'Cancelled':       'bg-red-100 text-red-700',
  'No-Show':         'bg-purple-100 text-purple-700',
};
