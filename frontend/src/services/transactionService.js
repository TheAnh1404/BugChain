import { apiRequest, toQueryString } from './api';

export const transactionService = {
  mine(params) {
    return apiRequest(`/transactions/me${toQueryString(params)}`);
  },

  forBounty(bountyId, params) {
    return apiRequest(`/transactions/bounty/${bountyId}${toQueryString(params)}`);
  },
};
