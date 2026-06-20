import { apiRequest } from './api';

export const reviewService = {
  approve(reportId, comment, txHash) {
    return apiRequest(`/reports/${reportId}/approve`, {
      method: 'POST',
      body: { comment, txHash },
    });
  },

  reject(reportId, comment, txHash) {
    return apiRequest(`/reports/${reportId}/reject`, {
      method: 'POST',
      body: { comment, txHash },
    });
  },
};
