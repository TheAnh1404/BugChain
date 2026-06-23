import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { notifyToast } from '../lib/errors';
import { userProofService } from '../services/userProofService';
import { shortenAddress } from '../utils/shortenAddress';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

export default function UserProofsPage() {
  const [proofs, setProofs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setProofs(await userProofService.list());
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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await userProofService.downloadCsv();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bugchain-user-proofs.csv';
      link.click();
      URL.revokeObjectURL(url);
      notifyToast({ type: 'success', message: 'Wallet proof CSV exported.' });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full px-8 py-8">
        <LoadingState label="Loading wallet interaction proofs..." />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-mono font-bold uppercase tracking-widest text-[#d2bbff]">
            Level 4 Evidence
          </p>
          <h1 className="text-3xl font-bold text-[#e8dfee] sm:text-4xl">
            User Wallet Interaction Proofs
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#ccc3d8]">
            These rows are recorded only from verified wallet links or completed transaction syncs.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting || proofs.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] disabled:opacity-50"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab]">
          {error}
        </div>
      )}

      {proofs.length === 0 ? (
        <EmptyState
          icon="account_balance_wallet"
          title="No wallet proofs yet"
          description="Onboard real users, connect wallets, and complete real Testnet actions to populate this table."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border border-[#4a4455]/40 lg:block">
            <table className="w-full min-w-[960px] bg-[#100d16] text-left">
              <thead>
                <tr className="border-b border-[#4a4455]/40">
                  {['User', 'Wallet', 'Action', 'Tx Hash', 'Time'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4a4455]/30">
                {proofs.map((proof) => (
                  <tr key={proof.id}>
                    <td className="px-4 py-4">
                      <p className="font-bold text-[#e8dfee]">{proof.user?.username}</p>
                      <p className="font-mono text-xs text-[#958da1]">{proof.user?.email}</p>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-[#e8dfee]">
                      {shortenAddress(proof.walletAddress)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-2.5 py-1 font-mono text-[10px] font-bold text-[#d2bbff]">
                        {proof.action}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {proof.txHash ? (
                        <a
                          href={proof.stellarExplorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-[#d2bbff] hover:underline"
                        >
                          {shortenAddress(proof.txHash)}
                        </a>
                      ) : (
                        <span className="text-xs text-[#958da1]">Wallet signature</span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-[#ccc3d8]">
                      {formatDateTime(proof.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 lg:hidden">
            {proofs.map((proof) => (
              <div key={proof.id} className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#e8dfee]">{proof.user?.username}</p>
                    <p className="font-mono text-xs text-[#958da1]">{shortenAddress(proof.walletAddress)}</p>
                  </div>
                  <span className="rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-2 py-1 font-mono text-[10px] font-bold text-[#d2bbff]">
                    {proof.action}
                  </span>
                </div>
                {proof.txHash && (
                  <a
                    href={proof.stellarExplorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-[#d2bbff] hover:underline"
                  >
                    <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    {shortenAddress(proof.txHash)}
                  </a>
                )}
                <p className="mt-3 font-mono text-[10px] text-[#958da1]">
                  {formatDateTime(proof.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
