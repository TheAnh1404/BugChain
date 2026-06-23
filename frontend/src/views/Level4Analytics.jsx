import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { analyticsService } from '../services/analyticsService';
import { feedbackService } from '../services/feedbackService';

function Stat({ label, value, icon }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="material-symbols-outlined text-[#d2bbff]">{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#958da1]">
          MVP
        </span>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#ccc3d8]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#e8dfee]">{value}</p>
    </div>
  );
}

export default function Level4Analytics() {
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState([]);
  const [walletInteractions, setWalletInteractions] = useState(null);
  const [feedbackSummary, setFeedbackSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [overviewResult, funnelResult, walletResult] = await Promise.all([
        analyticsService.overview(),
        analyticsService.funnel(),
        analyticsService.walletInteractions(),
      ]);
      setOverview(overviewResult);
      setFunnel(funnelResult);
      setWalletInteractions(walletResult);
      try {
        setFeedbackSummary(await feedbackService.summary({ suppressToast: true }));
      } catch {
        setFeedbackSummary(null);
      }
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

  if (isLoading) {
    return (
      <div className="flex-1 w-full px-8 py-8">
        <LoadingState label="Loading Level 4 analytics..." />
      </div>
    );
  }

  const maxFunnel = Math.max(1, ...funnel.map((item) => item.count));

  return (
    <div className="flex-1 w-full px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-8">
        <p className="mb-2 text-xs font-mono font-bold uppercase tracking-widest text-[#d2bbff]">
          Product Analytics
        </p>
        <h1 className="text-3xl font-bold text-[#e8dfee] sm:text-4xl">
          Level 4 MVP Analytics
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#ccc3d8]">
          Production validation metrics from real accounts, wallets, reports, feedback, and proof records.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab]">
          {error}
        </div>
      )}

      {overview ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-6">
            <Stat label="Users" value={overview.totalUsers} icon="group" />
            <Stat label="Wallet Users" value={overview.walletConnectedUsers} icon="account_balance_wallet" />
            <Stat label="Bounties" value={overview.totalBounties} icon="security" />
            <Stat label="Reports" value={overview.totalReports} icon="description" />
            <Stat label="Wallet Proofs" value={overview.totalWalletInteractions} icon="verified" />
            <Stat label="Feedback Avg" value={overview.feedbackAverageRating} icon="star" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="glass rounded-2xl p-6">
              <h2 className="mb-6 text-xl font-bold text-[#e8dfee]">Onboarding Funnel</h2>
              <div className="space-y-4">
                {funnel.map((item) => (
                  <div key={item.step}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-[#e8dfee]">{item.step}</span>
                      <span className="font-mono text-xs text-[#d2bbff]">{item.count}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-[#100d16]">
                      <div
                        className="h-full rounded-full bg-[#7c3aed]"
                        style={{ width: `${(item.count / maxFunnel) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass rounded-2xl p-6">
              <h2 className="mb-6 text-xl font-bold text-[#e8dfee]">Wallet Interactions</h2>
              {walletInteractions?.byAction?.length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {walletInteractions.byAction.map((item) => (
                    <div key={item.action} className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-4">
                      <p className="font-mono text-[10px] font-bold text-[#ccc3d8]">{item.action}</p>
                      <p className="mt-2 text-2xl font-bold text-[#e8dfee]">{item.count}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="account_balance_wallet"
                  title="No wallet interactions"
                  description="Real wallet and transaction proofs will populate this section."
                />
              )}
            </section>
          </div>

          <section className="glass rounded-2xl p-6">
            <h2 className="mb-6 text-xl font-bold text-[#e8dfee]">Latest Feedback</h2>
            {!feedbackSummary || feedbackSummary.latest.length === 0 ? (
              <EmptyState
                icon="forum"
                title="No feedback collected"
                description="Use the Feedback Center during user testing to collect validation notes."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {feedbackSummary.latest.slice(0, 6).map((feedback) => (
                  <div key={feedback.id} className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-[#e8dfee]">{feedback.user?.username}</p>
                      <p className="font-mono text-xs text-[#d2bbff]">{feedback.rating}/5</p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#ccc3d8]">{feedback.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
