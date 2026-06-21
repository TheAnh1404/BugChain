import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import { shortenAddress } from '../utils/shortenAddress';

export default function ProfileSettings() {
  const {
    user,
    updateProfile,
    changePassword,
    getSessions,
    revokeSession,
    revokeOtherSessions,
    revokeAllSessions,
    logout,
  } = useAuth();
  
  const {
    wallets,
    isConnecting,
    isWrongNetwork,
    error: walletError,
    connectWallet,
    disconnectWallet,
  } = useWallet();

  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({
    username: user?.username || '',
    avatarUrl: user?.avatarUrl || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadSessionsList = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await getSessions();
      setSessions(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSessionsLoading(false);
    }
  }, [getSessions]);

  // Clear messages when changing tabs
  useEffect(() => {
    setTimeout(() => {
      setStatus('');
      setError('');
    }, 0);
  }, [activeTab]);

  // Load sessions when entering sessions tab
  useEffect(() => {
    if (activeTab === 'sessions') {
      setTimeout(() => {
        loadSessionsList();
      }, 0);
    }
  }, [activeTab, loadSessionsList]);

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

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setStatus('');

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setError('Passwords do not match');
      setIsSaving(false);
      return;
    }

    try {
      const result = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmNewPassword: passwordForm.confirmNewPassword,
      });
      setStatus(result.message || 'Password changed successfully. Other sessions invalidated.');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    setError('');
    setStatus('');
    try {
      await revokeSession(sessionId);
      setStatus('Session revoked.');
      await loadSessionsList();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRevokeOther = async () => {
    setError('');
    setStatus('');
    try {
      await revokeOtherSessions();
      setStatus('Other sessions revoked.');
      await loadSessionsList();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRevokeAll = async () => {
    setError('');
    setStatus('');
    try {
      await revokeAllSessions();
      await logout();
    } catch (err) {
      setError(err.message);
    }
  };

  const visibleError = error || (activeTab === 'profile' ? walletError : '');

  return (
    <div className="flex-1 w-full px-8 py-8">
      <header className="mb-6">
        <p className="text-xs font-mono uppercase tracking-widest text-[#d2bbff] mb-2">
          Account Settings
        </p>
        <h1 className="text-4xl font-bold text-[#e8dfee]">Account Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#ccc3d8]">
          Manage your profile, connected wallets, security settings, and active sessions.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#4a4455]/40 pb-4 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'profile'
              ? 'bg-[#7c3aed] text-[#ede0ff]'
              : 'text-[#ccc3d8] hover:text-[#e8dfee] hover:bg-[#221e28]'
          }`}
        >
          <span className="material-symbols-outlined text-sm">person</span>
          Profile & Wallets
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'security'
              ? 'bg-[#7c3aed] text-[#ede0ff]'
              : 'text-[#ccc3d8] hover:text-[#e8dfee] hover:bg-[#221e28]'
          }`}
        >
          <span className="material-symbols-outlined text-sm">shield</span>
          Security & Password
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'sessions'
              ? 'bg-[#7c3aed] text-[#ede0ff]'
              : 'text-[#ccc3d8] hover:text-[#e8dfee] hover:bg-[#221e28]'
          }`}
        >
          <span className="material-symbols-outlined text-sm">devices</span>
          Active Sessions
        </button>
      </div>

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

      {/* Tab Contents */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fade-in">
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
              className="rounded-xl bg-[#7c3aed] px-6 py-3 font-bold text-[#ede0ff] disabled:opacity-60 transition-all hover:brightness-110"
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
                className="rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-bold text-[#ede0ff] disabled:opacity-60 transition-all hover:brightness-110"
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
      )}

      {activeTab === 'security' && (
        <div className="max-w-xl animate-fade-in">
          <form onSubmit={handleChangePassword} className="glass rounded-2xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-[#e8dfee]">Change Password</h2>
            <p className="text-sm text-[#ccc3d8]">
              Updating your password will keep your current session active and log you out of all other sessions.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                Current Password
              </label>
              <input
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                }
                className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                type="password"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                New Password
              </label>
              <input
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                }
                className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                type="password"
                placeholder="At least 8 chars (A-Z, a-z, 0-9)"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-widest text-[#ccc3d8]">
                Confirm New Password
              </label>
              <input
                value={passwordForm.confirmNewPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, confirmNewPassword: e.target.value }))
                }
                className="input-dark w-full rounded-xl px-4 py-3 text-sm"
                type="password"
                minLength={8}
                required
              />
            </div>
            <button
              disabled={isSaving}
              className="rounded-xl bg-[#7c3aed] px-6 py-3 font-bold text-[#ede0ff] disabled:opacity-60 transition-all hover:brightness-110"
              type="submit"
            >
              {isSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="glass rounded-2xl p-6 space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#e8dfee]">Active Sessions</h2>
              <p className="mt-1 text-sm text-[#ccc3d8]">
                These are the devices that have accessed your account. Revoke any session you do not recognize.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRevokeOther}
                className="rounded-xl border border-[#4a4455] bg-[#221e28] px-4 py-2 text-xs font-bold text-[#e8dfee] transition-all hover:bg-[#2c2833]"
              >
                Log Out Other Sessions
              </button>
              <button
                type="button"
                onClick={handleRevokeAll}
                className="rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/20 px-4 py-2 text-xs font-bold text-[#ffb4ab] transition-all hover:bg-[#93000a]/35"
              >
                Log Out All Sessions
              </button>
            </div>
          </div>

          {sessionsLoading ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined animate-spin text-4xl text-[#d2bbff]">
                progress_activity
              </span>
            </div>
          ) : (
            <div className="divide-y divide-[#4a4455]/30">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0 gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#221e28] border border-[#4a4455]/40 text-[#d2bbff]">
                      <span className="material-symbols-outlined">
                        {s.device === 'Firefox'
                          ? 'browser_updated'
                          : s.device === 'Chrome'
                            ? 'chrome_reader_mode'
                            : s.device === 'Safari'
                              ? 'open_in_browser'
                              : 'devices'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#e8dfee]">{s.device}</span>
                        {s.isCurrent && (
                          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                            Current Session
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#ccc3d8] mt-1 font-mono">
                        {s.ipAddress} • Active: {new Date(s.lastUsedAt).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[#958da1] mt-0.5 truncate max-w-md">
                        {s.userAgent}
                      </p>
                    </div>
                  </div>

                  {!s.isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(s.id)}
                      className="rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/10 px-3 py-1.5 text-xs font-bold text-[#ffb4ab] transition-all hover:bg-[#93000a]/20"
                      type="button"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="py-6 text-center text-sm text-[#ccc3d8]">No active sessions found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
