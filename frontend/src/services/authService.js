import { apiRequest } from './api';

export const authService = {
  register(payload) {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: payload,
      auth: false,
    });
  },

  login(payload) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: payload,
      auth: false,
    });
  },

  me() {
    return apiRequest('/auth/me');
  },
};
