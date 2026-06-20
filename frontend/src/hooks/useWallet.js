import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { linkFreighterWallet } from '../lib/freighter';
import { walletService } from '../services/walletService';
import { shortenAddress } from '../utils/shortenAddress';

export function useWallet() {
  const { isAuthenticated, refreshMe } = useAuth();
  const [wallets, setWallets] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const wallet = useMemo(
    () =>
      wallets.find((item) => item.isPrimary && item.verifiedAt) ||
      wallets.find((item) => item.verifiedAt) ||
      wallets[0] ||
      null,
    [wallets],
  );

  const loadWallets = useCallback(async () => {
    if (!isAuthenticated) {
      setWallets([]);
      return [];
    }

    const result = await walletService.mine();
    setWallets(result);
    return result;
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!isAuthenticated) {
        setWallets([]);
        return;
      }

      try {
        const result = await walletService.mine();
        if (isMounted) {
          setWallets(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const connectWallet = useCallback(async () => {
    if (!isAuthenticated) {
      const authError = new Error('Please login first.');
      setError(authError.message);
      throw authError;
    }

    setIsConnecting(true);
    setError('');

    try {
      const linkedWallet = await linkFreighterWallet();
      await loadWallets();
      await refreshMe();
      return linkedWallet;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [isAuthenticated, loadWallets, refreshMe]);

  const disconnectWallet = useCallback(
    async (walletId) => {
      if (!walletId) return;

      setError('');
      await walletService.remove(walletId);
      await loadWallets();
      await refreshMe();
    },
    [loadWallets, refreshMe],
  );

  return {
    wallets,
    wallet,
    shortenedAddress: shortenAddress(wallet?.walletAddress),
    isConnecting,
    error,
    isWrongNetwork: error === 'Please switch Freighter to Stellar Testnet.',
    loadWallets,
    connectWallet,
    disconnectWallet,
  };
}
