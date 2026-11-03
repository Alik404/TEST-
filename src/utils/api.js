/**
 * Single entry point for every call to the API.
 *
 * It attaches the signed session token, and on a 401 it clears the stored
 * session and reloads, so an expired token can never leave the app showing
 * an admin interface it no longer has the rights to use.
 */

import { toast } from './toast';

const TOKEN_KEY = 'project_token';
const USER_KEY = 'project_user';
let memoryToken = null;
let memoryUser = null;

export const getToken = () => {
  try {
    return memoryToken || localStorage.getItem(TOKEN_KEY);
  } catch {
    return memoryToken;
  }
};

export const setSession = (user, token) => {
  memoryToken = token;
  memoryUser = user;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode). The session lives for this tab only.
  }
};

export const clearSession = () => {
  memoryToken = null;
  memoryUser = null;
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
};

export const getStoredUser = () => {
  if (memoryUser) return memoryUser;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

let onUnauthorized = () => {
  clearSession();
  window.location.reload();
};

/** Lets App.jsx replace the default hard reload with a React-level logout. */
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

/**
 * fetch() with the session token attached.
 * Returns a Response on success. Failed mutations throw the server's message
 * so existing callers cannot replace a storage failure with a generic error.
 */
export const apiFetch = async (path, options = {}) => {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    onUnauthorized();
  }

  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase());
  if (mutation && !res.ok) {
    throw new Error(await apiErrorMessage(res.clone(), 'تعذّر إكمال العملية. أعد المحاولة.'));
  }
  if (mutation && res.ok && res.headers.get('X-Storage-Mode') === 'local' && res.headers.get('Content-Type')?.includes('application/json')) {
    const isAr = document.documentElement.lang !== 'en';
    toast.info(isAr ? 'تم الحفظ محلياً على الخادم. التخزين السحابي غير مفعّل.' : 'Saved on this server. Cloud storage is not enabled.');
  }

  return res;
};

/** Reads the error message the API returns, falling back to a generic one. */
export const apiErrorMessage = async (res, fallback) => {
  try {
    const body = await res.json();
    if (body?.error) return body.error;
  } catch {
    // Response had no JSON body.
  }
  return fallback;
};
