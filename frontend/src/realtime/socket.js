import { io } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────────────────────
// Shared Socket.IO connection.
//
// One connection exists per browser tab. The origin is derived from the same
// `VITE_API_BASE_URL` the REST client uses, so no deployment URL is ever
// hardcoded: the socket simply talks to the API host without the `/api/v1`
// path prefix.
//
// The token is supplied through a getter, not captured once. Socket.IO invokes
// the `auth` callback at the start of every (re)connect, so a token rotated by
// the axios refresh interceptor, or a Student Portal access token set by the
// portal route, is picked up on the next handshake without a manual rebuild.
// The token itself is only ever placed on the wire; it is never logged.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// Same origin policy as the REST client. Falls back to stripping the API path
// when the configured value is not an absolute URL (e.g. a relative base).
export const resolveSocketUrl = () => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, '').replace(/\/+$/, '');
  }
};

let socket = null;
let tokenProvider = () => null;

// Read at handshake time (and on every reconnect attempt).
export const setSocketTokenProvider = (provider) => {
  tokenProvider = typeof provider === 'function' ? provider : () => null;
};

export const getSocket = () => socket;

export const isSocketConnected = () => Boolean(socket && socket.connected);

// Create the shared client exactly once. `autoConnect: false` means the caller
// decides when to open the connection, so a logged-out tab never dials out.
export const ensureSocket = () => {
  if (socket) return socket;

  socket = io(resolveSocketUrl(), {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: tokenProvider() }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
  });

  return socket;
};

// Tear the shared client down completely. Removing listeners before disconnecting
// guarantees a later remount can never inherit a stale handler, and nulling the
// reference guarantees the next `ensureSocket()` builds a fresh client that
// re-runs the authorized handshake.
export const disconnectSocket = () => {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
};

export default {
  resolveSocketUrl,
  setSocketTokenProvider,
  getSocket,
  isSocketConnected,
  ensureSocket,
  disconnectSocket,
};
