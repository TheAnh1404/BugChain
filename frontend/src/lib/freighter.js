import {
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  requestAccess,
  signMessage,
} from '@stellar/freighter-api';
import { getStoredToken } from '../services/api';
import { walletService } from '../services/walletService';

export const STELLAR_TESTNET_NETWORK = 'TESTNET';
export const STELLAR_TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

function getFreighterErrorMessage(result, fallbackMessage) {
  if (!result?.error) return '';
  return result.error.message || result.error.code || fallbackMessage;
}

function throwIfFreighterError(result, fallbackMessage) {
  const message = getFreighterErrorMessage(result, fallbackMessage);
  if (message) {
    throw new Error(message);
  }
}

export async function checkFreighterInstalled() {
  const result = await isConnected();
  throwIfFreighterError(result, 'Unable to reach the Freighter extension.');

  return Boolean(result?.isConnected);
}

export async function getFreighterNetwork() {
  const result = await getNetwork();
  throwIfFreighterError(result, 'Unable to read the Freighter network.');

  if (result.network !== STELLAR_TESTNET_NETWORK) {
    throw new Error('Please switch Freighter to Stellar Testnet.');
  }

  return result.network;
}

export async function connectFreighterTestnet() {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw new Error(
      'Freighter wallet extension is not installed. Please install Freighter and refresh this page.',
    );
  }

  const allowedResult = await isAllowed();
  throwIfFreighterError(allowedResult, 'Unable to check Freighter permissions.');

  let address = '';

  if (allowedResult.isAllowed) {
    const addressResult = await getAddress();
    throwIfFreighterError(addressResult, 'Unable to read your Freighter address.');
    address = addressResult.address;
  }

  if (!address) {
    const accessResult = await requestAccess();
    throwIfFreighterError(accessResult, 'Freighter access request was rejected.');
    address = accessResult.address;
  }

  if (!address) {
    throw new Error('Freighter did not return a wallet address.');
  }

  const network = await getFreighterNetwork();

  return {
    address,
    network,
  };
}

export async function signWalletVerificationMessage(message, address) {
  const result = await signMessage(message, {
    address,
    networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
  });

  throwIfFreighterError(result, 'Freighter could not sign the verification message.');

  if (!result.signedMessage) {
    throw new Error('Freighter did not return a signature.');
  }

  if (
    result.signerAddress &&
    result.signerAddress.toUpperCase() !== address.toUpperCase()
  ) {
    throw new Error('Freighter signed with a different wallet address.');
  }

  return result.signedMessage;
}

export async function linkFreighterWallet() {
  if (!getStoredToken()) {
    throw new Error('Please login first.');
  }

  const { address } = await connectFreighterTestnet();
  const nonceResponse = await walletService.createNonce(address);
  const signature = await signWalletVerificationMessage(nonceResponse.message, address);

  return walletService.link(address, nonceResponse.message, signature);
}
