import express from 'express';
import {
  getReceptionistNotifications,
  getReceptionistUnreadCount,
  markReceptionistNotificationRead,
  markAllReceptionistNotificationsRead,
} from '../controllers/receptionistNotification.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import { requireActionAccess } from '../middlewares/permission.middleware.js';

// Receptionist Header Bell endpoints.
//
// Unlike the shared Admin modules, the bell lives entirely inside the
// `notification-bell` capability module, so the guards are action-level:
//   * bell-view   -> the bell may be rendered and its list / unread count read
//   * mark-read   -> items may be marked as read
// The category filter itself is resolved by the controller from the stored
// permissions (student-leave / teacher-leave / other), never from the client.
const router = express.Router();

const receptionistOnly = [protect, authorize('receptionist')];

// Literal sub-paths must be declared before the parameterised handlers.
router.get(
  '/unread-count',
  ...receptionistOnly,
  requireActionAccess('notification-bell', 'bell-view'),
  getReceptionistUnreadCount,
);
router.put(
  '/read-all',
  ...receptionistOnly,
  requireActionAccess('notification-bell', 'bell-view'),
  requireActionAccess('notification-bell', 'mark-read'),
  markAllReceptionistNotificationsRead,
);

router.get(
  '/',
  ...receptionistOnly,
  requireActionAccess('notification-bell', 'bell-view'),
  getReceptionistNotifications,
);
router.put(
  '/:id/read',
  ...receptionistOnly,
  requireActionAccess('notification-bell', 'bell-view'),
  requireActionAccess('notification-bell', 'mark-read'),
  markReceptionistNotificationRead,
);

export default router;