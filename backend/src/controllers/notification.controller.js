import { asyncHandler } from '../utils/asyncHandler.js';
import notificationService from '../services/notification.service.js';

const createNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.createNotification(req.body, req.user?._id);
  return res.status(201).json({
    success: true,
    message: 'Notification created successfully',
    data: { notification },
  });
});

const getNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.getNotifications(req.query, req.user?._id);
  return res.status(200).json({
    success: true,
    message: 'Notifications fetched successfully',
    data: result,
  });
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await notificationService.getUnreadCount(req.user?._id);
  return res.status(200).json({
    success: true,
    message: 'Unread notification count fetched successfully',
    data: { count: result.count },
  });
});

const getNotificationById = asyncHandler(async (req, res) => {
  const notification = await notificationService.getNotificationById(req.params.id, req.user?._id);
  return res.status(200).json({
    success: true,
    message: 'Notification fetched successfully',
    data: { notification },
  });
});

const updateNotification = asyncHandler(async (req, res) => {
  const notification = await notificationService.updateNotification(req.params.id, req.body, req.user?._id);
  return res.status(200).json({
    success: true,
    message: 'Notification updated successfully',
    data: { notification },
  });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationRead(req.params.id, req.user?._id);
  return res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: { notification },
  });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllNotificationsRead(req.user?._id);
  return res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
    data: { updatedCount: result.updatedCount },
  });
});

// `req.user` is the authenticated admin. It is the only ownership input the
// service receives — no recipient id from the body or the URL is trusted — so
// this removes a notification from this admin's own inbox and nothing else.
const deleteNotification = asyncHandler(async (req, res) => {
  await notificationService.deleteNotification(req.params.id, req.user?._id);
  return res.status(200).json({
    success: true,
    message: 'Notification deleted successfully',
  });
});

const deleteSelectedNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.deleteManyNotifications(req.body?.ids, req.user?._id);
  return res.status(200).json({
    success: true,
    message: 'Notifications deleted successfully',
    data: result,
  });
});

export {
  createNotification,
  getNotifications,
  getUnreadCount,
  getNotificationById,
  updateNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteSelectedNotifications,
};