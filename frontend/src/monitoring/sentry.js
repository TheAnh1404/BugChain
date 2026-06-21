import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });
}

export function captureFrontendException(error) {
  if (dsn) {
    Sentry.captureException(error);
  }
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
