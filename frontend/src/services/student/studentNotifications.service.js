import api from '../../api/axios';

/**
 * Student Portal notifications service.
 *
 * Backed by the recipient-scoped endpoints of the existing Notification Engine:
 *   GET  /api/v1/student/notifications               (page, limit, unreadOnly)
 *   GET  /api/v1/student/notifications/unread-count
 *   PUT  /api/v1/student/notifications/:id/read
 *   PUT  /api/v1/student/notifications/read-all
 *   DELETE /api/v1/student/notifications/:id
 *   POST /api/v1/student/notifications/delete-selected
 *
 * The server resolves the inbox from the authenticated session, so this service
 * never sends a student id: a student only ever receives their own notifications,
 * and an Administrator "Portal Access" session receives the selected student's.
 * Nothing here is fabricated - every field comes straight from the API response.
 */

/**
 * Notification types the backend can produce, mapped to their i18n label key.
 * `RESULT_PUBLISHED` has no producer yet but is declared by the backend
 * constants, so it is already handled. Anything unknown (a future type added on
 * the backend) falls back to the generic label instead of being hidden.
 */
export const NOTIFICATION_TYPE_LABEL_KEYS = {
  LEAVE_APPROVED: 'notificationTypeLeaveApproved',
  LEAVE_REJECTED: 'notificationTypeLeaveRejected',
  LEAVE_REQUESTED: 'notificationTypeLeaveRequested',
  HOMEWORK_CREATED: 'notificationTypeHomework',
  RESULT_PUBLISHED: 'notificationTypeResultPublished',
  MARKS_SUBMITTED: 'notificationTypeMarks',
  STUDENT_CREATED: 'notificationTypeStudentCreated',
  FEE_COLLECTED: 'notificationTypeFeeCollected',
  SALARY_PAYMENT_RECORDED: 'notificationTypeSalary',
};

/** Accent colour per type, so each kind is recognisable at a glance. */
export const NOTIFICATION_TYPE_STYLES = {
  LEAVE_APPROVED: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  LEAVE_REJECTED: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  LEAVE_REQUESTED: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  HOMEWORK_CREATED: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  RESULT_PUBLISHED: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  MARKS_SUBMITTED: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  STUDENT_CREATED: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  FEE_COLLECTED: 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  SALARY_PAYMENT_RECORDED: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
};

export const NOTIFICATION_TYPE_DEFAULT_STYLE =
  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';

const normalizeNotification = (notification) => {
  if (!notification) return null;

  return {
    ...notification,
    id: notification.id || notification._id,
    title: notification.title || '',
    message: notification.message || notification.content || '',
    type: notification.type || null,
    source: notification.source || null,
    // The engine resolves read state per principal and returns it as `read`.
    // Fall back to readBy so a response without the alias still renders right.
    read:
      typeof notification.read === 'boolean'
        ? notification.read
        : Array.isArray(notification.readBy) && notification.readBy.length > 0,
    time: notification.time || notification.createdAt || null,
  };
};

// The Student Header bell is always mounted, so the page and the badge have to
// agree after a mark-as-read. subscribe() returns its own unsubscribe function.
const changeListeners = new Set();

const subscribe = (listener) => {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
};

const emitChange = () => changeListeners.forEach((listener) => listener());

const getNotifications = async (params = {}) => {
  const query = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;
  if (params.unreadOnly) query.unreadOnly = 'true';

  const response = await api.get('/student/notifications', { params: query });
  const data = response.data?.data || {};

  return {
    notifications: (data.notifications || []).map(normalizeNotification).filter(Boolean),
    pagination: data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 },
  };
};

const getUnreadCount = async () => {
  const response = await api.get('/student/notifications/unread-count');
  return response.data?.data?.count ?? 0;
};

const markAsRead = async (id) => {
  const response = await api.put(`/student/notifications/${id}/read`);
  emitChange();
  return normalizeNotification(response.data?.data?.notification);
};

const markAllRead = async () => {
  const response = await api.put('/student/notifications/read-all');
  emitChange();
  return response.data?.data?.updatedCount ?? 0;
};

// Bell "X" and Manage mode "Delete Selected".
// Both hit the authorized delete route of the existing Notification Engine,
// which resolves the id against the signed-in student's own inbox on the server,
// so a student can never remove somebody else's notification. It is the same
// Notification record the Notifications page lists - nothing else is touched.
const deleteNotification = async (id) => {
  await api.delete(`/student/notifications/${id}`);
  emitChange();
  return true;
};

const deleteSelected = async (ids) => {
  const response = await api.post('/student/notifications/delete-selected', { ids });
  emitChange();
  return response.data?.data || { deletedCount: 0, notFoundIds: [] };
};

export {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteSelected,
  subscribe,
  emitChange,
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  deleteNotification,
  deleteSelected,
  subscribe,
  emitChange,
  NOTIFICATION_TYPE_LABEL_KEYS,
  NOTIFICATION_TYPE_STYLES,
  NOTIFICATION_TYPE_DEFAULT_STYLE,
};
