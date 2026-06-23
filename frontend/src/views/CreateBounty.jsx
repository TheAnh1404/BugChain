import { useEffect, useState } from 'react';
import {
  buildBountyMetadata,
  createBountyOnChain,
  hashBountyMetadata,
} from '../lib/stellar';
import { trackEvent } from '../lib/analytics';
import { normalizeTransactionError } from '../lib/errors';
import { bountyService } from '../services/bountyService';
import { organizationService } from '../services/organizationService';
import { transactionService } from '../services/transactionService';

const initialForm = {
  title: '',
  description: '',
  scope: '',
  severity: 'HIGH',
  rewardAmount: '',
  rewardAsset: 'XLM',
  deadline: '',
  status: 'DRAFT',
  organizationId: '',
  projectId: '',
};

export default function CreateBounty({ onCreated, setCurrentView }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [createdBounty, setCreatedBounty] = useState(null);
  const [chainResult, setChainResult] = useState(null);
  const [isSyncFailed, setIsSyncFailed] = useState(false);
  const [rewardSuggestions, setRewardSuggestions] = useState({});
  const [organizations, setOrganizations] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCreateBountyContext() {
      try {
        const [suggestions, orgs] = await Promise.all([
          bountyService.rewardSuggestions(),
          organizationService.list().catch(() => []),
        ]);
        if (isMounted) {
          setRewardSuggestions(suggestions);
          setOrganizations(orgs);
        }
      } catch {
        if (isMounted) {
          setRewardSuggestions({});
        }
      }
    }

    loadCreateBountyContext();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      projectId: field === 'organizationId' ? '' : prev.projectId,
    }));
  };

  const selectedOrganization = organizations.find((org) => org.id === form.organizationId);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setProgressMessage('');
    setCreatedBounty(null);
    setChainResult(null);
    setIsSyncFailed(false);

    try {
      const rewardAsset = form.rewardAsset.trim().toUpperCase() || 'XLM';
      const metadata = buildBountyMetadata({
        title: form.title,
        description: form.description,
        scope: form.scope,
        severity: form.severity,
        rewardAmount: form.rewardAmount,
        deadline: form.deadline,
      });
      const metadataHash = await hashBountyMetadata(metadata);

      setProgressMessage('Saving bounty metadata as draft...');
      const savedBounty = await bountyService.create({
        ...form,
        rewardAsset,
        deadline: metadata.deadline,
        status: 'DRAFT',
        metadataHash,
        organizationId: form.organizationId || undefined,
        projectId: form.projectId || undefined,
      });
      setCreatedBounty(savedBounty);

      setProgressMessage('Creating pending transaction record...');
      const pendingTransaction = await transactionService.start({
        type: 'CREATE_BOUNTY',
        bountyId: savedBounty.id,
      });

      setProgressMessage('Submitting real Soroban transaction to Stellar Testnet...');
      let onChainResult;
      try {
        onChainResult = await createBountyOnChain({
          rewardAsset,
          rewardAmount: metadata.rewardAmount,
          deadline: metadata.deadline,
          metadataHash,
        });
      } catch (txError) {
        await transactionService.fail(pendingTransaction.id).catch(() => {});
        throw new Error(normalizeTransactionError(txError).message, { cause: txError });
      }

      const trackedChainResult = {
        ...onChainResult,
        transactionId: pendingTransaction.id,
      };

      setProgressMessage('Saving confirmed transaction hash to BugChain API...');
      let updatedBounty;

      try {
        updatedBounty = await bountyService.updateOnChain(savedBounty.id, {
          onchainBountyId: trackedChainResult.onchainBountyId,
          txHash: trackedChainResult.txHash,
          metadataHash,
          transactionId: pendingTransaction.id,
        });
      } catch (updateError) {
        setChainResult(trackedChainResult);
        setIsSyncFailed(true);
        setError(
          `On-chain transaction succeeded, but BugChain API could not store it: ${updateError.message}`,
        );
        setProgressMessage('');
        return;
      }

      setCreatedBounty(updatedBounty);
      setChainResult(trackedChainResult);
      trackEvent('bounty_created', {
        bountyId: updatedBounty.id,
        txHash: trackedChainResult.txHash,
      });
      setForm(initialForm);
      setProgressMessage('');
    } catch (err) {
      setError(err.message);
      setProgressMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetrySync = async () => {
    if (!createdBounty || !chainResult) return;

    setIsSubmitting(true);
    setError('');
    setProgressMessage('Retrying confirmed transaction sync to BugChain API...');

    try {
      const updatedBounty = await bountyService.updateOnChain(createdBounty.id, {
        onchainBountyId: chainResult.onchainBountyId,
        txHash: chainResult.txHash,
        metadataHash: chainResult.metadataHash,
        transactionId: chainResult.transactionId,
      });

      setCreatedBounty(updatedBounty);
      setIsSyncFailed(false);
      trackEvent('bounty_created', {
        bountyId: updatedBounty.id,
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

  return (
    <div className="flex-1 w-full px-8 py-8">
      <header className="mb-8">
        <button
          onClick={() => setCurrentView('marketplace')}
          className="mb-4 flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-[#d2bbff]"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back to bounties
        </button>
        <h1 className="text-4xl font-bold text-[#e8dfee]">Launch Bounty</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#ccc3d8]">
          Save the bounty metadata, lock the reward through the deployed Soroban contract, and store the confirmed Testnet transaction hash.
        </p>
      </header>

      {(error || progressMessage) && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            error
              ? 'border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab]'
              : 'border-[#d2bbff]/30 bg-[#7c3aed]/10 text-[#d2bbff]'
          }`}
        >
          {error || progressMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass max-w-4xl rounded-2xl p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
            Title
          </label>
          <input
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            className="input-dark w-full rounded-xl px-4 py-3 text-sm"
            placeholder="Soroban AMM invariant audit"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Severity
            </label>
            <select
              value={form.severity}
              onChange={(event) => updateField('severity', event.target.value)}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
            >
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
              <option>CRITICAL</option>
            </select>
            {rewardSuggestions[form.severity] && (
              <p className="text-[11px] text-[#ccc3d8]">
                Suggested: {rewardSuggestions[form.severity].recommendedXlm.toLocaleString()} XLM
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Reward Amount
            </label>
            <input
              value={form.rewardAmount}
              onChange={(event) => updateField('rewardAmount', event.target.value)}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              placeholder="5000"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Deadline
            </label>
            <input
              value={form.deadline}
              onChange={(event) => updateField('deadline', event.target.value)}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              type="datetime-local"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            className="input-dark min-h-40 w-full rounded-xl p-4 text-sm"
            placeholder="Describe the system, risk areas, and expected report quality."
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
            Scope
          </label>
          <textarea
            value={form.scope}
            onChange={(event) => updateField('scope', event.target.value)}
            className="input-dark min-h-32 w-full rounded-xl p-4 text-sm"
            placeholder="List repositories, contracts, endpoints, exclusions, and testing limits."
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Reward Asset
            </label>
            <input
              value={form.rewardAsset}
              onChange={(event) => updateField('rewardAsset', event.target.value)}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              placeholder="XLM or C... contract ID"
            />
          </div>
          <div className="rounded-xl border border-[#4a4455]/40 bg-[#100d16] px-4 py-3 text-sm text-[#ccc3d8]">
            The metadata hash is generated with SHA-256 from title, description, scope, severity, reward amount, and deadline.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Organization
            </label>
            <select
              value={form.organizationId}
              onChange={(event) => updateField('organizationId', event.target.value)}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
            >
              <option value="">Personal bounty</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Project
            </label>
            <select
              value={form.projectId}
              onChange={(event) => updateField('projectId', event.target.value)}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              disabled={!form.organizationId}
            >
              <option value="">No project</option>
              {(selectedOrganization?.projects || []).map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          disabled={isSubmitting}
          className="rounded-xl bg-[#7c3aed] px-8 py-3 font-bold text-[#ede0ff] disabled:opacity-60"
          type="submit"
        >
          {isSubmitting ? 'Creating on Stellar Testnet...' : 'Create On-Chain Bounty'}
        </button>
      </form>

      {chainResult && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4">
          <div
            className={`glass w-full max-w-2xl rounded-2xl border p-6 shadow-2xl ${
              isSyncFailed ? 'border-amber-500/40' : 'border-[#7c3aed]/40'
            }`}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-mono uppercase tracking-widest ${
                    isSyncFailed ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  {isSyncFailed ? 'On-chain Success, Sync Failed' : 'Bounty Created Successfully'}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[#e8dfee]">
                  {isSyncFailed
                    ? 'Reward locked, backend sync still pending'
                    : 'Reward locked on Stellar Testnet'}
                </h2>
              </div>
              <span
                className={`material-symbols-outlined ${
                  isSyncFailed ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                {isSyncFailed ? 'warning' : 'check_circle'}
              </span>
            </div>

            {isSyncFailed && (
              <p className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                The Stellar transaction succeeded. Retry syncing before leaving so BugChain stores the transaction hash and user proof.
              </p>
            )}

            <div className="space-y-4 rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8]">
                  On-chain Bounty ID
                </p>
                <p className="mt-1 break-all font-mono text-sm text-[#e8dfee]">
                  {chainResult.onchainBountyId}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8]">
                  Transaction Hash
                </p>
                <p className="mt-1 break-all font-mono text-sm text-[#e8dfee]">
                  {chainResult.txHash}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8]">
                  Metadata Hash
                </p>
                <p className="mt-1 break-all font-mono text-sm text-[#e8dfee]">
                  {chainResult.metadataHash}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => window.open(chainResult.stellarExplorerUrl, '_blank', 'noopener,noreferrer')}
                className="rounded-xl border border-[#7c3aed] px-5 py-3 text-sm font-bold text-[#d2bbff]"
                type="button"
              >
                View on Stellar Expert
              </button>
              {isSyncFailed && (
                <button
                  onClick={handleRetrySync}
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] disabled:opacity-60"
                  type="button"
                >
                  {isSubmitting ? 'Retrying Sync...' : 'Retry Sync'}
                </button>
              )}
              <button
                onClick={() => {
                  if (createdBounty && !isSyncFailed) {
                    onCreated(createdBounty);
                  }
                }}
                disabled={!createdBounty || isSyncFailed}
                className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] disabled:opacity-60"
                type="button"
              >
                View Bounty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
