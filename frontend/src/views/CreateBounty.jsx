import { useState } from 'react';
import {
  buildBountyMetadata,
  createBountyOnChain,
  hashBountyMetadata,
} from '../lib/stellar';
import { bountyService } from '../services/bountyService';
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
};

export default function CreateBounty({ onCreated, setCurrentView }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [createdBounty, setCreatedBounty] = useState(null);
  const [chainResult, setChainResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setProgressMessage('');
    setCreatedBounty(null);
    setChainResult(null);

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
      });

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
        throw txError;
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
        setError(
          `On-chain transaction succeeded, but BugChain API could not store it: ${updateError.message}`,
        );
        setProgressMessage('');
        return;
      }

      setCreatedBounty(updatedBounty);
      setChainResult(trackedChainResult);
      setForm(initialForm);
      setProgressMessage('');
    } catch (err) {
      setError(err.message);
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
          <div className="glass w-full max-w-2xl rounded-2xl border border-[#7c3aed]/40 p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-emerald-300">
                  Bounty Created Successfully
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[#e8dfee]">
                  Reward locked on Stellar Testnet
                </h2>
              </div>
              <span className="material-symbols-outlined text-emerald-300">
                check_circle
              </span>
            </div>

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
              <button
                onClick={() => {
                  if (createdBounty) {
                    onCreated(createdBounty);
                  }
                }}
                disabled={!createdBounty}
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
