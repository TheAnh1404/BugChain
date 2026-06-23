export default function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="glass flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center">
      <span className="material-symbols-outlined animate-spin text-5xl text-[#d2bbff]">
        progress_activity
      </span>
      <p className="text-sm text-[#ccc3d8]">{label}</p>
    </div>
  );
}
