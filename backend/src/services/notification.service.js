import Notification from '../models/notification.model.js';
import { ApiError } from '../utils/apiError.js';
import notificationEngine, {
  inboxFilter,
  mapNotificationForPrincipal,
  resolvePrincipal,
} from './notificationEngine.service.js';
import {
  isValidObjectId,
  SUPPORTED_COMMUNICATION_AUDIENCES,
  assertNoClassNamesForAudience,
  resolveAcademicYear,
} from './communicationTargeting.service.js';
import { NOTIFICATION_SOURCES } from '../constants/notification.constants.js';

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Shape consumed later by the Admin Header Bell (which currently renders
// dummy local state): id, time, read. `read` is computed per administrator.
const mapNotification = (doc, adminId) =>
  mapNotificationForPrincipal(doc, adminId ? { role: 'admin', userId: adminId } : null);

// The admin session's own identity is the only thing that decides which
// notifications it may see or change. `protect` + `authorize('admin')` have
// already authenticated `req.user`, so the principal is resolved straight from
// that document — no id or role supplied by the client is ever consulted — and
// every read, mark-read and delete below is bounded by the very same
// `inboxFilter` the portal inboxes use. An admin therefore reaches exactly the
// notifications addressed to them plus the recipient-less manual broadcasts, and
// never a notification owned by a Student or a Teacher, nor another admin's copy
// of the same event.
const ownedScope = (adminId) => {
  const principal = adminId ? resolvePrincipal({ _id: adminId }) : null;
  if (!principal) throw new ApiError(401, 'Not authorized');
  return inboxFilter(principal);
};

const createNotification = async (data, userId) => {
  // Manual admin-authored notifications from the Admin Notifications page.
  // Routed through the central Notification Engine so manual and automatic
  // notifications share one write path (validation, targeting, timestamps)
  // while this service keeps its existing contract: a Notification document.
  const { notification } = await notificationEngine.createNotification({
    title: data?.title,
    message: data?.message,
    audience: data?.audience || 'All',
    classNames: data?.classNames || [],
    academicYear: data?.academicYear,
    actor: userId,
    dedupe: false,
    source: NOTIFICATION_SOURCES.MANUAL,
  });
  return notification;
};

const getNotifications = async (filters = {}, adminId) => {
  const { audience, search, unreadOnly, page = 1, limit = 10 } = filters;

  // Ownership travels in `$and` so the audience / unread / search clauses below
  // can be added freely without ever overwriting it.
  const filter = { $and: [ownedScope(adminId)] };
  if (audience && audience !== 'All') {
    if (!SUPPORTED_COMMUNICATION_AUDIENCES.includes(audience)) {
      throw new ApiError(400, `Invalid audience filter. Allowed: ${SUPPORTED_COMMUNICATION_AUDIENCES.join(', ')}`);
    }
    filter.audience = audience;
  }
  if (unreadOnly === true || unreadOnly === 'true' || unreadOnly === '1') {
    filter.readBy = { $ne: adminId };
  }
  if (search && String(search).trim()) {
    const term = String(search).trim();
    filter.$or = [
      { title: { $regex: escapeRegex(term), $options: 'i' } },
      { message: { $regex: escapeRegex(term), $options: 'i' } },
    ];
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [rows, totalItems] = await Promise.all([
    Notification.find(filter)
      .populate({ path: 'createdBy', select: 'fullName' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications: rows.map((row) => mapNotification(row, adminId)),
    pagination: { currentPage, totalPages: Math.ceil(totalItems / itemsPerPage), totalItems },
  };
};

const getUnreadCount = async (adminId) => {
  const count = await Notification.countDocuments({
    $and: [ownedScope(adminId)],
    readBy: { $ne: adminId },
  });
  return { count };
};

const getNotificationById = async (id, adminId) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid notification ID is required');
  const notification = await Notification.findOne({ _id: id, ...ownedScope(adminId) })
    .populate({ path: 'createdBy', select: 'fullName' })
    .lean();
  if (!notification) throw new ApiError(404, 'Notification not found');
  return mapNotification(notification, adminId);
};

const updateNotification = async (id, data, adminId) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid notification ID is required');

  const existing = await Notification.findOne({ _id: id, ...ownedScope(adminId) });
  if (!existing) throw new ApiError(404, 'Notification not found');

  const update = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.message !== undefined) update.message = data.message;
  if (data.audience !== undefined) update.audience = data.audience;
  if (data.classNames !== undefined) update.classNames = data.classNames;
  if (data.academicYear !== undefined) update.academicYear = await resolveAcademicYear(data.academicYear);

  assertNoClassNamesForAudience(
    data.audience !== undefined ? data.audience : existing.audience,
    data.classNames !== undefined ? data.classNames : existing.classNames,
  );

  try {
    const notification = await Notification.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate({ path: 'createdBy', select: 'fullName' })
      .lean();
    return notification;
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const markNotificationRead = async (id, adminId) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid notification ID is required');

  const notification = await Notification.findOneAndUpdate(
    { _id: id, ...ownedScope(adminId) },
    { $addToSet: { readBy: adminId } },
    { new: true },
  );
  if (!notification) throw new ApiError(404, 'Notification not found');

  return mapNotification(notification.toObject(), adminId);
};

const markAllNotificationsRead = async (adminId) => {
  const result = await Notification.updateMany(
    { ...ownedScope(adminId), readBy: { $ne: adminId } },
    { $addToSet: { readBy: adminId } },
  );
  return { updatedCount: result.modifiedCount };
};

const deleteNotification = async (id, adminId) => {
  if (!isValidObjectId(id)) throw new ApiError(400, 'Valid notification ID is required');
  // Scoped to this admin's own inbox, so removing an admin notification can never
  // reach the record a Teacher or a Student holds for the same event.
  const notification = await Notification.findOneAndDelete({ _id: id, ...ownedScope(adminId) });
  if (!notification) throw new ApiError(404, 'Notification not found');
  return notification;
};

// Bell "Manage / Delete Selected".
// Scoped exactly like the single delete: the ids are first resolved against the
// admin's own inbox, so an id belonging to a Student, a Teacher or another admin
// is reported back instead of being removed. That keeps a bulk delete from being
// used to probe for or destroy somebody else's notifications, and it reports how
// many were really removed so the caller can refresh its unread count honestly.
const deleteManyNotifications = async (ids, adminId) => {
  const objectIds = (Array.isArray(ids) ? ids : []).filter((id) => isValidObjectId(id));
  if (!objectIds.length) return { deletedCount: 0, notFoundIds: [] };

  const scope = ownedScope(adminId);
  const existing = await Notification.find({ _id: { $in: objectIds }, ...scope }).select('_id').lean();
  const existingIds = existing.map((doc) => String(doc._id));
  const notFoundIds = objectIds.filter((id) => !existingIds.includes(String(id))).map(String);

  if (!existingIds.length) return { deletedCount: 0, notFoundIds };

  const result = await Notification.deleteMany({ _id: { $in: existingIds }, ...scope });
  return { deletedCount: result.deletedCount, notFoundIds };
};

export default {
  createNotification,
  getNotifications,
  getUnreadCount,
  getNotificationById,
  updateNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteManyNotifications,
};