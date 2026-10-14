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
import { requireActionAccess } from '../middlewares/permission.middleware.js';

const router = express.Router();

// Literal sub-paths must be declared before the /:id handlers.
router.get('/unread-count', protect, requireActionAccess('communication', 'notifications-view'), getUnreadCount);
router.put('/read-all', protect, requireActionAccess('communication', 'notifications-view'), markAllNotificationsRead);
router.post('/delete-selected', protect, requireActionAccess('communication', 'notifications-delete'), validateDeleteSelectedNotifications, deleteSelectedNotifications);

router.get('/', protect, requireActionAccess('communication', 'notifications-view'), validateListNotifications, getNotifications);
router.post('/', protect, requireActionAccess('communication', 'notifications-create'), validateCreateNotification, createNotification);
router.get('/:id', protect, requireActionAccess('communication', 'notifications-view'), validateNotificationId, getNotificationById);
router.put('/:id/read', protect, requireActionAccess('communication', 'notifications-view'), validateNotificationId, markNotificationRead);
router.put('/:id', protect, requireActionAccess('communication', 'notifications-edit'), validateUpdateNotification, updateNotification);
router.delete('/:id', protect, requireActionAccess('communication', 'notifications-delete'), validateNotificationId, deleteNotification);

export default router;