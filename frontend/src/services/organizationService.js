import { apiRequest } from './api';

export const organizationService = {
  list() {
    return apiRequest('/organizations');
  },

  create(payload) {
    return apiRequest('/organizations', {
      method: 'POST',
      body: payload,
    });
  },

  get(id) {
    return apiRequest(`/organizations/${id}`);
  },

  inviteMember(id, payload) {
    return apiRequest(`/organizations/${id}/members`, {
      method: 'POST',
      body: payload,
    });
  },

  createProject(id, payload) {
    return apiRequest(`/organizations/${id}/projects`, {
      method: 'POST',
      body: payload,
    });
  },

  listProjects(id) {
    return apiRequest(`/organizations/${id}/projects`);
  },
};
