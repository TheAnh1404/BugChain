import { apiRequest, toQueryString } from './api';

export const bountyService = {
  list(params) {
    return apiRequest(`/bounties${toQueryString(params)}`, { auth: false });
  },

  get(id) {
    return apiRequest(`/bounties/${id}`, { auth: false });
  },

  create(payload) {
    return apiRequest('/bounties', {
      method: 'POST',
      body: payload,
    });
  },

  update(id, payload) {
    return apiRequest(`/bounties/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  updateOnChain(id, payload) {
    return apiRequest(`/bounties/${id}/onchain`, {
      method: 'PATCH',
      body: payload,
    });
  },

  refundBounty(id, txHash, transactionId) {
    return apiRequest(`/bounties/${id}/refund`, {
      method: 'PATCH',
      body: { txHash, transactionId },
    });
  },

  remove(id) {
    return apiRequest(`/bounties/${id}`, {
      method: 'DELETE',
    });
  },
};
