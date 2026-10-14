// Pure routing rules for the realtime fan-out.
//
// Kept free of React, the socket and the portal services so the audience rules
// - the part where a mistake would leak one portal's refresh into another - can
// be unit tested directly.
//
// The role passed here is the one the SERVER reports on the authorized
// handshake (`realtime:ready`), never a client-supplied value and never the
// AuthContext role (an admin-authorized Student Portal session resolves to
// `student` on the wire while `useAuth().role` is still `admin`).

const LEAVE_NOTIFICATION_TYPES = new Set(['LEAVE_APPROVED', 'LEAVE_REJECTED']);

// Which notifications service a principal's `notification:*` events belong to.
// Unknown/not-yet-ready roles resolve to null so nothing is refreshed with a
// guess.
export const notificationServiceKeyForRole = (role) => {
  if (role === 'admin') return 'admin';
  if (role === 'student') return 'student';
  if (role === 'teacher') return 'teacher';
  if (role === 'receptionist') return 'receptionist';
  return null;
};

// Students and Teachers read their own notice board; admins and receptionists
// share the admin Notices screen.
export const noticeServiceKeyForRole = (role) => {
  if (role === 'student') return 'student';
  if (role === 'teacher') return 'teacher';
  return 'admin';
};

// A leave decision reaches the requester as a notification of one of these
// types; the portal leave list is refreshed off the same signal rather than a
// second server event.
export const isLeaveStatusNotification = (type) => LEAVE_NOTIFICATION_TYPES.has(type);

export default {
  notificationServiceKeyForRole,
  noticeServiceKeyForRole,
  isLeaveStatusNotification,
};
