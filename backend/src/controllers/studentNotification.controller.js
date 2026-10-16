import { asyncHandler } from '../utils/asyncHandler.js';
import notificationEngine from '../services/notificationEngine.service.js';

// Student Portal read endpoints for the existing Notification Engine.
//
// There is no new model, collection or notification store here: every handler
// delegates to notificationEngine.service.js, which already scopes a result to
// the acting principal (`inboxFilter` matches `recipient.user` against the
// authenticated account id).
//
// The acting principal is always `req.user`, populated by the `protect`
// middleware from the verified JWT. It is a UserAccount document for a logged-in
// student, and - because a portal access token is minted with the *selected*
// student's own account id (portalAccess.service.js) - also for an
// Administrator-authorized Portal Access session. No student id is ever read
// from the query string, the route params or the request body.

const getStudentNotifications = asyncHandler(async (req, res) => {
  // Optional `types` filter (comma-separated notification types). Used by the
  // Student Portal "Fee Reminders" area to read only FEE_REMINDER notifications
  // from the same inbox - it narrows the principal-scoped query, never widens it.
  const types = typeof req.query.types === 'string' && req.query.types.trim()
    ? req.query.types.split(',').map((t) => t.trim()).filter(Boolean)
    : undefined;

  const result = await notificationEngine.listForPrincipal(req.user, {
    page: req.query.page,
    limit: req.query.limit,
    unreadOnly: req.query.unreadOnly,
    types,
  });

  return res.status(200).json({
    success: true,
    message: 'Notifications fetched successfully',
    data: result,
  });
});

const getStudentUnreadCount = asyncHandler(async (req, res) => {
  const types = typeof req.query.types === 'string' && req.query.types.trim()
    ? req.query.types.split(',').map((t) => t.trim()).filter(Boolean)
    : undefined;

  const result = await notificationEngine.getUnreadCountForPrincipal(req.user, { types });

  return res.status(200).json({
    success: true,
    message: 'Unread notification count fetched successfully',
    data: result,
  });
});

// markAsReadForPrincipal ANDs the inbox filter into the update, so a student can
// only mark their own notification as read; anything else resolves to 404.
const markStudentNotificationRead = asyncHandler(async (req, res) => {
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

const markAllStudentNotificationsRead = asyncHandler(async (req, res) => {
  const types = typeof req.query.types === 'string' && req.query.types.trim()
    ? req.query.types.split(',').map((t) => t.trim()).filter(Boolean)
    : undefined;

  const result = await notificationEngine.markAllReadForPrincipal(req.user, { types });

  return res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
    data: result,
  });
});

// ── Deletes ───────────────────────────────────────────────────────────────────
// The Bell "X" and the Manage mode "Delete Selected" both work on the *same*
// Notification record the list endpoint reads - there is no separate bell store
// to keep in sync and nothing else is touched. Both handlers delegate to the
// engine's principal scoped delete, so the inbox filter decides what may be
// removed: a student can only delete their own notification, never somebody
// else's (that is a 404, the record is left alone).

const deleteStudentNotification = asyncHandler(async (req, res) => {
  const result = await notificationEngine.deleteForPrincipal(req.params.id, req.user);

  return res.status(200).json({
    success: true,
    message: 'Notification deleted successfully',
    data: result,
  });
});

const deleteSelectedStudentNotifications = asyncHandler(async (req, res) => {
  const result = await notificationEngine.deleteManyForPrincipal(req.body?.ids, req.user);

  return res.status(200).json({
    success: true,
    message: 'Notifications deleted successfully',
    data: result,
  });
});

export {
  getStudentNotifications,
  getStudentUnreadCount,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
  deleteStudentNotification,
  deleteSelectedStudentNotifications,
};
