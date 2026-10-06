import express from 'express';
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  getNotificationById,
  updateNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteSelectedNotifications,
} from '../controllers/notification.controller.js';
import {
  validateCreateNotification,
  validateUpdateNotification,
  validateListNotifications,
  validateNotificationId,
  validateDeleteSelectedNotifications,
} from '../validations/notification.validation.js';
import { protect } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Literal sub-paths must be declared before the /:id handlers.
router.get('/unread-count', protect, authorize('admin'), getUnreadCount);
router.put('/read-all', protect, authorize('admin'), markAllNotificationsRead);
router.post('/delete-selected', protect, authorize('admin'), validateDeleteSelectedNotifications, deleteSelectedNotifications);

router.get('/', protect, authorize('admin'), validateListNotifications, getNotifications);
router.post('/', protect, authorize('admin'), validateCreateNotification, createNotification);
router.get('/:id', protect, authorize('admin'), validateNotificationId, getNotificationById);
router.put('/:id/read', protect, authorize('admin'), validateNotificationId, markNotificationRead);
router.put('/:id', protect, authorize('admin'), validateUpdateNotification, updateNotification);
router.delete('/:id', protect, authorize('admin'), validateNotificationId, deleteNotification);

export default router;