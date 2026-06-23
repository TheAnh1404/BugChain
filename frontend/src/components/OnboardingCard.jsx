import { useCallback, useEffect, useState } from 'react';
import { onboardingService } from '../services/onboardingService';
import { trackEvent } from '../lib/analytics';

export default function OnboardingCard({ setCurrentView }) {
  const [state, setState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await onboardingService.me();
      setState(result);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      load();
    }, 0);
  }, [load]);

  if (isLoading || state?.completed) {
    return null;
  }

  const completedCount = state?.steps?.filter((step) => step.completed).length || 0;
  const totalSteps = state?.steps?.length || 0;
  const canComplete = totalSteps > 0 && completedCount === totalSteps;

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      const result = await onboardingService.complete();
      setState(result);
      trackEvent('onboarding_completed');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <section className="glass mb-8 rounded-2xl p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-[#d2bbff]">
            Level 4 Onboarding
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[#e8dfee]">
            Production MVP checklist
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#ccc3d8]">
            Complete these steps with real account, wallet, and transaction activity. Nothing here creates fake proofs.
          </p>
        </div>
        <div className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] px-4 py-3 text-sm text-[#e8dfee]">
          {completedCount}/{totalSteps} complete
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab]">
          {error}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {(state?.steps || []).map((step) => (
          <div
            key={step.id}
            className={`rounded-xl border p-4 ${
              step.completed
                ? 'border-emerald-500/25 bg-emerald-500/10'
                : 'border-[#4a4455]/40 bg-[#100d16]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-xl ${
                step.completed ? 'text-emerald-300' : 'text-[#958da1]'
              }`}
            >
              {step.completed ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            <p className="mt-2 text-sm font-bold text-[#e8dfee]">{step.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={() => setCurrentView('profile')}
          className="rounded-xl border border-[#4a4455] px-4 py-2 text-sm font-bold text-[#e8dfee] hover:bg-[#221e28]"
          type="button"
        >
          Open Profile
        </button>
        <button
          onClick={() => setCurrentView('feedback')}
          className="rounded-xl border border-[#4a4455] px-4 py-2 text-sm font-bold text-[#e8dfee] hover:bg-[#221e28]"
          type="button"
        >
          Submit Feedback
        </button>
        <button
          onClick={handleComplete}
          disabled={!canComplete || isCompleting}
          className="rounded-xl bg-[#7c3aed] px-4 py-2 text-sm font-bold text-[#ede0ff] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          {isCompleting ? 'Completing...' : 'Mark Complete'}
        </button>
      </div>
    </section>
  );
}
