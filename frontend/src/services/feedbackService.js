import { apiRequest } from './api';

export const feedbackService = {
  create(payload) {
    return apiRequest('/feedback', {
      method: 'POST',
      body: payload,
    });
  },

  mine() {
    return apiRequest('/feedback/me');
  },

  summary(options = {}) {
    return apiRequest('/feedback/summary', options);
  },
};
