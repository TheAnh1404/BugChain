import { apiRequest, toQueryString } from './api';

export const notificationService = {
  list(params) {
    return apiRequest(`/notifications${toQueryString(params)}`);
  },

  unreadCount() {
    return apiRequest('/notifications/unread-count');
  },

  markRead(id) {
    return apiRequest(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  markAllRead() {
    return apiRequest('/notifications/read-all', {
      method: 'PATCH',
    });
  },
};
