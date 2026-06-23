import { apiRequest } from './api';

export const analyticsService = {
  security() {
    return apiRequest('/analytics/security');
  },

  overview() {
    return apiRequest('/analytics/overview');
  },

  funnel() {
    return apiRequest('/analytics/funnel');
  },

  walletInteractions() {
    return apiRequest('/analytics/wallet-interactions');
  },
};
