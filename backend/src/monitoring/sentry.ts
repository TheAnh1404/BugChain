import * as Sentry from '@sentry/node';

let isInitialized = false;
let warnedMissingDsn = false;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    if (!warnedMissingDsn) {
      console.warn('Sentry backend DSN is not configured; runtime error monitoring is disabled.');
      warnedMissingDsn = true;
    }
    return;
  }

  if (isInitialized) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  });

  isInitialized = true;
}

export function captureException(error: unknown) {
  if (isInitialized) {
    Sentry.captureException(error);
  }
}
