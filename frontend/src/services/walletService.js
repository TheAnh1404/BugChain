import { apiRequest } from './api';

export const walletService = {
  createNonce(walletAddress) {
    return apiRequest('/wallets/nonce', {
      method: 'POST',
      body: { walletAddress },
    });
  },

  link(walletAddress, message, signature) {
    return apiRequest('/wallets/link', {
      method: 'POST',
      body: { walletAddress, message, signature },
    });
  },

  mine() {
    return apiRequest('/wallets/me');
  },

  remove(walletId) {
    return apiRequest(`/wallets/${walletId}`, {
      method: 'DELETE',
    });
  },
};
