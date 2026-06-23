import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../hooks/useWallet';
import NotificationBell from './NotificationBell';

export default function TopNavBar({
  currentView,
  setCurrentView,
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const {
    wallet,
    shortenedAddress,
    isConnecting,
    isWrongNetwork,
    connectWallet,
  } = useWallet();
  const [walletNotice, setWalletNotice] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const walletButtonLabel = isConnecting
    ? 'Connecting...'
    : isWrongNetwork
      ? 'Switch to Testnet'
      : wallet
        ? shortenedAddress || 'Wallet connected'
        : 'Connect Freighter';

  const handleWalletClick = async () => {
    setWalletNotice('');

    if (!isAuthenticated) {
      setWalletNotice('Please login first.');
      setCurrentView('login');
      return;
    }

    if (wallet) {
      setCurrentView('profile');
      return;
    }

    try {
      await connectWallet();
      setWalletNotice('Wallet linked successfully.');
    } catch (err) {
      setWalletNotice(err.message);
    }
  };

  const goToView = (view) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center w-full px-4 sm:px-8 bg-[#15121b]/80 backdrop-blur-md border-b border-[#4a4455] h-20">
      <div className="flex items-center gap-8">
        <span 
          onClick={() => setCurrentView('landing')} 
          className="text-2xl font-bold text-[#d2bbff] tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
        >
          BugChain
        </span>
        <div className="hidden md:flex gap-6 items-center">
          <button 
            onClick={() => setCurrentView('marketplace')}
            className={`font-medium pb-1 transition-all ${
              currentView === 'marketplace' || currentView === 'details'
                ? 'text-[#d2bbff] border-b-2 border-[#d2bbff]' 
                : 'text-[#ccc3d8] hover:text-[#e8dfee]'
            }`}
          >
            Bounties
          </button>
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`font-medium pb-1 transition-all ${
              currentView === 'dashboard'
                ? 'text-[#d2bbff] border-b-2 border-[#d2bbff]' 
                : 'text-[#ccc3d8] hover:text-[#e8dfee]'
            }`}
          >
            Dashboard
          </button>
            <button 
              onClick={() => setCurrentView(isAuthenticated ? 'create-bounty' : 'login')}
            className={`font-medium pb-1 transition-all ${
              currentView === 'create-bounty'
                ? 'text-[#d2bbff] border-b-2 border-[#d2bbff]' 
                : 'text-[#ccc3d8] hover:text-[#e8dfee]'
            }`}
          >
            Launch
          </button>
          <button
            onClick={() => setCurrentView(isAuthenticated ? 'analytics' : 'login')}
            className={`font-medium pb-1 transition-all ${
              currentView === 'analytics'
                ? 'text-[#d2bbff] border-b-2 border-[#d2bbff]'
                : 'text-[#ccc3d8] hover:text-[#e8dfee]'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setCurrentView(isAuthenticated ? 'organizations' : 'login')}
            className={`font-medium pb-1 transition-all ${
              currentView === 'organizations'
                ? 'text-[#d2bbff] border-b-2 border-[#d2bbff]'
                : 'text-[#ccc3d8] hover:text-[#e8dfee]'
            }`}
          >
            Orgs
          </button>
          <button
            onClick={() => setCurrentView(isAuthenticated ? 'feedback' : 'login')}
            className={`font-medium pb-1 transition-all ${
              currentView === 'feedback'
                ? 'text-[#d2bbff] border-b-2 border-[#d2bbff]'
                : 'text-[#ccc3d8] hover:text-[#e8dfee]'
            }`}
          >
            Feedback
          </button>
          <button
            onClick={() => setCurrentView(isAuthenticated ? 'level4-proofs' : 'login')}
            className={`font-medium pb-1 transition-all ${
              currentView === 'level4-proofs' || currentView === 'level4-analytics'
                ? 'text-[#d2bbff] border-b-2 border-[#d2bbff]'
                : 'text-[#ccc3d8] hover:text-[#e8dfee]'
            }`}
          >
            Level 4
          </button>
          <button 
            onClick={() => setCurrentView(isAuthenticated ? 'profile' : 'login')}
            className="text-[#ccc3d8] hover:text-[#e8dfee] transition-colors font-medium"
          >
            Profile
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        {isAuthenticated ? (
          <>
            <NotificationBell />
            <button
              onClick={() => setCurrentView('profile')}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#221e28] border border-[#4a4455] hover:border-[#7c3aed]/60 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="font-mono text-xs text-[#e8dfee]">{user?.username}</span>
            </button>
            <button 
              onClick={handleWalletClick}
              disabled={isConnecting}
              className="hidden sm:inline-flex bg-[#7c3aed] text-[#ede0ff] px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)]"
            >
              {walletButtonLabel}
            </button>
            <button 
              onClick={() => {
                logout();
                setCurrentView('landing');
              }}
              className="hidden sm:inline-flex border border-[#4a4455] text-[#e8dfee] px-4 py-2.5 rounded-xl font-bold transition-all hover:bg-[#2c2833]"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => setCurrentView('login')}
              className="hidden sm:inline-flex border border-[#4a4455] text-[#e8dfee] px-5 py-2.5 rounded-xl font-bold transition-all hover:bg-[#2c2833]"
            >
              Login
            </button>
            <button 
              onClick={() => setCurrentView('register')}
              className="bg-[#7c3aed] text-[#ede0ff] px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)]"
            >
              Register
            </button>
          </>
        )}
        <button
          onClick={() => setIsMobileMenuOpen((value) => !value)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#4a4455] bg-[#221e28] text-[#e8dfee] md:hidden"
          aria-label="Open navigation menu"
          type="button"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </div>
      {walletNotice && (
        <div className="fixed right-6 top-24 z-[60] max-w-sm rounded-xl border border-[#4a4455] bg-[#100d16] px-4 py-3 text-sm text-[#e8dfee] shadow-xl">
          {walletNotice}
        </div>
      )}
      {isMobileMenuOpen && (
        <div className="fixed left-4 right-4 top-24 z-[70] rounded-xl border border-[#4a4455] bg-[#100d16] p-3 shadow-2xl md:hidden">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => goToView('marketplace')} className="rounded-lg px-3 py-2 text-left text-sm text-[#e8dfee] hover:bg-[#221e28]">Bounties</button>
            <button onClick={() => goToView(isAuthenticated ? 'dashboard' : 'login')} className="rounded-lg px-3 py-2 text-left text-sm text-[#e8dfee] hover:bg-[#221e28]">Dashboard</button>
            <button onClick={() => goToView(isAuthenticated ? 'create-bounty' : 'login')} className="rounded-lg px-3 py-2 text-left text-sm text-[#e8dfee] hover:bg-[#221e28]">Launch</button>
            <button onClick={() => goToView(isAuthenticated ? 'analytics' : 'login')} className="rounded-lg px-3 py-2 text-left text-sm text-[#e8dfee] hover:bg-[#221e28]">Analytics</button>
            <button onClick={() => goToView(isAuthenticated ? 'feedback' : 'login')} className="rounded-lg px-3 py-2 text-left text-sm text-[#e8dfee] hover:bg-[#221e28]">Feedback</button>
            <button onClick={() => goToView(isAuthenticated ? 'level4-proofs' : 'login')} className="rounded-lg px-3 py-2 text-left text-sm text-[#e8dfee] hover:bg-[#221e28]">Proofs</button>
            <button onClick={() => goToView(isAuthenticated ? 'level4-analytics' : 'login')} className="rounded-lg px-3 py-2 text-left text-sm text-[#e8dfee] hover:bg-[#221e28]">MVP Metrics</button>
            <button onClick={() => goToView(isAuthenticated ? 'profile' : 'login')} className="rounded-lg px-3 py-2 text-left text-sm text-[#e8dfee] hover:bg-[#221e28]">Profile</button>
          </div>
          {isAuthenticated && (
            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[#4a4455]/40 pt-3">
              <button
                onClick={handleWalletClick}
                disabled={isConnecting}
                className="rounded-lg bg-[#7c3aed] px-3 py-2 text-left text-sm font-bold text-[#ede0ff] disabled:opacity-60"
                type="button"
              >
                {walletButtonLabel}
              </button>
              <button
                onClick={() => {
                  logout();
                  goToView('landing');
                }}
                className="rounded-lg border border-[#4a4455] px-3 py-2 text-left text-sm font-bold text-[#e8dfee]"
                type="button"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
