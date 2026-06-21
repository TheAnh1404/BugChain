import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBugChainEvents } from '../hooks/useBugChainEvents';
import { analyticsService } from '../services/analyticsService';

function MetricCard({ icon, label, value, tone = 'text-[#d2bbff]' }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className={`material-symbols-outlined ${tone}`}>{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#958da1]">
          Level 3
        </span>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#ccc3d8]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-[#e8dfee]">{value}</p>
    </div>
  );
}

function BarSeries({ title, data, valueKey, accent = '#d2bbff' }) {
  const maxValue = Math.max(1, ...data.map((item) => Number(item[valueKey]) || 0));

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="mb-6 text-xl font-bold text-[#e8dfee]">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-[#ccc3d8]">No data yet.</p>
      ) : (
        <div className="flex h-56 items-end gap-3">
          {data.map((item) => {
            const value = Number(item[valueKey]) || 0;
            return (
              <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-44 w-full items-end rounded bg-[#100d16] px-1">
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${Math.max(4, (value / maxValue) * 100)}%`,
                      backgroundColor: accent,
                    }}
                    title={`${item.date}: ${value}`}
                  />
                </div>
                <span className="w-full truncate text-center font-mono text-[10px] text-[#958da1]">
                  {item.date.slice(5)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SeverityDistribution({ data }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const colors = {
    LOW: 'bg-emerald-500',
    MEDIUM: 'bg-[#d2bbff]',
    HIGH: 'bg-[#ffb784]',
    CRITICAL: 'bg-[#ffb4ab]',
  };

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="mb-6 text-xl font-bold text-[#e8dfee]">Severity Distribution</h2>
      <div className="mb-6 flex h-5 overflow-hidden rounded-full bg-[#100d16]">
        {data.map((item) => (
          <div
            key={item.severity}
            className={colors[item.severity]}
            style={{ width: `${total === 0 ? 0 : (item.count / total) * 100}%` }}
            title={`${item.severity}: ${item.count}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {data.map((item) => (
          <div key={item.severity} className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${colors[item.severity]}`} />
              <span className="font-mono text-xs font-bold text-[#e8dfee]">
                {item.severity}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-[#d2bbff]">{item.count}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshAnalytics = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setIsLoading(true);
    }
    try {
      const result = await analyticsService.security();
      setAnalytics(result);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      if (!quiet) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    async function loadAnalytics() {
      await refreshAnalytics();
    }

    loadAnalytics();
  }, [refreshAnalytics]);

  useBugChainEvents(() => {
    refreshAnalytics({ quiet: true });
  }, true);

  const metrics = analytics?.metrics;
  const rewardSeries = useMemo(
    () => (analytics?.rewardsOverTime || []).map((item) => ({
      ...item,
      amount: Number(item.amount),
    })),
    [analytics],
  );

  return (
    <div className="flex-1 w-full px-8 py-8">
      <header className="mb-8">
        <p className="mb-2 text-xs font-mono font-bold uppercase tracking-widest text-[#d2bbff]">
          Security Analytics
        </p>
        <h1 className="text-4xl font-bold text-[#e8dfee]">Level 3 Analytics Dashboard</h1>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab]">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="glass flex min-h-64 items-center justify-center rounded-2xl">
          <span className="material-symbols-outlined animate-spin text-5xl text-[#d2bbff]">
            progress_activity
          </span>
        </div>
      ) : analytics ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon="security" label="Total Bounties" value={metrics.totalBounties} />
            <MetricCard icon="description" label="Total Reports" value={metrics.totalReports} />
            <MetricCard icon="verified" label="Approval Rate" value={`${metrics.approvalRate}%`} tone="text-emerald-300" />
            <MetricCard icon="schedule" label="Avg Resolution" value={`${metrics.averageResolutionTimeHours}h`} tone="text-[#ffb784]" />
            <MetricCard icon="payments" label="Rewards Paid" value={`${Number(metrics.rewardsPaid).toLocaleString()} XLM`} tone="text-emerald-300" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <BarSeries
              title="Reports Over Time"
              data={analytics.reportsOverTime}
              valueKey="total"
            />
            <BarSeries
              title="Rewards Over Time"
              data={rewardSeries}
              valueKey="amount"
              accent="#34d399"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SeverityDistribution data={analytics.severityDistribution} />

            <section className="glass rounded-2xl p-6 xl:col-span-2">
              <h2 className="mb-6 text-xl font-bold text-[#e8dfee]">Hunter Leaderboard</h2>
              {analytics.hunterLeaderboard.length === 0 ? (
                <p className="text-sm text-[#ccc3d8]">No ranked hunters yet.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.hunterLeaderboard.map((profile, index) => (
                    <div
                      key={profile.userId}
                      className="flex items-center gap-4 rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-4"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#221e28] font-mono text-xs font-bold text-[#d2bbff]">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-[#e8dfee]">
                          {profile.user?.username || profile.userId}
                        </p>
                        <p className="text-xs text-[#ccc3d8]">
                          {profile.hunterLevel} - {profile.successRate}% success
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-[#d2bbff]">
                          {profile.severityScore}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-[#958da1]">
                          Severity
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="font-mono text-sm font-bold text-emerald-300">
                          {Number(profile.earnedXLM).toLocaleString()} XLM
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-[#958da1]">
                          Earned
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
