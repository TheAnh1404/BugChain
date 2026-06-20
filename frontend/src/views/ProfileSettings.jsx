import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { shortenAddress } from '../utils/shortenAddress';

export default function ProfileSettings() {
  const { user, updateProfile } = useAuth();
  const {
    wallets,
    isConnecting,
    isWrongNetwork,
    error: walletError,
    connectWallet,
    disconnectWallet,
  } = useWallet();
  const [profile, setProfile] = useState({
    username: user?.username || '',
    avatarUrl: user?.avatarUrl || '',
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setStatus('');

    try {
      await updateProfile(profile);
      setStatus('Profile updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectWallet = async () => {
    setError('');
    setStatus('');

    try {
      await connectWallet();
      setStatus('Wallet linked successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveWallet = async (walletId) => {
    setError('');
    setStatus('');

    try {
      await disconnectWallet(walletId);
      setStatus('Wallet removed.');
    } catch (err) {
      setError(err.message);
    }
  };

  const visibleError = error || walletError;

  return (
    <div className="flex-1 w-full px-8 py-8">
      <header className="mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-[#d2bbff] mb-2">
          Account Settings
        </p>
        <h1 className="text-4xl font-bold text-[#e8dfee]">Profile & Wallets</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#ccc3d8]">
          Manage your Web2 profile and link a Freighter Testnet wallet for future Soroban settlement.
        </p>
      </header>

      {(visibleError || status) && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            visibleError
              ? 'border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab]'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {visibleError || status}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <form onSubmit={handleSaveProfile} className="glass rounded-2xl p-6 space-y-5">
          <h2 className="text-xl font-bold text-[#e8dfee]">Profile</h2>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Email
            </label>
            <input
              value={user?.email || ''}
              className="input-dark w-full rounded-xl px-4 py-3 text-sm opacity-60"
              disabled
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Username
            </label>
            <input
              value={profile.username}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, username: event.target.value }))
              }
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
              Avatar URL
            </label>
            <input
              value={profile.avatarUrl}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, avatarUrl: event.target.value }))
              }
              className="input-dark w-full rounded-xl px-4 py-3 text-sm"
              placeholder="https://..."
            />
          </div>
          <button
            disabled={isSaving}
            className="rounded-xl bg-[#7c3aed] px-6 py-3 font-bold text-[#ede0ff] disabled:opacity-60"
            type="submit"
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <section className="glass rounded-2xl p-6 space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#e8dfee]">Freighter Wallet</h2>
              <p className="mt-1 text-sm text-[#ccc3d8]">
                Connect Freighter on Stellar Testnet, sign the nonce message, and link it to this account.
              </p>
            </div>
            <button
              onClick={handleConnectWallet}
              disabled={isConnecting}
              className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] disabled:opacity-60"
              type="button"
            >
              {isConnecting
                ? 'Connecting...'
                : isWrongNetwork
                  ? 'Switch to Testnet'
                  : 'Connect Freighter'}
            </button>
          </div>

          <div className="border-t border-[#4a4455]/40 pt-5">
            <h3 className="mb-3 text-sm font-bold text-[#e8dfee]">Linked Wallets</h3>
            {wallets.length === 0 ? (
              <p className="text-sm text-[#ccc3d8]">No wallets linked yet.</p>
            ) : (
              <div className="space-y-3">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="flex items-center gap-3 rounded-xl border border-[#4a4455]/40 bg-[#100d16] p-3"
                  >
                    <span className="material-symbols-outlined text-[#d2bbff]">
                      account_balance_wallet
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate font-mono text-xs text-[#e8dfee]"
                        title={wallet.walletAddress}
                      >
                        {shortenAddress(wallet.walletAddress)}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-[#ccc3d8]">
                        {wallet.isPrimary ? 'Primary' : 'Linked'} -{' '}
                        {wallet.verifiedAt ? 'Verified' : 'Pending'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveWallet(wallet.id)}
                      className="text-xs font-bold text-[#ffb4ab] hover:underline"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
