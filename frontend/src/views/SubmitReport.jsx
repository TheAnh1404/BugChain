import { useEffect, useState } from 'react';
import { bountyService } from '../services/bountyService';
import { reportService } from '../services/reportService';
import { transactionService } from '../services/transactionService';
import { connectFreighterTestnet } from '../lib/freighter';
import { trackEvent } from '../lib/analytics';
import { normalizeTransactionError } from '../lib/errors';
import { encryptReportForOwner } from '../lib/clientCrypto';
import { hashReportMetadata, submitReportOnChain } from '../lib/stellar';

const initialForm = {
  bountyId: '',
  title: '',
  severity: 'CRITICAL',
  description: '',
  stepsToReproduce: '',
  impact: '',
  recommendation: '',
  reportHash: '',
};

export default function SubmitReport({ selectedBountyId, setCurrentView }) {
  const [form, setForm] = useState({
    ...initialForm,
    bountyId: selectedBountyId || '',
  });
  const [bounties, setBounties] = useState([]);
  const [files, setFiles] = useState([]);
  const [isLoadingBounties, setIsLoadingBounties] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');

  const [createdReport, setCreatedReport] = useState(null);
  const [chainResult, setChainResult] = useState(null);
  const [progressMessage, setProgressMessage] = useState('');
  const [isSyncFailed, setIsSyncFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadBounties() {
      setIsLoadingBounties(true);
      setError('');

      try {
        const result = await bountyService.list({ status: 'OPEN', limit: 100 });
        if (isMounted) {
          setBounties(result.items);
          const defaultBountyId = selectedBountyId || result.items[0]?.id || '';
          setForm((prev) => ({ ...prev, bountyId: defaultBountyId }));
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoadingBounties(false);
        }
      }
    }

    loadBounties();

    return () => {
      isMounted = false;
    };
  }, [selectedBountyId]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const newFiles = Array.from(event.dataTransfer.files).map((file) => file.name);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileChange = (event) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map((file) => file.name);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRetrySync = async () => {
    if (!createdReport || !chainResult) return;
    setIsSubmitting(true);
    setError('');
    setProgressMessage('Retrying sync to BugChain API...');

    try {
      await reportService.updateOnChain(createdReport.id, {
        txHash: chainResult.txHash,
        onchainReportId: chainResult.onchainReportId,
        reportHash: chainResult.reportHash,
        stellarExplorerUrl: chainResult.stellarExplorerUrl,
        transactionId: chainResult.transactionId,
      });
      setIsSyncFailed(false);
      setSubmitSuccess(true);
      trackEvent('report_submitted', {
        reportId: createdReport.id,
        txHash: chainResult.txHash,
      });
      setProgressMessage('');
    } catch (err) {
      setError(`Sync retry failed: ${err.message}`);
      setProgressMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setProgressMessage('');
    setIsSyncFailed(false);
    setCreatedReport(null);
    setChainResult(null);

    let hunterAddress;
    try {
      setProgressMessage('Checking Freighter wallet connection...');
      const connection = await connectFreighterTestnet();
      hunterAddress = connection.address;
    } catch (err) {
      setError(`Wallet connection failed: ${err.message}`);
      setIsSubmitting(false);
      setProgressMessage('');
      return;
    }

    const targetBounty = bounties.find((b) => b.id === form.bountyId);
    if (!targetBounty) {
      setError('Target bounty not found.');
      setIsSubmitting(false);
      setProgressMessage('');
      return;
    }

    if (!targetBounty.onchainBountyId) {
      setError('Target bounty is not registered on-chain yet.');
      setIsSubmitting(false);
      setProgressMessage('');
      return;
    }

    let savedReport;
    try {
      setProgressMessage('Saving report metadata off-chain as draft...');
      const sensitiveReportData = {
        description: form.description,
        stepsToReproduce: form.stepsToReproduce,
        impact: form.impact,
        recommendation: form.recommendation,
      };
      const encryptedPayload = targetBounty.owner?.rsaPublicKey
        ? await encryptReportForOwner(sensitiveReportData, targetBounty.owner.rsaPublicKey)
        : null;

      savedReport = await reportService.submit(form.bountyId, {
        title: form.title,
        severity: form.severity,
        ...(encryptedPayload || sensitiveReportData),
      });
      setCreatedReport(savedReport);
    } catch (err) {
      setError(`Failed to save draft to backend: ${err.message}`);
      setIsSubmitting(false);
      setProgressMessage('');
      return;
    }

    let reportHash;
    try {
      setProgressMessage('Generating report hash...');
      reportHash = await hashReportMetadata({
        bountyId: form.bountyId,
        onchainBountyId: targetBounty.onchainBountyId,
        title: form.title,
        severity: form.severity,
        description: form.description,
        stepsToReproduce: form.stepsToReproduce,
        impact: form.impact,
        recommendation: form.recommendation,
        hunterWallet: hunterAddress,
      });
    } catch (err) {
      setError(`Failed to generate report hash: ${err.message}`);
      setIsSubmitting(false);
      setProgressMessage('');
      return;
    }

    let pendingTransaction;
    try {
      setProgressMessage('Creating pending transaction record...');
      pendingTransaction = await transactionService.start({
        type: 'SUBMIT_REPORT',
        bountyId: form.bountyId,
        reportId: savedReport.id,
      });
    } catch (err) {
      setError(`Failed to start transaction tracking: ${err.message}`);
      setIsSubmitting(false);
      setProgressMessage('');
      return;
    }

    let onChainResult;
    try {
      setProgressMessage('Submitting real Soroban transaction to Stellar Testnet...');
      onChainResult = await submitReportOnChain({
        hunterAddress,
        onchainBountyId: targetBounty.onchainBountyId,
        reportHash,
      });
    } catch (err) {
      await transactionService.fail(pendingTransaction.id).catch(() => {});
      setError(`Soroban transaction failed: ${normalizeTransactionError(err).message}`);
      setIsSubmitting(false);
      setProgressMessage('');
      return;
    }

    const fullChainResult = {
      ...onChainResult,
      reportHash,
      transactionId: pendingTransaction.id,
    };
    setChainResult(fullChainResult);

    try {
      setProgressMessage('Syncing transaction details to BugChain API...');
      await reportService.updateOnChain(savedReport.id, {
        txHash: fullChainResult.txHash,
        onchainReportId: fullChainResult.onchainReportId,
        reportHash: fullChainResult.reportHash,
        stellarExplorerUrl: fullChainResult.stellarExplorerUrl,
        transactionId: pendingTransaction.id,
      });
      setSubmitSuccess(true);
      trackEvent('report_submitted', {
        reportId: savedReport.id,
        txHash: fullChainResult.txHash,
      });
      setProgressMessage('');
    } catch (err) {
      setIsSyncFailed(true);
      setError(`On-chain transaction succeeded, but backend synchronization failed: ${err.message}`);
      setProgressMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 px-8 py-10 max-w-5xl mx-auto overflow-y-auto">
      <header className="mb-10">
        <button
          onClick={() => setCurrentView('marketplace')}
          className="flex items-center gap-2 text-[#d2bbff] mb-4 hover:opacity-80 transition-opacity"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-xs font-mono font-bold tracking-widest uppercase">
            Back to Programs
          </span>
        </button>
        <h1 className="text-4xl font-bold text-[#e8dfee] mb-2">
          Submit Vulnerability Report
        </h1>
        <p className="text-sm text-[#ccc3d8] max-w-2xl leading-relaxed">
          Submit a private Web2 report record, sign reportHash on Stellar, and register it to the Soroban contract.
        </p>
      </header>

      <div className="mb-10 p-4 rounded-xl glass border-l-4 border-[#7c3aed] flex items-center gap-4">
        <div className="bg-[#7c3aed]/20 p-2 rounded-lg">
          <span className="material-symbols-outlined text-[#d2bbff]">verified_user</span>
        </div>
        <div>
          <h3 className="font-bold text-sm text-[#e8dfee]">Authenticated Disclosure</h3>
          <p className="text-xs text-[#ccc3d8] mt-0.5">
            Your report is stored in PostgreSQL and linked to your user account.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-3 text-sm text-[#ffb4ab]">
          {error}
        </div>
      )}

      {isSubmitting ? (
        <div className="glass p-12 rounded-2xl flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
          <span className="material-symbols-outlined text-5xl text-[#d2bbff] animate-spin">
            progress_activity
          </span>
          <h3 className="text-xl font-bold text-[#e8dfee]">
            {progressMessage || 'Submitting report...'}
          </h3>
          <p className="text-[#ccc3d8] text-sm max-w-md">
            Please wait. Do not close this tab or interrupt Freighter signing.
          </p>
        </div>
      ) : submitSuccess && chainResult ? (
        <div className="glass p-12 rounded-2xl flex flex-col items-center justify-center text-center gap-6 min-h-[400px] border border-emerald-500/30 max-w-2xl mx-auto">
          <span className="material-symbols-outlined text-6xl text-emerald-400">
            check_circle
          </span>
          <h3 className="text-2xl font-bold text-[#e8dfee]">Report Submitted & Registered</h3>
          <p className="text-[#ccc3d8] text-sm max-w-md">
            Your vulnerability report hash has been securely registered to the Soroban contract. The bounty owner can now review your report.
          </p>

          <div className="w-full text-left space-y-4 rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8] font-mono">
                On-chain Report ID
              </p>
              <p className="mt-1 break-all font-mono text-sm text-[#e8dfee]">
                {chainResult.onchainReportId}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8] font-mono">
                Transaction Hash
              </p>
              <p className="mt-1 break-all font-mono text-sm text-[#e8dfee]">
                {chainResult.txHash}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8] font-mono">
                Report Hash
              </p>
              <p className="mt-1 break-all font-mono text-sm text-[#e8dfee]">
                {chainResult.reportHash}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center w-full">
            <button
              onClick={() => window.open(chainResult.stellarExplorerUrl, '_blank', 'noopener,noreferrer')}
              className="rounded-xl border border-[#7c3aed] px-5 py-3 text-sm font-bold text-[#d2bbff] flex items-center justify-center gap-2"
              type="button"
            >
              View on Stellar Expert
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] flex items-center justify-center gap-2"
              type="button"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      ) : isSyncFailed && chainResult ? (
        <div className="glass p-12 rounded-2xl flex flex-col items-center justify-center text-center gap-6 min-h-[400px] border border-amber-500/30 max-w-2xl mx-auto">
          <span className="material-symbols-outlined text-6xl text-amber-500">
            warning
          </span>
          <h3 className="text-2xl font-bold text-[#e8dfee]">On-Chain Success, Sync Failed</h3>
          <p className="text-[#ccc3d8] text-sm max-w-md">
            The transaction succeeded on the Stellar network, but we were unable to sync the details back to the BugChain database.
          </p>

          <div className="w-full text-left space-y-4 rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8] font-mono">
                On-chain Report ID
              </p>
              <p className="mt-1 break-all font-mono text-sm text-[#e8dfee]">
                {chainResult.onchainReportId}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8] font-mono">
                Transaction Hash
              </p>
              <p className="mt-1 break-all font-mono text-sm text-[#e8dfee]">
                {chainResult.txHash}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8] font-mono">
                Report Hash
              </p>
              <p className="mt-1 break-all font-mono text-sm text-[#e8dfee]">
                {chainResult.reportHash}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center w-full">
            <button
              onClick={handleRetrySync}
              className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] flex items-center justify-center gap-2"
              type="button"
            >
              <span className="material-symbols-outlined">sync</span>
              Retry Syncing to Backend
            </button>
            <button
              onClick={() => window.open(chainResult.stellarExplorerUrl, '_blank', 'noopener,noreferrer')}
              className="rounded-xl border border-[#4a4455] px-5 py-3 text-sm font-bold text-[#ccc3d8] flex items-center justify-center gap-2"
              type="button"
            >
              View on Stellar Expert
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-mono text-[#ccc3d8] ml-1 uppercase tracking-widest font-semibold">
                Target Program
              </label>
              <div className="relative">
                <select
                  value={form.bountyId}
                  onChange={(event) => updateField('bountyId', event.target.value)}
                  disabled={isLoadingBounties}
                  className="w-full input-dark rounded-xl px-4 py-3 text-sm focus:outline-none appearance-none focus:border-[#7c3aed]"
                  required
                >
                  <option value="">
                    {isLoadingBounties ? 'Loading bounties...' : 'Select bounty'}
                  </option>
                  {bounties.map((bounty) => (
                    <option key={bounty.id} value={bounty.id}>
                      {bounty.title} ({bounty.severity})
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#ccc3d8]/60">
                  expand_more
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-[#ccc3d8] ml-1 uppercase tracking-widest font-semibold">
                Stated Severity
              </label>
              <div className="relative">
                <select
                  value={form.severity}
                  onChange={(event) => updateField('severity', event.target.value)}
                  className="w-full input-dark rounded-xl px-4 py-3 text-sm focus:outline-none appearance-none focus:border-[#7c3aed]"
                >
                  <option>CRITICAL</option>
                  <option>HIGH</option>
                  <option>MEDIUM</option>
                  <option>LOW</option>
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#ccc3d8]/60">
                  expand_more
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#ccc3d8] ml-1 uppercase tracking-widest font-semibold">
              Report Title
            </label>
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              className="w-full input-dark rounded-xl px-4 py-3 text-sm focus:outline-none placeholder-[#958da1]/40"
              placeholder="e.g. Reentrancy inside reward escrow settlement path"
              type="text"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#ccc3d8] ml-1 uppercase tracking-widest font-semibold">
              Vulnerability Description
            </label>
            <textarea
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              className="w-full input-dark rounded-xl p-4 font-mono text-sm h-56 resize-none focus:outline-none"
              placeholder="Describe the vulnerability, root cause, affected components, and evidence."
              minLength={20}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-mono text-[#ccc3d8] ml-1 uppercase tracking-widest font-semibold">
                Steps to Reproduce
              </label>
              <textarea
                value={form.stepsToReproduce}
                onChange={(event) => updateField('stepsToReproduce', event.target.value)}
                className="w-full input-dark rounded-xl p-4 text-sm h-40 resize-none focus:outline-none"
                placeholder="1. Deploy target...&#10;2. Execute payload...&#10;3. Observe unexpected state..."
                minLength={20}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono text-[#ccc3d8] ml-1 uppercase tracking-widest font-semibold">
                Impact Analysis
              </label>
              <textarea
                value={form.impact}
                onChange={(event) => updateField('impact', event.target.value)}
                className="w-full input-dark rounded-xl p-4 text-sm h-40 resize-none focus:outline-none"
                placeholder="Explain what an attacker can gain or damage."
                minLength={10}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#ccc3d8] ml-1 uppercase tracking-widest font-semibold">
              Recommendation
            </label>
            <textarea
              value={form.recommendation}
              onChange={(event) => updateField('recommendation', event.target.value)}
              className="w-full input-dark rounded-xl p-4 text-sm h-32 resize-none focus:outline-none"
              placeholder="Suggest a practical remediation or mitigation."
              minLength={10}
              required
            />
          </div>

          <div className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] px-4 py-3 text-sm text-[#ccc3d8]">
            The report hash will be automatically generated using SHA-256 and registered on-chain to ensure cryptographic integrity.
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-[#ccc3d8] ml-1 uppercase tracking-widest font-semibold">
              Proof of Concept Files
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-[#4a4455] rounded-xl p-10 flex flex-col items-center justify-center gap-3 hover:bg-[#1d1a24] hover:border-[#7c3aed] transition-colors group cursor-pointer relative"
            >
              <div className="w-12 h-12 rounded-full bg-[#221e28] flex items-center justify-center text-[#ccc3d8] group-hover:text-[#d2bbff] transition-colors">
                <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#e8dfee]">
                  Click or drag and drop to stage files locally
                </p>
                <p className="text-[11px] text-[#ccc3d8] mt-1">
                  File upload storage is not wired to the backend yet.
                </p>
              </div>
              <input
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
                type="file"
                multiple
              />
            </div>
            {files.length > 0 && (
              <div className="mt-3 p-3 bg-[#1d1a24] rounded-xl border border-[#4a4455]/30">
                <p className="text-xs font-bold text-[#d2bbff] mb-2">
                  Selected Files ({files.length}):
                </p>
                <ul className="space-y-1">
                  {files.map((file, index) => (
                    <li key={`${file}-${index}`} className="text-xs text-[#ccc3d8] flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">attachment</span>
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="pt-8 border-t border-[#4a4455]/30 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-[#ccc3d8]/80 text-xs">
              <span className="material-symbols-outlined text-[18px]">info</span>
              <span>Report status defaults to PENDING after submission.</span>
            </div>
            <button
              type="submit"
              disabled={!form.bountyId}
              className="w-full sm:w-auto bg-[#7c3aed] text-[#ede0ff] px-10 py-3 rounded-xl font-bold text-sm active:scale-95 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all disabled:opacity-60"
            >
              Submit Report
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
