import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';

export default function LandingPage({ setCurrentView, isAuthenticated }) {
  const securityDashboardImg = "https://lh3.googleusercontent.com/aida-public/AB6AXuCAokoETiG0-0xjd2ieAxc5qCmlw6gRgEMj9r4XDXtRuwXO60Hd4PDjzG4YEbh0aQW9q4oBXwAqgJCpT0i7uiopWOihedzcmEKzBD28Re2fBO5Qxixfpby5mfYjj6CVM10iFwvUIhFS-keGZEbD3Vit0cp1tus9qx1Olzg5VPAh0M6ybxRqL4Hhx2xVnUJ2_ei4NIJ9A07Gzsa2INdOVdyCEx0dLZ7sLqBW6LEkJww2mdt0FKV_7Ce0dBZxrM4fjjfY7BfQZdF8gk_4";
  const {
    wallet,
    shortenedAddress,
    isConnecting,
    isWrongNetwork,
    connectWallet,
  } = useWallet();
  const [walletError, setWalletError] = useState('');

  const walletLabel = !isAuthenticated
    ? 'Sign In to Link Wallet'
    : isConnecting
      ? 'Connecting...'
      : isWrongNetwork
        ? 'Switch to Testnet'
        : wallet
          ? shortenedAddress
          : 'Connect Freighter';

  const handleWalletClick = async () => {
    setWalletError('');

    if (!isAuthenticated) {
      setWalletError('Please login first.');
      setCurrentView('login');
      return;
    }

    if (wallet) {
      setCurrentView('profile');
      return;
    }

    try {
      await connectWallet();
      setCurrentView('profile');
    } catch (err) {
      setWalletError(err.message);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-80px)] bg-[#0A0A0A] overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 hero-gradient pointer-events-none"></div>
      
      {/* Hero section */}
      <section className="max-w-[1440px] mx-auto px-8 pt-24 pb-16 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#d2bbff] mb-8 animate-fade-in">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span className="text-[11px] font-mono uppercase tracking-widest font-semibold">Powered by Soroban</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold max-w-4xl mx-auto leading-tight mb-6 text-[#e8dfee]">
          Secure Software Through <span className="text-[#d2bbff]">Decentralized</span> Bug Bounties
        </h1>
        
        <p className="text-lg md:text-xl text-[#ccc3d8] max-w-2xl mx-auto mb-10 leading-relaxed">
          Create, fund and resolve security bounties on Stellar with transparent on-chain rewards. Join a global network of elite security researchers.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button 
            onClick={handleWalletClick}
            disabled={isConnecting}
            className="bg-[#7c3aed] text-[#ede0ff] px-8 py-4 rounded-xl font-bold text-base hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] active:scale-95 transition-all"
          >
            {walletLabel}
          </button>
          <button 
            onClick={() => setCurrentView('marketplace')}
            className="glass text-[#e8dfee] px-8 py-4 rounded-xl font-bold text-base hover:bg-[#2c2833] active:scale-95 transition-all"
          >
            Explore Bounties
          </button>
        </div>
        {walletError && (
          <p className="mx-auto mt-4 max-w-lg text-sm text-[#ffb4ab]">{walletError}</p>
        )}
      </section>

      {/* Metrics Bento Grid */}
      <section className="max-w-[1440px] mx-auto px-8 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-2 glass p-8 rounded-3xl flex flex-col justify-between group hover:border-[#7c3aed]/40 transition-all duration-300">
            <div>
              <p className="text-xs font-semibold text-[#ccc3d8] uppercase tracking-widest mb-2">Cumulative Rewards Distributed</p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#d2bbff]">$12,482,900</h2>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="h-1.5 flex-1 bg-[#221e28] rounded-full overflow-hidden">
                <div className="h-full bg-[#7c3aed] w-3/4 group-hover:w-full transition-all duration-1000"></div>
              </div>
              <span className="font-mono text-sm text-[#d2bbff] font-semibold">+12% WoW</span>
            </div>
          </div>
          
          <div className="glass p-8 rounded-3xl text-center flex flex-col justify-center items-center hover:border-[#7c3aed]/40 transition-all duration-300">
            <span className="material-symbols-outlined text-[#d2bbff] text-5xl mb-4">shield</span>
            <p className="text-xs font-semibold text-[#ccc3d8] uppercase tracking-widest">Active Bounties</p>
            <h3 className="text-3xl font-bold text-[#e8dfee] mt-2">452 Campaigns</h3>
          </div>
          
          <div className="glass p-8 rounded-3xl text-center flex flex-col justify-center items-center hover:border-[#7c3aed]/40 transition-all duration-300">
            <span className="material-symbols-outlined text-[#d2bbff] text-5xl mb-4">person_search</span>
            <p className="text-xs font-semibold text-[#ccc3d8] uppercase tracking-widest">Active Researchers</p>
            <h3 className="text-3xl font-bold text-[#e8dfee] mt-2">2.1k Hunters</h3>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-[1440px] mx-auto px-8 py-16 relative z-10">
        <div className="flex flex-col lg:flex-row gap-16 items-center">
          <div className="flex-1 space-y-12">
            <h2 className="text-3xl md:text-4xl font-bold text-[#e8dfee]">Bulletproof Infrastructure for Ethical Hacking</h2>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#d2bbff]">account_balance_wallet</span>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-[#e8dfee] mb-2">On-Chain Escrow</h4>
                  <p className="text-[#ccc3d8] leading-relaxed">Funds are locked in transparent smart contracts, ensuring payment is guaranteed once a vulnerability is verified.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#d2bbff]">bolt</span>
                </div>
                <div>
                  <h4 className="text-xl font-bold text-[#e8dfee] mb-2">Instant Settlement</h4>
                  <p className="text-[#ccc3d8] leading-relaxed">Automated distribution of rewards through Soroban smart contracts on the Stellar network with near-zero fees.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative w-full">
            <div className="glass rounded-2xl p-6 border border-[#4a4455] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ffb4ab]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#ffb784]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#d2bbff]"></div>
                </div>
                <span className="font-mono text-xs text-[#ccc3d8]">Security_Monitor.exe</span>
              </div>
              
              <div className="aspect-video bg-[#2c2833] rounded-lg flex items-center justify-center relative overflow-hidden border border-[#4a4455]">
                <img 
                  className="w-full h-full object-cover" 
                  src={securityDashboardImg} 
                  alt="Security Dashboard Visual" 
                />
              </div>
            </div>
            
            {/* floating verified tag */}
            <div className="absolute -bottom-4 -right-4 glass p-4 rounded-xl border border-[#7c3aed]/30 animate-bounce shadow-lg">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#d2bbff]">verified_user</span>
                <span className="font-mono text-sm text-[#e8dfee]">Bounty Verified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lifecycle Flow */}
      <section className="max-w-[1440px] mx-auto px-8 py-20 relative z-10 border-t border-[#4a4455]/30">
        <h2 className="text-3xl font-bold text-center mb-16 text-[#e8dfee]">The Lifecycle of a Bounty</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          <div className="hidden md:block absolute top-12 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#4a4455] to-transparent -z-10"></div>
          
          <div className="flex flex-col items-center text-center group">
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center border-[#4a4455] group-hover:border-[#7c3aed] transition-all duration-300 mb-6">
              <span className="material-symbols-outlined text-3xl text-[#d2bbff]">add_circle</span>
            </div>
            <h4 className="text-xl font-bold text-[#e8dfee] mb-2">1. Create &amp; Fund</h4>
            <p className="text-sm text-[#ccc3d8] max-w-xs">Projects deposit XLP or custom Stellar assets into a secure smart contract escrow.</p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center border-[#4a4455] group-hover:border-[#7c3aed] transition-all duration-300 mb-6">
              <span className="material-symbols-outlined text-3xl text-[#d2bbff]">terminal</span>
            </div>
            <h4 className="text-xl font-bold text-[#e8dfee] mb-2">2. Hunt &amp; Report</h4>
            <p className="text-sm text-[#ccc3d8] max-w-xs">Researchers find vulnerabilities and submit secure, encrypted reports for review.</p>
          </div>

          <div className="flex flex-col items-center text-center group">
            <div className="w-20 h-20 rounded-full glass flex items-center justify-center border-[#4a4455] group-hover:border-[#7c3aed] transition-all duration-300 mb-6">
              <span className="material-symbols-outlined text-3xl text-[#d2bbff]">currency_exchange</span>
            </div>
            <h4 className="text-xl font-bold text-[#e8dfee] mb-2">3. Resolve &amp; Earn</h4>
            <p className="text-sm text-[#ccc3d8] max-w-xs">Once verified, the escrow releases funds directly to the researcher's wallet.</p>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="max-w-4xl mx-auto px-8 py-20 text-center relative z-10">
        <div className="glass p-12 rounded-3xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#7c3aed]/15 blur-[80px] rounded-full"></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-[#e8dfee] mb-4">Ready to secure the future?</h2>
            <p className="text-[#ccc3d8] mb-8 max-w-lg mx-auto leading-relaxed">
              Whether you're a developer looking for security audits or a researcher seeking your next payout, BugChain is your portal.
            </p>
            <button 
              onClick={() => setCurrentView('marketplace')}
              className="bg-[#7c3aed] text-[#ede0ff] px-10 py-4 rounded-xl font-bold hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] active:scale-95 transition-all inline-flex items-center gap-2"
            >
              Start Hunting <span className="material-symbols-outlined">trending_flat</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 px-8 flex flex-col md:flex-row justify-between items-center mt-24 border-t border-[#4a4455]/40 bg-[#100d16] relative z-10">
        <div className="flex flex-col items-center md:items-start gap-2 mb-6 md:mb-0">
          <span className="text-xl font-bold text-[#e8dfee]">BugChain</span>
          <p className="text-xs text-[#ccc3d8]">© 2026 BugChain. Secured by Soroban.</p>
        </div>
        <div className="flex gap-8">
          <a className="text-xs text-[#ccc3d8] hover:text-[#d2bbff] transition-all hover:underline" href="#">Terms</a>
          <a className="text-xs text-[#ccc3d8] hover:text-[#d2bbff] transition-all hover:underline" href="#">Privacy</a>
          <a className="text-xs text-[#ccc3d8] hover:text-[#d2bbff] transition-all hover:underline" href="#">Discord</a>
          <a className="text-xs text-[#ccc3d8] hover:text-[#d2bbff] transition-all hover:underline" href="https://github.com" target="_blank" rel="noreferrer">Github</a>
        </div>
      </footer>
    </div>
  );
}
