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

  const walletButtonLabel = isConnecting
    ? 'Connecting...'
    : isWrongNetwork
      ? 'Switch to Testnet'
      : wallet
        ? shortenedAddress
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

  return (
    <nav className="sticky top-0 z-50 flex justify-between items-center w-full px-8 bg-[#15121b]/80 backdrop-blur-md border-b border-[#4a4455] h-20">
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
            onClick={() => setCurrentView(isAuthenticated ? 'profile' : 'login')}
            className="text-[#ccc3d8] hover:text-[#e8dfee] transition-colors font-medium"
          >
            Profile
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4">
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
              className="bg-[#7c3aed] text-[#ede0ff] px-5 py-2.5 rounded-xl font-bold transition-all active:scale-95 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)]"
            >
              {walletButtonLabel}
            </button>
            <button 
              onClick={() => {
                logout();
                setCurrentView('landing');
              }}
              className="border border-[#4a4455] text-[#e8dfee] px-4 py-2.5 rounded-xl font-bold transition-all hover:bg-[#2c2833]"
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
      </div>
      {walletNotice && (
        <div className="fixed right-6 top-24 z-[60] max-w-sm rounded-xl border border-[#4a4455] bg-[#100d16] px-4 py-3 text-sm text-[#e8dfee] shadow-xl">
          {walletNotice}
        </div>
      )}
    </nav>
  );
}
