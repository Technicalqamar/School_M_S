import { Server } from 'socket.io';

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO server singleton.
//
// The instance is created once, attached to the existing HTTP server, and kept
// in this module. Every emitter reads it through `getIO()`, which returns null
// until `initRealtime()` has run and after shutdown — so REST-only deployments
// (or a process that never calls init) keep working untouched.
// ─────────────────────────────────────────────────────────────────────────────

let io = null;

const getIO = () => io;

const setIO = (instance) => {
  io = instance;
  return io;
};

const clearIO = () => {
  io = null;
};

// Same origin policy the Express CORS layer uses (app.js), so the socket
// handshake accepts exactly the frontend the REST API already trusts. No new
// environment value is introduced.
const resolveCorsOrigin = () =>
  process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

const createIO = (httpServer) => {
  const instance = new Server(httpServer, {
    cors: {
      origin: resolveCorsOrigin(),
      credentials: true,
    },
    // Default path (/socket.io) and transports are kept so the documented
    // frontend contract holds without extra configuration.
  });
  return instance;
};

export { getIO, setIO, clearIO, createIO, resolveCorsOrigin };

export default { getIO, setIO, clearIO, createIO, resolveCorsOrigin };
