import { createIO, getIO, setIO, clearIO } from './io.js';
import { socketAuthMiddleware } from './auth.js';
import { buildPrincipalRooms } from './rooms.js';
import { REALTIME_EVENTS } from './emitters.js';

// ─────────────────────────────────────────────────────────────────────────────
// Realtime bootstrap.
//
// initRealtime(httpServer) attaches Socket.IO to the existing HTTP server. It
// is fully additive: Express middleware, REST routes and startup behaviour are
// untouched, and when the socket server is absent every emitter stays a no-op.
//
// On connection the authenticated principal (see ./auth.js) joins only the
// rooms derived from its own server-side identity:
//   • user:<role>:<userId> — targeted notifications for this principal;
//   • role:<role>          — role-wide broadcasts;
//   • receptionist:cat:<c> — categories unlocked by the profile's permissions.
// ─────────────────────────────────────────────────────────────────────────────

let initialized = false;

const initRealtime = (httpServer) => {
  if (initialized) return getIO();

  const io = createIO(httpServer);
  setIO(io);

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const principal = socket.data?.principal;
    if (!principal) {
      socket.disconnect(true);
      return;
    }

    const rooms = buildPrincipalRooms(principal);
    for (const room of rooms) socket.join(room);

    socket.emit(REALTIME_EVENTS.READY, {
      role: principal.role,
      profileModel: principal.profileModel,
      rooms,
    });
  });

  initialized = true;
  console.log('🔌 Socket.IO realtime layer initialised');
  return io;
};

// Graceful teardown: closes the Socket.IO server (and its client connections)
// before the HTTP server. Safe to call when realtime was never initialised.
const closeRealtime = () =>
  new Promise((resolve) => {
    const io = getIO();
    if (!io) return resolve();
    try {
      io.close(() => {
        clearIO();
        resolve();
      });
    } catch (error) {
      console.error('⚠️  Error closing Socket.IO:', error.message);
      clearIO();
      resolve();
    }
  });

export { initRealtime, closeRealtime };
export default { initRealtime, closeRealtime };
