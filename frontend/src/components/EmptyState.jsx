export default function EmptyState({
  icon = 'inbox',
  title = 'No data yet',
  description = 'There is nothing to show right now.',
  actionLabel,
  onAction,
}) {
  return (
    <div className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-6 text-center">
      <span className="material-symbols-outlined text-4xl text-[#d2bbff]">{icon}</span>
      <h3 className="mt-3 text-base font-bold text-[#e8dfee]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-[#ccc3d8]">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-bold text-[#ede0ff]"
          type="button"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
