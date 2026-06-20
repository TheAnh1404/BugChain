import { apiRequest, toQueryString } from './api';

export const reportService = {
  submit(bountyId, payload) {
    return apiRequest(`/bounties/${bountyId}/reports`, {
      method: 'POST',
      body: payload,
    });
  },

  listForBounty(bountyId, params) {
    return apiRequest(`/bounties/${bountyId}/reports${toQueryString(params)}`);
  },

  mine(params) {
    return apiRequest(`/reports/me${toQueryString(params)}`);
  },

  get(id) {
    return apiRequest(`/reports/${id}`);
  },

  update(id, payload) {
    return apiRequest(`/reports/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  updateOnChain(id, payload) {
    return apiRequest(`/reports/${id}/onchain`, {
      method: 'PATCH',
      body: payload,
    });
  },

  claimReward(id, txHash) {
    return apiRequest(`/reports/${id}/claim`, {
      method: 'PATCH',
      body: { txHash },
    });
  },
};
