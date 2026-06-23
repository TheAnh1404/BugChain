import { API_BASE_URL, apiRequest, getStoredToken } from './api';

export const userProofService = {
  list() {
    return apiRequest('/user-proofs');
  },

  exportUrl() {
    return `${API_BASE_URL}/user-proofs/export`;
  },

  async downloadCsv() {
    const token = getStoredToken();
    const response = await fetch(this.exportUrl(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error('Unable to export wallet interaction proofs.');
    }

    return response.blob();
  },
};
