import { captureFrontendException } from '../monitoring/sentry';

const FREIGHTER_REJECTION_PATTERNS = [
  'rejected',
  'denied',
  'cancelled',
  'canceled',
  'user declined',
];

export function getFriendlyErrorMessage(error, fallback = 'Something went wrong.') {
  const message =
    error?.payload?.message ||
    error?.message ||
    (typeof error === 'string' ? error : '') ||
    fallback;

  const normalized = String(message);
  const lower = normalized.toLowerCase();

  if (FREIGHTER_REJECTION_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return 'Freighter request was cancelled. You can retry when ready.';
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Network request failed. Check the backend URL and your connection.';
  }

  if (lower.includes('session expired')) {
    return 'Your session expired. Please sign in again.';
  }

  if (lower.includes('testnet')) {
    return 'Please switch Freighter to Stellar Testnet and retry.';
  }

  return normalized;
}

export function normalizeApiError(error) {
  return {
    status: error?.status,
    message: getFriendlyErrorMessage(error, 'API request failed.'),
    payload: error?.payload,
  };
}

export function normalizeTransactionError(error) {
  captureFrontendException(error);

  return {
    message: getFriendlyErrorMessage(
      error,
      'Transaction failed before it could be confirmed.',
    ),
    retryable: true,
  };
}

export function notifyToast({ type = 'error', message }) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bugchain-toast', {
        detail: { type, message },
      }),
    );
  }
}
