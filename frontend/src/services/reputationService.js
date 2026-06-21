import { apiRequest, toQueryString } from './api';

export const reputationService = {
  me() {
    return apiRequest('/reputation/me');
  },

  leaderboard(params) {
    return apiRequest(`/reputation/leaderboard${toQueryString(params)}`);
  },

  user(userId) {
    return apiRequest(`/reputation/users/${userId}`);
  },
};
