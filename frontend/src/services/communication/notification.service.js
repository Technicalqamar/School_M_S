import api from '../../api/axios';

// Audiences offered in the Admin Notifications audience dropdown (both the
// create/edit form and the list filter). `Parents`/`Staff` were removed because
// the school has no Parent Portal and no Staff Portal; the backend rejects them
// too. Existing records that still carry one of those values are left untouched
// and keep rendering through getAudienceLabel.
const AUDIENCES = ['All', 'Students', 'Teachers'];

// Tiny pub/sub so the Admin Header Bell badge can refresh as soon as the
// Notifications page creates/marks-read/deletes a notification — without the
// bell having to poll or wait for the dropdown to open. The Admin Header
// persists across routes, so this is what keeps the always-visible count live.
const changeListeners = new Set();
const subscribe = (listener) => {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
};
const emitChange = () => changeListeners.forEach((listener) => listener());

const normalizeNotification = (notification) => {
  if (!notification) return null;
  return {
    ...notification,
    id: notification.id || notification._id,
    time: notification.time || notification.createdAt,
    content: notification.content || notification.message,
  };
};

const notificationService = {
  getNotifications: async (filters = {}) => {
    const params = {};
    if (filters.audience && filters.audience !== 'All') params.audience = filters.audience;
    if (filters.search) params.search = filters.search;
    if (filters.unreadOnly) params.unreadOnly = 'true';
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    const response = await api.get('/communication/notifications', { params });
    const data = response.data?.data || {};
    return {
      notifications: (data.notifications || []).map(normalizeNotification),
      pagination: data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 },
    };
  },

  getUnreadCount: async () => {
    const response = await api.get('/communication/notifications/unread-count');
    return response.data?.data?.count ?? 0;
  },

  getNotificationById: async (id) => {
    const response = await api.get(`/communication/notifications/${id}`);
    return normalizeNotification(response.data?.data?.notification) || null;
  },

  createNotification: async (data) => {
    const response = await api.post('/communication/notifications', data);
    return normalizeNotification(response.data?.data?.notification) || null;
  },

  updateNotification: async (id, data) => {
    const response = await api.put(`/communication/notifications/${id}`, data);
    return normalizeNotification(response.data?.data?.notification) || null;
  },

  markAsRead: async (id) => {
    const response = await api.put(`/communication/notifications/${id}/read`);
    return normalizeNotification(response.data?.data?.notification) || null;
  },

  markAllRead: async () => {
    const response = await api.put('/communication/notifications/read-all');
    return response.data?.data?.updatedCount ?? 0;
  },

  // Removes one notification (Admin Bell "X" and the existing Notifications page
// action share this call) and refreshes every subscriber of this service, so the
// always-visible badge updates as soon as the record is gone.
deleteNotification: async (id) => {
    const response = await api.delete(`/communication/notifications/${id}`);
    emitChange();
    return response.data;
  },

  // Bell "Manage / Delete Selected". Reuses the same authorized admin route the
  // single delete uses; only the ids listed are removed, and the response reports
  // how many were really deleted plus which ids no longer existed.
  deleteSelected: async (ids) => {
    const response = await api.post('/communication/notifications/delete-selected', { ids });
    emitChange();
    return response.data?.data || { deletedCount: 0, notFoundIds: [] };
  },

  subscribe,
  emitChange,

  AUDIENCES,
};

export default notificationService;