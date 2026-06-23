import { apiRequest } from './api';

export const onboardingService = {
  me() {
    return apiRequest('/onboarding/me');
  },

  update(payload) {
    return apiRequest('/onboarding/me', {
      method: 'PATCH',
      body: payload,
    });
  },

  complete() {
    return apiRequest('/onboarding/complete', {
      method: 'POST',
    });
  },
};
