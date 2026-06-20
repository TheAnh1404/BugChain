import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { bountyService } from '../services/bountyService';
import { reportService } from '../services/reportService';
import { reviewService } from '../services/reviewService';
import { connectFreighterTestnet } from '../lib/freighter';
import { approveReportOnChain, rejectReportOnChain, refundExpiredBountyOnChain } from '../lib/stellar';
import { transactionService } from '../services/transactionService';

const STELLAR_EXPERT_TESTNET_TX_URL = 'https://stellar.expert/explorer/testnet/tx';

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(new Date(value));
}

export default function BountyDetails({ bountyId, onBack, onSubmitReport, onDeleted }) {
  const { user, isAuthenticated } = useAuth();
  const [bounty, setBounty] = useState(null);
  const [ownerReports, setOwnerReports] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  const isOwner = Boolean(user && bounty && bounty.ownerId === user.id);

  const scopeLines = bounty?.scope
    ? bounty.scope
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  useEffect(() => {
    let isMounted = true;

    async function loadBounty() {
      if (!bountyId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const result = await bountyService.get(bountyId);
        if (isMounted) {
          setBounty(result);
          setIsExpired(new Date(result.deadline).getTime() < Date.now());
        }
        if (isMounted && isAuthenticated) {
          const txs = await transactionService.forBounty(bountyId);
          setTransactions(txs.items || []);
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

    loadBounty();

    return () => {
      isMounted = false;
    };
  }, [bountyId, isAuthenticated]);

  const refreshOwnerReports = async () => {
    if (!bountyId) return;
    setIsReportsLoading(true);

    try {
      const result = await reportService.listForBounty(bountyId, { page: 1, limit: 25 });
      setOwnerReports(result.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsReportsLoading(false);
    }
  };
  useEffect(() => {
    if (!isOwner || !bountyId) return;
    let isMounted = true;

    async function loadReports() {
      setIsReportsLoading(true);
      try {
        const result = await reportService.listForBounty(bountyId, { page: 1, limit: 25 });
        if (isMounted) {
          setOwnerReports(result.items);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsReportsLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      isMounted = false;
    };
  }, [isOwner, bountyId]);

  const handleReview = async (reportId, decision) => {
    setError('');
    setStatus('');

    try {
      const report = ownerReports.find((r) => r.id === reportId);
      if (!report) {
        throw new Error('Report not found in local cache.');
      }
      if (!report.onchainReportId) {
        throw new Error('This report does not have an on-chain report ID.');
      }
      if (!bounty.onchainBountyId) {
        throw new Error('This bounty does not have an on-chain bounty ID.');
      }

      const comment = window.prompt('Review comment (optional):') || undefined;

      setStatus('Connecting Freighter wallet...');
      const connection = await connectFreighterTestnet();
      const ownerAddress = connection.address;

      let txHash = '';
      if (decision === 'approve') {
        setStatus('Submitting approve_report to Soroban contract...');
        const result = await approveReportOnChain({
          ownerAddress,
          onchainBountyId: bounty.onchainBountyId,
          onchainReportId: report.onchainReportId,
        });
        txHash = result.txHash;
        setStatus('Syncing approval to BugChain API...');
        await reviewService.approve(reportId, comment, txHash);
        setStatus('Report approved successfully on-chain!');
      } else {
        setStatus('Submitting reject_report to Soroban contract...');
        const result = await rejectReportOnChain({
          ownerAddress,
          onchainBountyId: bounty.onchainBountyId,
          onchainReportId: report.onchainReportId,
        });
        txHash = result.txHash;
        setStatus('Syncing rejection to BugChain API...');
        await reviewService.reject(reportId, comment, txHash);
        setStatus('Report rejected successfully on-chain!');
      }
      await refreshOwnerReports();
      setBounty(await bountyService.get(bountyId));
      if (isAuthenticated) {
        const txs = await transactionService.forBounty(bountyId);
        setTransactions(txs.items || []);
      }
    } catch (err) {
      setError(err.message);
      setStatus('');
    }
  };

  const handleRefund = async () => {
    if (!window.confirm('Refund locked escrow funds? This will return the reward tokens back to your wallet.')) {
      return;
    }

    setError('');
    setStatus('');

    try {
      if (!bounty.onchainBountyId) {
        throw new Error('This bounty is not registered on-chain.');
      }

      setStatus('Connecting Freighter wallet...');
      const connection = await connectFreighterTestnet();
      const ownerAddress = connection.address;

      setStatus('Submitting refund_expired_bounty to Soroban contract...');
      const result = await refundExpiredBountyOnChain({
        ownerAddress,
        onchainBountyId: bounty.onchainBountyId,
      });

      setStatus('Syncing refund transaction to BugChain API...');
      await bountyService.refundBounty(bounty.id, result.txHash);
      setStatus('Bounty escrow refunded successfully!');

      setBounty(await bountyService.get(bountyId));
      if (isAuthenticated) {
        const txs = await transactionService.forBounty(bountyId);
        setTransactions(txs.items || []);
      }
    } catch (err) {
      setError(err.message);
      setStatus('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this bounty? This only works if it has no reports.')) {
      return;
    }

    setError('');
    setStatus('');

    try {
      await bountyService.remove(bounty.id);
      onDeleted();
    } catch (err) {
      setError(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-80px)] flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-5xl text-[#d2bbff]">
          progress_activity
        </span>
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="flex-1 w-full px-8 py-8">
        <button onClick={onBack} className="text-[#d2bbff]">Back to bounties</button>
        <div className="mt-6 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab]">
          {error || 'Bounty not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full px-8 py-8">
      <div className="flex items-center gap-3 mb-8 text-[#ccc3d8] font-mono text-xs">
        <button onClick={onBack} className="hover:text-[#d2bbff] cursor-pointer">
          BOUNTIES
        </button>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span className="text-[#e8dfee] uppercase truncate">{bounty.id}</span>
        <span className="ml-auto flex items-center gap-2 bg-[#a15100]/10 text-[#ffb784] px-3 py-1 rounded-full border border-[#ffb784]/20 font-bold">
          <span className="w-2 h-2 rounded-full bg-[#ffb784] animate-pulse"></span>
          {bounty.status}
        </span>
      </div>

      {(error || status) && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            error
              ? 'border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab]'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {error || status}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-12">
          <section>
            <h1 className="text-4xl font-bold mb-4 text-[#e8dfee]">{bounty.title}</h1>
            <p className="text-lg text-[#ccc3d8] leading-relaxed whitespace-pre-wrap">
              {bounty.description}
            </p>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#d2bbff]">
              <span className="material-symbols-outlined">rebase_edit</span>
              <h2 className="text-2xl font-bold">Scope</h2>
            </div>
            <div className="glass rounded-2xl overflow-hidden border border-[#4a4455]">
              {scopeLines.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#2c2833] border-b border-[#4a4455]">
                      <th className="px-6 py-4 text-xs font-mono font-bold text-[#e8dfee] uppercase tracking-wider">
                        Target / Rule
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[#ccc3d8]">
                    {scopeLines.map((line, index) => (
                      <tr key={`${line}-${index}`} className="border-b border-[#4a4455]/30">
                        <td className="px-6 py-4 text-sm">{line}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-6 text-sm text-[#ccc3d8]">No scope details provided.</p>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center gap-2 text-[#d2bbff]">
              <span className="material-symbols-outlined">history</span>
              <h2 className="text-2xl font-bold">Transaction History Timeline</h2>
            </div>
            <div className="glass p-6 rounded-2xl border border-[#4a4455]/40">
              {!isAuthenticated ? (
                <div className="text-center py-4">
                  <p className="text-sm text-[#ccc3d8]">Sign in to view the transaction history timeline for this program.</p>
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-[#ccc3d8]">No transaction records found for this bounty.</p>
              ) : (
                <div className="relative border-l-2 border-[#7c3aed]/40 pl-6 ml-3 space-y-6">
                  {transactions.map((tx) => {
                    const explorerUrl = tx.txHash ? `https://stellar.expert/explorer/testnet/tx/${tx.txHash}` : null;
                    return (
                      <div key={tx.id} className="relative">
                        {/* Dot */}
                        <div className="absolute -left-[31px] top-1 bg-[#100d16] border-2 border-[#7c3aed] w-4 h-4 rounded-full flex items-center justify-center">
                          <div className="bg-[#d2bbff] w-1.5 h-1.5 rounded-full"></div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between gap-4">
                            <h4 className="font-bold text-sm text-[#e8dfee] font-mono">{tx.type}</h4>
                            <span className="text-xs text-[#ccc3d8] font-mono">{formatDate(tx.createdAt)}</span>
                          </div>
                          {tx.report && (
                            <p className="text-xs text-[#ccc3d8] mt-1">
                              Report: <span className="font-semibold text-[#e8dfee]">{tx.report.title}</span>
                            </p>
                          )}
                          <p className="text-xs text-[#ccc3d8] mt-1 font-mono">
                            Wallet: <span className="text-[#d2bbff]">{tx.userId}</span>
                          </p>
                          {tx.txHash && (
                            <div className="mt-2 flex items-center gap-3">
                              <span className="text-[11px] font-mono text-[#ccc3d8] bg-[#221e28] px-2 py-0.5 rounded border border-[#4a4455]/30">
                                Tx: {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-8)}
                              </span>
                              <a
                                href={explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#d2bbff] hover:underline"
                              >
                                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                Explorer
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {isOwner && (
            <section className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-[#d2bbff]">
                  <span className="material-symbols-outlined">assignment_turned_in</span>
                  <h2 className="text-2xl font-bold">Submitted Reports</h2>
                </div>
                <button
                  onClick={refreshOwnerReports}
                  className="rounded-lg border border-[#4a4455] px-3 py-2 text-xs font-bold text-[#e8dfee]"
                >
                  Refresh
                </button>
              </div>

              <div className="glass overflow-hidden rounded-2xl border border-[#4a4455]/40">
                {isReportsLoading ? (
                  <div className="flex min-h-40 items-center justify-center">
                    <span className="material-symbols-outlined animate-spin text-4xl text-[#d2bbff]">
                      progress_activity
                    </span>
                  </div>
                ) : ownerReports.length === 0 ? (
                  <p className="p-6 text-sm text-[#ccc3d8]">No reports submitted yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-[#4a4455]/50 bg-[#2c2833]">
                        <tr>
                          <th className="px-4 py-3 text-xs font-mono uppercase text-[#ccc3d8]">Report</th>
                          <th className="px-4 py-3 text-xs font-mono uppercase text-[#ccc3d8]">Hunter</th>
                          <th className="px-4 py-3 text-xs font-mono uppercase text-[#ccc3d8]">Severity</th>
                          <th className="px-4 py-3 text-xs font-mono uppercase text-[#ccc3d8]">Status</th>
                          <th className="px-4 py-3 text-xs font-mono uppercase text-[#ccc3d8] text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#4a4455]/30">
                        {ownerReports.map((report) => (
                          <tr key={report.id}>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-[#e8dfee]">{report.title}</p>
                              <p className="font-mono text-[10px] text-[#ccc3d8]">
                                {formatDate(report.createdAt)}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-sm text-[#ccc3d8]">
                              {report.hunter?.username || report.hunterId}
                            </td>
                            <td className="px-4 py-4">
                              <span className="rounded border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-2 py-1 font-mono text-[10px] text-[#d2bbff]">
                                {report.severity}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-sm text-[#e8dfee]">{report.status}</td>
                            <td className="px-4 py-4 text-right">
                              {report.status === 'PENDING' ? (
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleReview(report.id, 'approve')}
                                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReview(report.id, 'reject')}
                                    className="rounded-lg border border-[#ffb4ab]/40 px-3 py-2 text-xs font-bold text-[#ffb4ab]"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-xs text-[#ccc3d8] font-semibold">{report.status}</span>
                                  {(report.approveTxHash || report.rejectTxHash || report.claimTxHash) && (
                                    <a
                                      href={`${STELLAR_EXPERT_TESTNET_TX_URL}/${report.approveTxHash || report.rejectTxHash || report.claimTxHash}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-[#d2bbff] hover:underline"
                                    >
                                      <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                                      Explorer
                                    </a>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-4 lg:sticky lg:top-24">
          <div className="glass p-8 rounded-2xl space-y-8 border-t-2 border-[#7c3aed] shadow-xl">
            <div className="space-y-2">
              <span className="text-[#ccc3d8] text-xs font-semibold uppercase tracking-widest block">
                Max Reward
              </span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl md:text-5xl font-bold text-[#d2bbff]">
                  {Number(bounty.rewardAmount).toLocaleString()}
                </h3>
                <span className="text-[#e8dfee] text-lg font-bold">{bounty.rewardAsset}</span>
              </div>
              <div className="flex items-center gap-2 py-2 px-3 bg-[#45464e]/20 text-[#b4b4bd] rounded-xl border border-[#45464e]/30">
                <span className="material-symbols-outlined text-[18px]">lock</span>
                <span className="text-xs font-mono">
                  {bounty.txHash ? 'Reward locked on Stellar Testnet' : 'Soroban escrow not confirmed'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-[#4a4455]/30">
              <div className="space-y-1">
                <span className="text-[#ccc3d8] text-[10px] uppercase tracking-widest block font-semibold">
                  Severity
                </span>
                <span className="font-bold text-sm">{bounty.severity}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[#ccc3d8] text-[10px] uppercase tracking-widest block font-semibold">
                  Deadline
                </span>
                <span className="block font-bold text-sm">{formatDate(bounty.deadline)}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[#ccc3d8] text-[10px] uppercase tracking-widest block font-semibold">
                  Reports
                </span>
                <span className="block font-bold text-sm">
                  {bounty._count?.reports ?? 0} Submitted
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[#ccc3d8] text-[10px] uppercase tracking-widest block font-semibold">
                  Status
                </span>
                <span className="block font-bold text-sm text-[#ffb784]">{bounty.status}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#2c2833] border border-[#4a4455]/30">
              <div className="w-10 h-10 rounded-full bg-[#3c3742] overflow-hidden border border-[#7c3aed]/40 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#d2bbff]">account_balance</span>
              </div>
              <div>
                <span className="text-[10px] text-[#ccc3d8] uppercase font-semibold">Program Owner</span>
                <p className="font-bold text-sm text-[#e8dfee]">
                  {bounty.owner?.username || bounty.ownerId}
                </p>
              </div>
              <span className="material-symbols-outlined ml-auto text-[#d2bbff]">verified</span>
            </div>

            {bounty.txHash && (
              <div className="rounded-2xl border border-[#4a4455]/40 bg-[#100d16] p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8]">
                  Stellar Testnet Transaction
                </p>
                <p className="mt-2 break-all font-mono text-xs text-[#e8dfee]">
                  {bounty.txHash}
                </p>
                <a
                  href={bounty.stellarExplorerUrl || `${STELLAR_EXPERT_TESTNET_TX_URL}/${bounty.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-bold text-[#d2bbff] hover:underline"
                >
                  View on Stellar Expert
                </a>
              </div>
            )}

            {bounty.refundTxHash && (
              <div className="rounded-2xl border border-[#4a4455]/40 bg-[#100d16] p-4">
                <p className="text-[10px] uppercase tracking-widest text-[#ffb4ab]">
                  Bounty Refund Transaction
                </p>
                <p className="mt-2 break-all font-mono text-xs text-[#e8dfee]">
                  {bounty.refundTxHash}
                </p>
                <a
                  href={`${STELLAR_EXPERT_TESTNET_TX_URL}/${bounty.refundTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-bold text-[#ffb4ab] hover:underline"
                >
                  View Refund on Stellar Expert
                </a>
              </div>
            )}

            <button
              onClick={() => onSubmitReport(bounty)}
              disabled={isOwner}
              className="w-full bg-[#7c3aed] text-[#ede0ff] py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:brightness-110 active:scale-[0.97] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined">send</span>
              {isAuthenticated ? 'Submit Report' : 'Sign In to Submit'}
            </button>

            {isOwner && bounty.status === 'OPEN' && isExpired && (
              <button
                onClick={handleRefund}
                className="w-full rounded-xl bg-amber-600 text-white py-3 text-sm font-bold active:scale-95 transition-all hover:brightness-110 mb-3"
              >
                Refund Escrow
              </button>
            )}

            {isOwner && (
              <button
                onClick={handleDelete}
                className="w-full rounded-xl border border-[#ffb4ab]/40 py-3 text-sm font-bold text-[#ffb4ab] transition-all hover:bg-[#93000a]/20"
              >
                Delete Bounty
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
