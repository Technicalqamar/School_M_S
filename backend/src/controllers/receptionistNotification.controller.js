import { asyncHandler } from '../utils/asyncHandler.js';
import notificationEngine from '../services/notificationEngine.service.js';
import { hasActionAccess } from '../constants/permissions.js';
import { NOTIFICATION_CATEGORIES } from '../constants/notification.constants.js';

// Receptionist Header Bell read endpoints for the existing Notification Engine.
//
// There is no new model, collection or notification store here: every handler
// delegates to notificationEngine.service.js, which already scopes a result to
// the acting principal (`inboxFilter` matches `recipient.user` against the
// authenticated account id). The acting principal is always `req.user`,
// populated by the `protect` middleware from the verified JWT.
//
// The bell is permission-driven:
//   * which categories are visible comes from the receptionist's stored
//     `notification-bell` actions (student-leave / teacher-leave / other) on
//     `req.receptionistProfile.permissions` — NEVER from client input;
//   * route guards (`requireActionAccess('notification-bell', ...)`) enforce
//     bell visibility (bell-view) and mark-as-read (mark-read) server-side;
//   * the bell is compact by design: no manage/delete mode and no deep-links,
//     mirroring what a front-desk role needs.

// Resolves the bell categories this receptionist is allowed to see.
const getBellCategories = (permissions) => {
  const categories = [];
  if (hasActionAccess(permissions, 'notification-bell', 'student-leave')) {
    categories.push(NOTIFICATION_CATEGORIES.STUDENT_LEAVE);
  }
  if (hasActionAccess(permissions, 'notification-bell', 'teacher-leave')) {
    categories.push(NOTIFICATION_CATEGORIES.TEACHER_LEAVE);
  }
  if (hasActionAccess(permissions, 'notification-bell', 'other')) {
    categories.push(NOTIFICATION_CATEGORIES.GENERAL);
  }
  return categories;
};

const getReceptionistNotifications = asyncHandler(async (req, res) => {
  const permissions = Array.isArray(req.receptionistProfile?.permissions)
    ? req.receptionistProfile.permissions
    : [];
  const result = await notificationEngine.listForPrincipal(req.user, {
    page: req.query.page,
    limit: req.query.limit,
    unreadOnly: req.query.unreadOnly,
    categories: getBellCategories(permissions),
  });

  return res.status(200).json({
    success: true,
    message: 'Notifications fetched successfully',
    data: result,
  });
});

const getReceptionistUnreadCount = asyncHandler(async (req, res) => {
  const permissions = Array.isArray(req.receptionistProfile?.permissions)
    ? req.receptionistProfile.permissions
    : [];
  const result = await notificationEngine.getUnreadCountForPrincipal(req.user, {
    categories: getBellCategories(permissions),
  });

  return res.status(200).json({
    success: true,
    message: 'Unread notification count fetched successfully',
    data: result,
  });
});

// markAsReadForPrincipal ANDs the inbox filter into the update, so a
// receptionist can only mark their own notification as read; anything else
// resolves to 404.
const markReceptionistNotificationRead = asyncHandler(async (req, res) => {
  const notification = await notificationEngine.markAsReadForPrincipal(
    req.params.id,
    req.user,
  );

  return res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: { notification },
  });
});

const markAllReceptionistNotificationsRead = asyncHandler(async (req, res) => {
  const result = await notificationEngine.markAllReadForPrincipal(req.user);

  return res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
    data: result,
  });
});

export {
  getReceptionistNotifications,
  getReceptionistUnreadCount,
  markReceptionistNotificationRead,
  markAllReceptionistNotificationsRead,
};