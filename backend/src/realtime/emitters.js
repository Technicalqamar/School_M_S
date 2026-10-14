import { getIO } from './io.js';
import { userRoom, roleRoom, receptionistCategoryRoom } from './rooms.js';
import {
  NOTIFICATION_RECIPIENT_ROLES,
  NOTIFICATION_CATEGORIES,
} from '../constants/notification.constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// Safe emitters.
//
// Every function is a no-op when Socket.IO is not initialised (no socket
// clients / REST-only mode) and never throws into a business operation: a
// delivery failure must never break the HTTP request or the domain write that
// produced the event. Recipients are always addressed by the exact room the
// Notification Engine already resolved, so private payloads are never fanned
// out to every connected client.
// ─────────────────────────────────────────────────────────────────────────────

const REALTIME_EVENTS = {
  READY: 'realtime:ready',
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_ALL_READ: 'notification:all-read',
  NOTIFICATION_DELETED: 'notification:deleted',
  NOTIFICATION_UNREAD_COUNT: 'notification:unread-count',
  // Signal-only change events for Communication → Notices and Leave records.
  // They carry no private content: the receiving portal re-reads data through
  // the existing authorized REST endpoints, which enforce audience/permission
  // scoping server-side.
  NOTICE_CHANGED: 'notice:changed',
  LEAVE_CHANGED: 'leave:changed',
};

const safeEmit = (room, event, payload) => {
  const io = getIO();
  if (!io || !room) return false;
  try {
    io.to(room).emit(event, payload);
    return true;
  } catch (error) {
    console.error(`⚠️  Realtime emit failed (${event}):`, error.message);
    return false;
  }
};

// A wire-safe projection of a notification document. Deliberately excludes the
// per-principal `readBy` array so one recipient's read state is never sent to
// another client.
const serializeNotification = (doc) => {
  if (!doc) return null;
  const source = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const id = source._id !== undefined && source._id !== null
    ? String(source._id)
    : (source.id !== undefined && source.id !== null ? String(source.id) : '');
  if (!id) return null;

  const message = source.message ?? '';
  return {
    id,
    title: source.title ?? '',
    message,
    content: message,
    type: source.type ?? null,
    source: source.source ?? null,
    category: source.category ?? 'General',
    audience: source.audience ?? 'All',
    classNames: Array.isArray(source.classNames) ? source.classNames : [],
    academicYear: source.academicYear ?? null,
    relatedEntity: source.relatedEntity ?? null,
    recipient: source.recipient ?? null,
    createdAt: source.createdAt ?? null,
    time: source.createdAt ?? null,
    read: false,
  };
};

const emitToUser = (role, userId, event, payload) => {
  if (!role || userId === undefined || userId === null) return false;
  return safeEmit(userRoom(role, userId), event, payload);
};

const emitToRole = (role, event, payload) => {
  if (!role) return false;
  return safeEmit(roleRoom(role), event, payload);
};

const emitToReceptionistCategory = (category, event, payload) => {
  if (!category) return false;
  return safeEmit(receptionistCategoryRoom(category), event, payload);
};

// Emits a newly persisted notification to exactly the principal it was written
// for (the engine stores one document per recipient). A recipient-less manual
// admin broadcast is scoped to the admin role room only.
const emitNotificationCreated = ({ target, doc, unreadCount } = {}) => {
  const notification = serializeNotification(doc);
  if (!notification) return false;

  if (target && target.user) {
    const delivered = emitToUser(
      target.role,
      target.user,
      REALTIME_EVENTS.NOTIFICATION_NEW,
      { notification },
    );
    if (Number.isFinite(unreadCount)) {
      emitToUser(
        target.role,
        target.user,
        REALTIME_EVENTS.NOTIFICATION_UNREAD_COUNT,
        { count: unreadCount },
      );
    }
    return delivered;
  }

  // Manual broadcast (no recipient): every admin feed already shows it, so the
  // signal is scoped to admins and never reaches students or teachers.
  return emitToRole(
    NOTIFICATION_RECIPIENT_ROLES.ADMIN,
    REALTIME_EVENTS.NOTIFICATION_NEW,
    { notification },
  );
};

// ── Signal-only change events ────────────────────────────────────────────────
// Notice/Leave changes fan out as room-addressed *signals*, never as data. The
// payload is limited to non-private metadata (an id, the audience/status or the
// leave type) so a class-targeted notice or another user's leave can never leak
// content through a broad role room. Each recipient still re-reads through the
// existing authorized REST surface, which applies audience/permission/ownership
// filters server-side.

// Audience -> the portal role rooms that may see a notice for that audience.
// Legacy `Parents`/`Staff` have no portal and therefore no room.
const NOTICE_AUDIENCE_ROLES = {
  All: [NOTIFICATION_RECIPIENT_ROLES.STUDENT, NOTIFICATION_RECIPIENT_ROLES.TEACHER],
  Students: [NOTIFICATION_RECIPIENT_ROLES.STUDENT],
  Teachers: [NOTIFICATION_RECIPIENT_ROLES.TEACHER],
};

const emitNoticeChanged = ({ change, id, audience, status, academicYear } = {}) => {
  const payload = {
    change: change || 'updated',
    id: id === undefined || id === null ? null : String(id),
    audience: audience || null,
    status: status || null,
    academicYear: academicYear ?? null,
  };

  // Admins (who share the admin Notices screen) always refresh their list.
  let delivered = emitToRole(
    NOTIFICATION_RECIPIENT_ROLES.ADMIN,
    REALTIME_EVENTS.NOTICE_CHANGED,
    payload,
  );

  for (const role of NOTICE_AUDIENCE_ROLES[audience] || []) {
    if (emitToRole(role, REALTIME_EVENTS.NOTICE_CHANGED, payload)) delivered = true;
  }

  return delivered;
};

// A leave's recipient category mirrors the existing receptionist bell category.
const LEAVE_CATEGORY_BY_TYPE = {
  Student: NOTIFICATION_CATEGORIES.STUDENT_LEAVE,
  Teacher: NOTIFICATION_CATEGORIES.TEACHER_LEAVE,
};

// Emits a leave list-change signal to admins and to the permissioned
// receptionist category rooms. The requester's own decision arrives through the
// Notification Engine (LEAVE_APPROVED/LEAVE_REJECTED), so it is not duplicated
// here.
const emitLeaveChanged = ({ change, id, type, status, academicYear } = {}) => {
  const payload = {
    change: change || 'updated',
    id: id === undefined || id === null ? null : String(id),
    type: type || null,
    status: status || null,
    academicYear: academicYear ?? null,
  };

  let delivered = emitToRole(
    NOTIFICATION_RECIPIENT_ROLES.ADMIN,
    REALTIME_EVENTS.LEAVE_CHANGED,
    payload,
  );

  const category = LEAVE_CATEGORY_BY_TYPE[type];
  if (category && emitToReceptionistCategory(category, REALTIME_EVENTS.LEAVE_CHANGED, payload)) {
    delivered = true;
  }

  return delivered;
};

export {
  REALTIME_EVENTS,
  serializeNotification,
  emitToUser,
  emitToRole,
  emitToReceptionistCategory,
  emitNotificationCreated,
  emitNoticeChanged,
  emitLeaveChanged,
};

export default {
  REALTIME_EVENTS,
  serializeNotification,
  emitToUser,
  emitToRole,
  emitToReceptionistCategory,
  emitNotificationCreated,
  emitNoticeChanged,
  emitLeaveChanged,
};
