import { normalizeApiError, notifyToast } from '../lib/errors';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'bugchain_access_token';
const REFRESH_TOKEN_KEY = 'bugchain_refresh_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setStoredTokens(accessToken, refreshToken) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh() {
  return new Promise((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject });
  });
}

function onRefreshed(token) {
  refreshSubscribers.forEach((subscriber) => subscriber.resolve(token));
  refreshSubscribers = [];
}

function onRefreshFailed(error) {
  refreshSubscribers.forEach((subscriber) => subscriber.reject(error));
  refreshSubscribers = [];
}

export async function apiRequest(path, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body !== undefined && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  });

  if (response.status === 401 && options.auth !== false) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      let nextAccessToken;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            const resData = await refreshResponse.json();
            const data = resData.data ?? resData;
            setStoredTokens(data.accessToken, data.refreshToken);
            nextAccessToken = data.accessToken;
            isRefreshing = false;
            onRefreshed(data.accessToken);
          } else {
            throw new Error('Session expired');
          }
        } catch (err) {
          isRefreshing = false;
          clearStoredToken();
          window.dispatchEvent(new Event('auth-logout'));
          onRefreshFailed(err);
          throw err;
        }
      } else {
        nextAccessToken = await subscribeTokenRefresh();
      }

      headers.set('Authorization', `Bearer ${nextAccessToken}`);
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
        body:
          options.body !== undefined && typeof options.body !== 'string'
            ? JSON.stringify(options.body)
            : options.body,
      });
    }
  }

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : payload?.message || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    const normalized = normalizeApiError(error);
    if (response.status !== 401 && !options.suppressToast) {
      notifyToast({ type: 'error', message: normalized.message });
    }
    throw error;
  }

  return payload?.data ?? payload;
}

export function toQueryString(params) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });

  const value = query.toString();
  return value ? `?${value}` : '';
}
