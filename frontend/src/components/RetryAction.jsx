export default function RetryAction({ message, onRetry, isRetrying = false }) {
  return (
    <div className="rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 p-4 text-sm text-[#ffb4ab]">
      <p>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="mt-3 rounded-lg border border-[#ffb4ab]/30 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-[#93000a]/30 disabled:opacity-60"
          type="button"
        >
          {isRetrying ? 'Retrying...' : 'Retry'}
        </button>
      )}
    </div>
  );
}
