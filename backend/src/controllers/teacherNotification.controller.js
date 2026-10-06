import { asyncHandler } from '../utils/asyncHandler.js';
import notificationEngine from '../services/notificationEngine.service.js';

// Teacher Panel read endpoints for the existing Notification Engine.
//
// There is no new model, collection or notification store here: every handler
// delegates to notificationEngine.service.js, which already scopes a result to
// the acting principal (`inboxFilter` matches `recipient.user` against the
// authenticated account id).
//
// The acting principal is always `req.user`, populated by the `protect`
// middleware from the verified JWT. For a logged-in teacher that is their own
// UserAccount document, and the engine's `resolvePrincipal` reads its
// `role`/`referenceId` to identify them. No teacher id is ever read from the
// query string, the route params or the request body.

const getTeacherNotifications = asyncHandler(async (req, res) => {
  const result = await notificationEngine.listForPrincipal(req.user, {
    page: req.query.page,
    limit: req.query.limit,
    unreadOnly: req.query.unreadOnly,
  });

  return res.status(200).json({
    success: true,
    message: 'Notifications fetched successfully',
    data: result,
  });
});

const getTeacherUnreadCount = asyncHandler(async (req, res) => {
  const result = await notificationEngine.getUnreadCountForPrincipal(req.user);

  return res.status(200).json({
    success: true,
    message: 'Unread notification count fetched successfully',
    data: result,
  });
});

// markAsReadForPrincipal ANDs the inbox filter into the update, so a teacher can
// only mark their own notification as read; anything else resolves to 404.
const markTeacherNotificationRead = asyncHandler(async (req, res) => {
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

const markAllTeacherNotificationsRead = asyncHandler(async (req, res) => {
  const result = await notificationEngine.markAllReadForPrincipal(req.user);

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
// removed: a teacher can only delete their own notification, never somebody
// else's (that is a 404, the record is left alone).

const deleteTeacherNotification = asyncHandler(async (req, res) => {
  const result = await notificationEngine.deleteForPrincipal(req.params.id, req.user);

  return res.status(200).json({
    success: true,
    message: 'Notification deleted successfully',
    data: result,
  });
});

const deleteSelectedTeacherNotifications = asyncHandler(async (req, res) => {
  const result = await notificationEngine.deleteManyForPrincipal(req.body?.ids, req.user);

  return res.status(200).json({
    success: true,
    message: 'Notifications deleted successfully',
    data: result,
  });
});

export {
  getTeacherNotifications,
  getTeacherUnreadCount,
  markTeacherNotificationRead,
  markAllTeacherNotificationsRead,
  deleteTeacherNotification,
  deleteSelectedTeacherNotifications,
};
