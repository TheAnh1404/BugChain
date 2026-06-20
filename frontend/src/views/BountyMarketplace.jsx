import { useEffect, useState } from 'react';
import { bountyService } from '../services/bountyService';
import { useAuth } from '../context/AuthContext';

function formatDeadline(deadline) {
  if (!deadline) return 'No deadline';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `${days}d remaining`;
}

export default function BountyMarketplace({ onSelectBounty, setCurrentView }) {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const [bounties, setBounties] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const severities = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const statuses = ['ALL', 'OPEN', 'DRAFT', 'UNDER_REVIEW', 'COMPLETED', 'EXPIRED'];

  useEffect(() => {
    let isMounted = true;

    async function loadBounties() {
      setIsLoading(true);
      setError('');

      try {
        const result = await bountyService.list({
          search,
          severity: selectedSeverity === 'ALL' ? undefined : selectedSeverity,
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          page,
          limit: 9,
        });

        if (isMounted) {
          setBounties(result.items);
          setMeta(result.meta);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBounties();

    return () => {
      isMounted = false;
    };
  }, [search, selectedSeverity, selectedStatus, page]);

  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="flex-1 w-full px-8 py-8">
      <section className="mb-12 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#e8dfee] mb-3">
            Secure the Future of Soroban
          </h1>
          <p className="text-base text-[#ccc3d8] max-w-2xl leading-relaxed">
            Browse live bounty records from the BugChain backend and submit high-quality vulnerability reports.
          </p>
        </div>
        <button
          onClick={() => setCurrentView(isAuthenticated ? 'create-bounty' : 'login')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-6 py-3 font-bold text-[#ede0ff] transition-all hover:brightness-110"
        >
          <span className="material-symbols-outlined">add_business</span>
          Launch Bounty
        </button>
      </section>

      <section className="mb-8 p-6 glass rounded-2xl">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-mono text-[#ccc3d8] mb-2 uppercase tracking-widest font-semibold">
              Search Bounties
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#ccc3d8]/40">
                search
              </span>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#100d16] border border-[#4a4455] rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-[#7c3aed] text-sm text-[#e8dfee] transition-all"
                placeholder="Protocol name, scope, description..."
                type="text"
              />
            </div>
          </div>

          <div className="w-full md:w-auto">
            <label className="block text-xs font-mono text-[#ccc3d8] mb-2 uppercase tracking-widest font-semibold">
              Severity
            </label>
            <div className="flex flex-wrap gap-2">
              {severities.map((severity) => (
                <button
                  key={severity}
                  onClick={() => handleFilterChange(setSelectedSeverity)(severity)}
                  className={`px-4 py-2 border rounded-xl text-xs font-medium transition-all ${
                    selectedSeverity === severity
                      ? 'bg-[#7c3aed]/20 text-[#d2bbff] border-[#7c3aed]/50'
                      : 'border-[#4a4455] hover:border-[#7c3aed] bg-[#100d16] text-[#ccc3d8]'
                  }`}
                >
                  {severity.charAt(0) + severity.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full md:w-auto">
            <label className="block text-xs font-mono text-[#ccc3d8] mb-2 uppercase tracking-widest font-semibold">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value);
                setPage(1);
              }}
              className="input-dark rounded-xl px-4 py-2 text-xs font-medium"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

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
      ) : bounties.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <h3 className="text-xl font-bold text-[#e8dfee]">No bounties found</h3>
          <p className="mt-2 text-sm text-[#ccc3d8]">
            Try different filters or launch the first bounty.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {bounties.map((bounty) => {
              let tagClass = 'bg-[#4a4455]/30 text-[#ccc3d8] border-[#4a4455]';
              if (bounty.severity === 'CRITICAL') {
                tagClass = 'bg-[#93000a]/20 text-[#ffb4ab] border-[#ffb4ab]/30';
              } else if (bounty.severity === 'HIGH') {
                tagClass = 'bg-[#a15100]/20 text-[#ffb784] border-[#ffb784]/30';
              } else if (bounty.severity === 'MEDIUM') {
                tagClass = 'bg-[#221e28] text-[#d2bbff] border-[#7c3aed]/30';
              }

              return (
                <button
                  key={bounty.id}
                  onClick={() => onSelectBounty(bounty)}
                  className="glass rounded-2xl p-6 flex flex-col bounty-card-hover cursor-pointer text-left"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${tagClass}`}>
                      {bounty.severity}
                    </span>
                    <div className="flex items-center gap-1 text-[#ccc3d8] text-xs font-mono">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      {formatDeadline(bounty.deadline)}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold mb-2 text-[#e8dfee] line-clamp-2">
                    {bounty.title}
                  </h3>

                  <div className="font-mono text-xs text-[#ccc3d8] mb-6 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">person</span>
                    {bounty.owner?.username || bounty.ownerId}
                  </div>

                  <div className="mt-auto pt-6 border-t border-[#4a4455]/30 flex items-end justify-between">
                    <div>
                      <p className="text-[#ccc3d8] text-[10px] uppercase tracking-wider mb-1">
                        Max Reward
                      </p>
                      <p className="text-[#d2bbff] font-bold text-2xl leading-none">
                        {Number(bounty.rewardAmount).toLocaleString()}{' '}
                        <span className="text-xs font-normal">{bounty.rewardAsset}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#ccc3d8] text-[10px] mb-1">Reports</p>
                      <p className="font-mono text-sm text-[#e8dfee]">
                        {bounty._count?.reports ?? 0} Submitted
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between rounded-2xl border border-[#4a4455]/40 bg-[#100d16] px-4 py-3">
            <span className="text-xs font-mono text-[#ccc3d8]">
              Page {meta.page} of {Math.max(1, meta.totalPages)} · {meta.total} bounties
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-[#4a4455] px-3 py-2 text-xs font-bold text-[#e8dfee] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((value) => value + 1)}
                disabled={page >= meta.totalPages}
                className="rounded-lg border border-[#4a4455] px-3 py-2 text-xs font-bold text-[#e8dfee] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
