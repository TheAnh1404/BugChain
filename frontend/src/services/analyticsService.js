import { apiRequest } from './api';

export const analyticsService = {
  security() {
    return apiRequest('/analytics/security');
  },
};
