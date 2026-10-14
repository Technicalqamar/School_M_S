import api from '../../api/axios';

// Receptionist Header Bell service. All endpoints are receptionist-only and
// action-gated server-side (`bell-view` for reads, `mark-read` for the read
// mutations). The category filter is derived by the backend from the caller's
// stored `notification-bell` permissions - the client never guesses it.
//
// The bell is compact by design: no create/edit/delete and no deep-links, so
// this service intentionally has no manage/delete surface.
// Tiny pub/sub so the always-visible Receptionist Bell badge can refresh the
// moment the backend reports a change (realtime) or the bell performs its own
// mark-as-read, without the bell having to poll.
const changeListeners = new Set();
const subscribe = (listener) => {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
};
const emitChange = () => {
  changeListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A listener failure must not break the caller.
    }
  });
};

const normalizeNotification = (notification) => {
  if (!notification) return null;
  return {
    ...notification,
    id: notification.id || notification._id,
    time: notification.time || notification.createdAt,
    content: notification.content || notification.message,
  };
};

const receptionistNotificationService = {
  getNotifications: async (filters = {}) => {
    const params = {};
    if (filters.unreadOnly) params.unreadOnly = 'true';
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    const response = await api.get('/receptionist/notifications', { params });
    const data = response.data?.data || {};
    return {
      notifications: (data.notifications || []).map(normalizeNotification),
      pagination: data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 },
    };
  },

  getUnreadCount: async () => {
    const response = await api.get('/receptionist/notifications/unread-count');
    return response.data?.data?.count ?? 0;
  },

  markAsRead: async (id) => {
    const response = await api.put(`/receptionist/notifications/${id}/read`);
    const notification = normalizeNotification(response.data?.data?.notification) || null;
    emitChange();
    return notification;
  },

  markAllRead: async () => {
    const response = await api.put('/receptionist/notifications/read-all');
    const updated = response.data?.data?.updatedCount ?? 0;
    emitChange();
    return updated;
  },

  subscribe,
  emitChange,
};

export default receptionistNotificationService;