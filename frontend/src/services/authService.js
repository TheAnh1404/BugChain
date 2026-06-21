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

  verifyEmail(token) {
    return apiRequest(`/auth/verify-email?token=${token}`, {
      method: 'GET',
      auth: false,
    });
  },

  logout(refreshToken) {
    return apiRequest('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    });
  },

  forgotPassword(email) {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      auth: false,
    });
  },

  resetPassword(payload) {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: payload,
      auth: false,
    });
  },

  changePassword(payload) {
    return apiRequest('/auth/change-password', {
      method: 'POST',
      body: payload,
    });
  },

  getSessions() {
    return apiRequest('/auth/sessions', {
      method: 'GET',
    });
  },

  revokeSession(sessionId) {
    return apiRequest(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  revokeOtherSessions() {
    return apiRequest('/auth/sessions/other', {
      method: 'DELETE',
    });
  },

  revokeAllSessions() {
    return apiRequest('/auth/sessions/all', {
      method: 'DELETE',
    });
  },

  me() {
    return apiRequest('/auth/me');
  },
};
