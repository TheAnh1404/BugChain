import { apiRequest, toQueryString } from './api';

export const transactionService = {
  start(payload) {
    return apiRequest('/transactions', {
      method: 'POST',
      body: payload,
    });
  },

  fail(transactionId, payload = {}) {
    return apiRequest(`/transactions/${transactionId}/fail`, {
      method: 'PATCH',
      body: payload,
    });
  },

  mine(params) {
    return apiRequest(`/transactions/me${toQueryString(params)}`);
  },

  forBounty(bountyId, params) {
    return apiRequest(`/transactions/bounty/${bountyId}${toQueryString(params)}`);
  },
};
