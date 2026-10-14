import { NOTIFICATION_RECIPIENT_ROLES } from '../constants/notification.constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO room vocabulary.
//
// Rooms are derived exclusively from server-side data. A client never supplies
// a room name, a role or a user id — the authenticated principal produced by
// ./auth.js is the only input, so membership can never be widened by a payload.
//
//   user:<role>:<userId>   exactly one principal (targeted delivery)
//   role:<role>            every connected principal of one role (broadcasts)
//   receptionist:cat:<c>   receptionists whose stored bell permission unlocks
//                          notification category <c> (defence in depth)
// ─────────────────────────────────────────────────────────────────────────────

const USER_ROOM_PREFIX = 'user';
const ROLE_ROOM_PREFIX = 'role';
const RECEPTIONIST_CATEGORY_PREFIX = 'receptionist:cat';

const normalizeId = (value) => (value === undefined || value === null ? '' : String(value));

// Room for a single principal. `role` + the engine's `recipient.user` id are
// the same pair the Notification Engine stores, so a targeted notification and
// its room always agree.
const userRoom = (role, userId) => `${USER_ROOM_PREFIX}:${normalizeId(role)}:${normalizeId(userId)}`;

// Room for every connected principal of one role. Used only for notifications
// that are legitimately role-wide (e.g. a recipient-less admin broadcast).
const roleRoom = (role) => `${ROLE_ROOM_PREFIX}:${normalizeId(role)}`;

// Room for receptionists granted one notification-bell category.
const receptionistCategoryRoom = (category) =>
  `${RECEPTIONIST_CATEGORY_PREFIX}:${normalizeId(category)}`;

// Every room an authenticated principal may join. Built from trusted data only.
const buildPrincipalRooms = (principal) => {
  if (!principal || !principal.role || principal.userId === undefined || principal.userId === null) {
    return [];
  }

  const rooms = [userRoom(principal.role, principal.userId), roleRoom(principal.role)];

  if (principal.role === NOTIFICATION_RECIPIENT_ROLES.RECEPTIONIST && Array.isArray(principal.categories)) {
    for (const category of principal.categories) {
      rooms.push(receptionistCategoryRoom(category));
    }
  }

  return rooms;
};

export {
  USER_ROOM_PREFIX,
  ROLE_ROOM_PREFIX,
  RECEPTIONIST_CATEGORY_PREFIX,
  userRoom,
  roleRoom,
  receptionistCategoryRoom,
  buildPrincipalRooms,
};

export default {
  userRoom,
  roleRoom,
  receptionistCategoryRoom,
  buildPrincipalRooms,
};
