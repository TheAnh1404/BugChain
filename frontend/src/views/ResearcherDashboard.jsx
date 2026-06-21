import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBugChainEvents } from '../hooks/useBugChainEvents';
import { bountyService } from '../services/bountyService';
import { reportService } from '../services/reportService';
import { reputationService } from '../services/reputationService';
import { transactionService } from '../services/transactionService';
import { walletService } from '../services/walletService';
import { shortenAddress } from '../utils/shortenAddress';
import { connectFreighterTestnet } from '../lib/freighter';
import { claimRewardOnChain } from '../lib/stellar';

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getStatusClass(status) {
  if (status === 'SUCCESS') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  if (status === 'FAILED') {
    return 'border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab]';
  }
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
}

export default function ResearcherDashboard({ setCurrentView }) {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [recommendedBounties, setRecommendedBounties] = useState([]);
  const [reputationProfile, setReputationProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshDashboard = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setIsLoading(true);
    }
    setError('');
    try {
      const [reportResult, transactionResult, walletResult, bountyResult, reputationResult] =
        await Promise.all([
          reportService.mine({ limit: 10 }),
          transactionService.mine({ limit: 8 }),
          walletService.mine(),
          bountyService.list({ status: 'OPEN', limit: 3 }),
          reputationService.me(),
        ]);

      setReports(reportResult.items);
      setTransactions(transactionResult.items);
      setWallets(walletResult);
      setRecommendedBounties(bountyResult.items);
      setReputationProfile(reputationResult);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!quiet) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      await refreshDashboard();
    }

    loadDashboard();
  }, [refreshDashboard]);

  useBugChainEvents(() => {
    refreshDashboard({ quiet: true });
  }, Boolean(user));

  const handleClaim = async (report) => {
    setError('');
    setIsLoading(true);
    try {
      if (!report.onchainReportId) {
        throw new Error('Report is not registered on-chain.');
      }
      if (!report.bounty?.onchainBountyId) {
        throw new Error('Bounty is not registered on-chain.');
      }

      const connection = await connectFreighterTestnet();
      const hunterAddress = connection.address;

      const pendingTransaction = await transactionService.start({
        type: 'CLAIM_REWARD',
        bountyId: report.bountyId,
        reportId: report.id,
      });

      let result;
      try {
        result = await claimRewardOnChain({
          hunterAddress,
          onchainBountyId: report.bounty.onchainBountyId,
          onchainReportId: report.onchainReportId,
        });
      } catch (txError) {
        await transactionService.fail(pendingTransaction.id).catch(() => {});
        throw txError;
      }

      await reportService.claimReward(report.id, result.txHash, pendingTransaction.id);
      await refreshDashboard();
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const approvedReports = reports.filter((report) =>
    ['APPROVED', 'PAID'].includes(report.status),
  ).length;
  const pendingReports = reports.filter((report) => report.status === 'PENDING').length;

  return (
    <div className="flex-1 w-full px-8 py-8 min-h-screen">
      <div className="flex flex-col mb-10">
        <h1 className="text-4xl font-bold text-[#e8dfee]">Researcher Console</h1>
        <p className="text-sm text-[#ccc3d8] mt-1.5">
          Welcome back, {user?.username}. Your reports, wallets, and transaction records are loaded from BugChain API.
        </p>
      </div>

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
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
            <div className="glass p-6 rounded-2xl relative overflow-hidden group hover:border-[#7c3aed]/40 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-[#7c3aed]/10 rounded-xl">
                  <span className="material-symbols-outlined text-[#d2bbff]">description</span>
                </div>
                <span className="text-[10px] font-mono text-[#d2bbff] uppercase font-bold bg-[#7c3aed]/10 px-2.5 py-1 rounded-lg">
                  {pendingReports} Pending
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#ccc3d8] text-xs font-mono uppercase tracking-widest font-semibold">
                  Submitted Reports
                </span>
                <span className="text-[#e8dfee] text-3xl font-bold mt-1.5">
                  {reports.length}
                </span>
              </div>
            </div>

            <div className="glass p-6 rounded-2xl relative overflow-hidden group hover:border-[#7c3aed]/40 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-[#ffb784]/10 rounded-xl">
                  <span className="material-symbols-outlined text-[#ffb784]">check_circle</span>
                </div>
                <span className="text-[10px] font-mono text-[#ffb784] uppercase font-bold bg-[#ffb784]/10 px-2.5 py-1 rounded-lg">
                  Reviewed
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#ccc3d8] text-xs font-mono uppercase tracking-widest font-semibold">
                  Approved Reports
                </span>
                <span className="text-[#e8dfee] text-3xl font-bold mt-1.5">
                  {approvedReports}
                </span>
              </div>
            </div>

            <div className="glass p-6 rounded-2xl relative overflow-hidden group hover:border-[#7c3aed]/40 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-[#c6c6cf]/10 rounded-xl">
                  <span className="material-symbols-outlined text-[#c6c6cf]">
                    account_balance_wallet
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#c6c6cf] uppercase font-bold bg-[#c6c6cf]/10 px-2.5 py-1 rounded-lg">
                  Wallets
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#ccc3d8] text-xs font-mono uppercase tracking-widest font-semibold">
                  Linked Wallets
                </span>
                <span className="text-[#e8dfee] text-3xl font-bold mt-1.5">
                  {wallets.length}
                </span>
              </div>
            </div>

            <div className="glass p-6 rounded-2xl relative overflow-hidden group hover:border-[#7c3aed]/40 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                  <span className="material-symbols-outlined text-emerald-300">military_tech</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-300 uppercase font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                  {reputationProfile?.hunterLevel || 'Level 1'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#ccc3d8] text-xs font-mono uppercase tracking-widest font-semibold">
                  Severity Score
                </span>
                <span className="text-[#e8dfee] text-3xl font-bold mt-1.5">
                  {reputationProfile?.severityScore ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="glass rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-[#e8dfee]">Submitted Reports</h2>
                  <button
                    onClick={() => setCurrentView('submit')}
                    className="text-[#d2bbff] text-xs font-mono font-bold uppercase hover:underline"
                  >
                    Submit New
                  </button>
                </div>

                {reports.length === 0 ? (
                  <div className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-6 text-center">
                    <p className="text-sm text-[#ccc3d8]">No reports submitted yet.</p>
                    <button
                      onClick={() => setCurrentView('marketplace')}
                      className="mt-4 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-bold text-[#ede0ff]"
                    >
                      Explore Bounties
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-[#4a4455]/55">
                          <th className="pb-4 text-xs font-mono font-bold text-[#ccc3d8] uppercase tracking-wider px-2">
                            Report / Program
                          </th>
                          <th className="pb-4 text-xs font-mono font-bold text-[#ccc3d8] uppercase tracking-wider px-2">
                            Severity
                          </th>
                          <th className="pb-4 text-xs font-mono font-bold text-[#ccc3d8] uppercase tracking-wider px-2">
                            Status
                          </th>
                          <th className="pb-4 text-xs font-mono font-bold text-[#ccc3d8] uppercase tracking-wider px-2 text-right">
                            Action
                          </th>
                          <th className="pb-4 text-xs font-mono font-bold text-[#ccc3d8] uppercase tracking-wider px-2 text-right">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#4a4455]/30">
                        {reports.map((report) => {
                          let tagClass = 'bg-[#4a4455]/30 text-[#ccc3d8] border-[#4a4455]/30';
                          if (report.severity === 'CRITICAL') {
                            tagClass = 'bg-[#93000a]/20 text-[#ffb4ab] border-[#ffb4ab]/20';
                          } else if (report.severity === 'HIGH') {
                            tagClass = 'bg-[#a15100]/20 text-[#ffb784] border-[#ffb784]/20';
                          }

                          let statusDot = 'bg-[#7c3aed]';
                          if (report.status === 'APPROVED') statusDot = 'bg-emerald-500';
                          else if (report.status === 'REJECTED') statusDot = 'bg-[#ffb4ab]';
                          else if (report.status === 'PENDING') statusDot = 'bg-amber-500';

                          return (
                            <tr key={report.id} className="group hover:bg-[#221e28]/40 transition-colors">
                              <td className="py-4 px-2">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-sm text-[#e8dfee]">
                                    {report.title}
                                  </span>
                                  <span className="font-mono text-xs text-[#ccc3d8]">
                                    {report.bounty?.title || report.bountyId}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${tagClass}`}>
                                  {report.severity}
                                </span>
                              </td>
                              <td className="py-4 px-2">
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${statusDot}`}></span>
                                  <span className="text-xs text-[#e8dfee]">{report.status}</span>
                                </div>
                              </td>
                              <td className="py-4 px-2 text-right">
                                {report.status === 'APPROVED' && report.bounty?.status === 'COMPLETED' ? (
                                  <button
                                    onClick={() => handleClaim(report)}
                                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:brightness-110 active:scale-95 transition-all"
                                  >
                                    Claim Reward
                                  </button>
                                ) : report.status === 'PAID' ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs text-emerald-400 font-mono font-bold flex items-center justify-end gap-1">
                                      <span className="material-symbols-outlined text-[14px]">payments</span>
                                      Paid
                                    </span>
                                    {report.claimTxHash && (
                                      <a
                                        href={`https://stellar.expert/explorer/testnet/tx/${report.claimTxHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[10px] text-[#d2bbff] hover:underline"
                                      >
                                        <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                        Explorer
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#ccc3d8]/60 font-mono">-</span>
                                )}
                              </td>
                              <td className="py-4 px-2 text-right text-[#ccc3d8] font-mono text-xs">
                                {formatDate(report.createdAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="glass p-6 rounded-2xl">
                <h3 className="text-sm font-mono font-bold text-[#e8dfee] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#d2bbff]">receipt_long</span>
                  Transaction Records
                </h3>
                {transactions.length === 0 ? (
                  <p className="text-sm text-[#ccc3d8]">No transaction records yet.</p>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-[#4a4455]/30 bg-[#100d16] p-4"
                      >
                        <div>
                          <p className="font-mono text-xs font-bold text-[#e8dfee]">
                            {transaction.type}
                          </p>
                          <p className="mt-1 text-xs text-[#ccc3d8]">
                            {transaction.bounty?.title || transaction.report?.title || 'Account action'}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-[#958da1]">
                            {formatDateTime(transaction.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] ${getStatusClass(transaction.status)}`}>
                            {transaction.status}
                          </span>
                          {transaction.txHash && (
                            <a
                              href={`https://stellar.expert/explorer/testnet/tx/${transaction.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-[#d2bbff] hover:underline"
                            >
                              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                              Explorer
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold text-[#e8dfee] mb-6">Hunter Reputation</h2>
                <div className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-[#e8dfee]">
                        {reputationProfile?.hunterLevel || 'Level 1'}
                      </p>
                      <p className="mt-1 text-xs text-[#ccc3d8]">
                        {reputationProfile?.successRate ?? 0}% approval rate
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-emerald-300">
                        {Number(reputationProfile?.earnedXLM || 0).toLocaleString()} XLM
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-[#958da1]">
                        Earned
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(reputationProfile?.badges || []).length === 0 ? (
                      <span className="rounded-lg border border-[#4a4455]/40 px-2 py-1 text-[10px] text-[#ccc3d8]">
                        No badges yet
                      </span>
                    ) : (
                      reputationProfile.badges.map((badge) => (
                        <span
                          key={badge.badge}
                          className="rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-2 py-1 font-mono text-[10px] font-bold text-[#d2bbff]"
                        >
                          {badge.badge.replace(/_/g, ' ')}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="glass rounded-2xl p-6">
                <h2 className="text-xl font-bold text-[#e8dfee] mb-6">Wallets</h2>
                {wallets.length === 0 ? (
                  <div className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-4">
                    <p className="text-sm text-[#ccc3d8]">No linked wallet.</p>
                    <button
                      onClick={() => setCurrentView('profile')}
                      className="mt-4 rounded-xl border border-[#7c3aed] px-4 py-2 text-xs font-bold text-[#d2bbff]"
                    >
                      Link Wallet
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {wallets.map((wallet) => (
                      <div key={wallet.id} className="rounded-xl bg-[#100d16] p-4 border border-[#4a4455]/40">
                        <p className="truncate font-mono text-xs text-[#e8dfee]">
                          {shortenAddress(wallet.walletAddress)}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-[#ccc3d8]">
                          {wallet.isPrimary ? 'Primary' : 'Linked'} - {wallet.verifiedAt ? 'Verified' : 'Pending'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass p-6 rounded-2xl">
                <h3 className="text-sm font-mono font-bold text-[#e8dfee] mb-4">
                  Recommended Programs
                </h3>
                <div className="space-y-4">
                  {recommendedBounties.map((bounty) => (
                    <button
                      key={bounty.id}
                      onClick={() => {
                        setCurrentView('marketplace');
                      }}
                      className="w-full text-left flex items-center gap-3 rounded-xl border border-[#4a4455]/30 bg-[#100d16] p-3 hover:border-[#7c3aed]/50"
                    >
                      <div className="w-8 h-8 rounded bg-[#2c2833] flex items-center justify-center border border-[#4a4455]/30">
                        <span className="material-symbols-outlined text-[#d2bbff] text-[18px]">
                          security
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="truncate text-xs font-semibold text-[#e8dfee]">
                            {bounty.title}
                          </span>
                          <span className="shrink-0 text-[10px] font-mono text-[#d2bbff]">
                            {Number(bounty.rewardAmount).toLocaleString()} {bounty.rewardAsset}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-[#ccc3d8]">
                          {bounty.severity}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentView('marketplace')}
                  className="w-full py-2.5 border border-[#4a4455] rounded-xl text-xs font-semibold text-[#ccc3d8] hover:bg-[#2c2833] hover:text-[#e8dfee] transition-colors mt-6"
                >
                  Explore All Programs
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
