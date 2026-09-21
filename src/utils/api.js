/**
 * Single entry point for every call to the API.
 *
 * It attaches the signed session token, and on a 401 it clears the stored
 * session and reloads, so an expired token can never leave the app showing
 * an admin interface it no longer has the rights to use.
 */

const TOKEN_KEY = 'project_token';
const USER_KEY = 'project_user';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setSession = (user, token) => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage unavailable (private mode). The session lives for this tab only.
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
};

export const getStoredUser = () => {
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
 * Same signature and return value as fetch, so call sites keep using res.ok /
 * res.json() exactly as before.
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
