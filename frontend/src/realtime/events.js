// Socket.IO event vocabulary.
//
// These strings mirror the backend `backend/src/realtime/emitters.js`
// `REALTIME_EVENTS` exactly. The client never invents an event name: every
// listener here corresponds to an emitter that already exists on the server, so
// a rename on either side is a single, visible change instead of a silent dead
// listener.

export const REALTIME_EVENTS = {
  // Server -> client: the handshake succeeded and the server reports the
  // principal it derived from the token. The client uses this role only to pick
  // which *UI* service to refresh - never for authorization, which stays
  // server-side.
  READY: 'realtime:ready',
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  NOTIFICATION_ALL_READ: 'notification:all-read',
  NOTIFICATION_DELETED: 'notification:deleted',
  NOTIFICATION_UNREAD_COUNT: 'notification:unread-count',
  // Signal-only notice/leave refresh hints. They carry no private content; the
  // receiving portal re-reads the data through the existing authorized REST
  // endpoints, which enforce audience/permission scoping server-side.
  NOTICE_CHANGED: 'notice:changed',
  LEAVE_CHANGED: 'leave:changed',
};

// Application-level bus events. The RealtimeProvider translates a socket event
// into these so page components can subscribe to a plain, framework-level
// signal without knowing anything about Socket.IO.
export const REALTIME_BUS_EVENTS = {
  NOTIFICATIONS_CHANGED: 'realtime:notifications-changed',
  NOTICES_CHANGED: 'realtime:notices-changed',
  LEAVES_CHANGED: 'realtime:leaves-changed',
  // Emitted right after a (re)connect so pages can resynchronise from REST.
  RESYNC: 'realtime:resync',
};
