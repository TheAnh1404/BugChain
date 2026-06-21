import { apiRequest } from './api';

export const reviewService = {
  approve(reportId, comment, txHash, transactionId) {
    return apiRequest(`/reports/${reportId}/approve`, {
      method: 'POST',
      body: { comment, txHash, transactionId },
    });
  },

  reject(reportId, comment, txHash, transactionId) {
    return apiRequest(`/reports/${reportId}/reject`, {
      method: 'POST',
      body: { comment, txHash, transactionId },
    });
  },
};
