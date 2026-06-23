type AnalyticsProperties = Record<string, unknown>;

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';
const anonymousIdKey = 'bugchain_analytics_id';

function getDistinctId() {
  const existing = localStorage.getItem(anonymousIdKey);
  if (existing) {
    return existing;
  }

  const next = globalThis.crypto?.randomUUID?.() || `anon-${Date.now()}`;
  localStorage.setItem(anonymousIdKey, next);
  return next;
}

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}) {
  if (!posthogKey || typeof window === 'undefined') {
    return;
  }

  const payload = JSON.stringify({
    api_key: posthogKey,
    event: eventName,
    properties: {
      distinct_id: String(properties.userId || getDistinctId()),
      app: 'bugchain',
      ...properties,
    },
  });

  const url = `${posthogHost.replace(/\/$/, '')}/capture/`;

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    return;
  }

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
