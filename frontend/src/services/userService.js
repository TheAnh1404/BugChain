import { apiRequest } from './api';

export const userService = {
  me() {
    return apiRequest('/users/me');
  },

  updateMe(payload) {
    return apiRequest('/users/me', {
      method: 'PATCH',
      body: payload,
    });
  },
};
