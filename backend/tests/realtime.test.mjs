import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

// Ensure the token secret is deterministic before any call (auth.js reads it at
// call time, not import time, so static imports below are safe).
process.env.JWT_SECRET = 'realtime-test-secret';

const { userRoom, roleRoom, receptionistCategoryRoom, buildPrincipalRooms } = await import(
  '../src/realtime/rooms.js'
);
const {
  REALTIME_EVENTS,
  serializeNotification,
  emitToUser,
  emitToRole,
  emitNotificationCreated,
  emitNoticeChanged,
  emitLeaveChanged,
} = await import('../src/realtime/emitters.js');
const { getIO, setIO, clearIO } = await import('../src/realtime/io.js');
const { verifyToken, extractToken, resolveReceptionistCategories, socketAuthMiddleware } = await import(
  '../src/realtime/auth.js'
);

const unauthorized = (error) => error?.data?.code === 'unauthorized';

// ── Rooms ────────────────────────────────────────────────────────────────────

test('room names are namespaced by role and id', () => {
  assert.equal(userRoom('student', 'S1'), 'user:student:S1');
  assert.equal(userRoom('admin', 'A1'), 'user:admin:A1');
  assert.equal(roleRoom('teacher'), 'role:teacher');
  assert.equal(receptionistCategoryRoom('Student Leave'), 'receptionist:cat:Student Leave');
});

test('a principal only joins rooms derived from its own identity', () => {
  assert.deepEqual(buildPrincipalRooms(null), []);

  assert.deepEqual(buildPrincipalRooms({ role: 'student', userId: 'S1' }), [
    'user:student:S1',
    'role:student',
  ]);

  const receptionist = buildPrincipalRooms({
    role: 'receptionist',
    userId: 'R1',
    categories: ['General', 'Student Leave'],
  });
  assert.deepEqual(receptionist, [
    'user:receptionist:R1',
    'role:receptionist',
    'receptionist:cat:General',
    'receptionist:cat:Student Leave',
  ]);

  // A student never receives a receptionist category room.
  assert.ok(!buildPrincipalRooms({ role: 'student', userId: 'S1' }).some((r) => r.startsWith('receptionist:cat')));
});

// ── Serialization ────────────────────────────────────────────────────────────

test('serialized notifications never expose read state', () => {
  const serialized = serializeNotification({
    _id: 'n1',
    title: 'T',
    message: 'M',
    readBy: ['someone-else'],
    recipient: { role: 'student', user: 'S1' },
  });
  assert.equal(serialized.id, 'n1');
  assert.equal(serialized.content, 'M');
  assert.ok(!('readBy' in serialized));
  assert.equal(serializeNotification(null), null);
});

// ── Emitters (isolation + no-op) ─────────────────────────────────────────────

test('emitters are safe no-ops without an initialised socket server', () => {
  clearIO();
  assert.equal(getIO(), null);
  assert.equal(emitToUser('student', 'S1', 'x', {}), false);
  assert.equal(emitToRole('admin', 'x', {}), false);
  assert.equal(emitNotificationCreated({ target: { role: 'student', user: 'S1' }, doc: { _id: 'n1' } }), false);
});

test('targeted emits only reach the recipient room', () => {  const calls = [];
  setIO({ to: (room) => ({ emit: (event, payload) => calls.push({ room, event, payload }) }) });
  try {
    emitNotificationCreated({
      target: { role: 'student', user: 'S1' },
      doc: { _id: 'n1', title: 'T', message: 'M' },
      unreadCount: 3,
    });
  } finally {
    clearIO();
  }

  const rooms = calls.map((c) => c.room);
  assert.deepEqual(rooms, ['user:student:S1', 'user:student:S1']);
  assert.equal(calls[0].event, REALTIME_EVENTS.NOTIFICATION_NEW);
  assert.equal(calls[1].event, REALTIME_EVENTS.NOTIFICATION_UNREAD_COUNT);
  assert.equal(calls[1].payload.count, 3);
  // No other principal's room is ever addressed.
  assert.ok(calls.every((c) => c.room === 'user:student:S1'));
});

test('recipient-less broadcasts are scoped to the admin room only', () => {
  const calls = [];
  setIO({ to: (room) => ({ emit: (event, payload) => calls.push({ room, event, payload }) }) });
  try {
    emitNotificationCreated({ target: null, doc: { _id: 'b1', title: 'T', message: 'M' } });
  } finally {
    clearIO();
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].room, 'role:admin');
  assert.equal(calls[0].event, REALTIME_EVENTS.NOTIFICATION_NEW);
});

// ── Token verification ───────────────────────────────────────────────────────

test('handshake token extraction supports auth, header and query', () => {
  assert.equal(extractToken({ handshake: { auth: { token: ' a ' } } }), 'a');
  assert.equal(extractToken({ handshake: { headers: { authorization: 'Bearer b' } } }), 'b');
  assert.equal(extractToken({ handshake: { query: { token: 'c' } } }), 'c');
  assert.equal(extractToken({ handshake: {} }), null);
});

test('invalid and expired tokens are rejected; valid tokens pass', () => {
  assert.throws(() => verifyToken(null), unauthorized);
  assert.throws(() => verifyToken('not-a-jwt'), (e) => unauthorized(e) && e.message === 'Invalid token');
  assert.throws(
    () => verifyToken(jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: -10 })),
    (e) => unauthorized(e) && e.message === 'Token expired',
  );

  const decoded = verifyToken(jwt.sign({ id: 'u1', role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1h' }));
  assert.equal(decoded.id, 'u1');
});

test('a token signed with the wrong secret is rejected', () => {
  const forged = jwt.sign({ id: 'u1', role: 'admin' }, 'a-different-secret');
  assert.throws(() => verifyToken(forged), (e) => unauthorized(e) && e.message === 'Invalid token');
});

// ── Receptionist category permissions ────────────────────────────────────────

test('receptionist categories follow the stored bell permissions', () => {
  assert.deepEqual(resolveReceptionistCategories([]), []);
  assert.deepEqual(
    resolveReceptionistCategories(['action:notification-bell:student-leave']),
    ['Student Leave'],
  );
  assert.deepEqual(
    resolveReceptionistCategories(['action:notification-bell:other']),
    ['General'],
  );
  assert.deepEqual(resolveReceptionistCategories(['module:notification-bell']), [
    'General',
    'Student Leave',
    'Teacher Leave',
  ]);
});

// ── Handshake middleware + lifecycle ─────────────────────────────────────────

test('handshake middleware rejects missing and invalid tokens before any DB lookup', async () => {
  const run = (socket) => new Promise((resolve) => socketAuthMiddleware(socket, resolve));

  const missing = await run({ handshake: { auth: {} }, data: {} });
  assert.ok(missing instanceof Error);
  assert.equal(missing.data.code, 'unauthorized');

  const invalid = await run({ handshake: { auth: { token: 'not-a-jwt' } }, data: {} });
  assert.ok(invalid instanceof Error);
  assert.equal(invalid.data.code, 'unauthorized');
  assert.equal(invalid.message, 'Invalid token');

  const forged = await run({
    handshake: { auth: { token: jwt.sign({ id: 'x' }, 'wrong-secret') } },
    data: {},
  });
  assert.ok(forged instanceof Error);
  assert.equal(forged.data.code, 'unauthorized');
});

test('initRealtime attaches to the HTTP server and closes cleanly', async () => {
  const http = await import('node:http');
  const { initRealtime, closeRealtime } = await import('../src/realtime/index.js');

  const server = http.createServer((_req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, resolve));

  const io = initRealtime(server);
  assert.ok(io);
  assert.equal(getIO(), io);

  await closeRealtime();
  assert.equal(getIO(), null);

  await new Promise((resolve) => {
    try {
      server.close(() => resolve());
    } catch {
      resolve();
    }
  });
});

// ── Notice / Leave change signals ────────────────────────────────────────────

test('notice/leave change emitters are safe no-ops without a socket server', () => {
  clearIO();
  assert.equal(emitNoticeChanged({ change: 'created', audience: 'All' }), false);
  assert.equal(emitLeaveChanged({ change: 'created', type: 'Student' }), false);
});

test('a Students notice change reaches admins plus the student role only', () => {
  const calls = [];
  setIO({ to: (room) => ({ emit: (event, payload) => calls.push({ room, event, payload }) }) });
  try {
    emitNoticeChanged({ change: 'created', id: 'n1', audience: 'Students', status: 'Published' });
  } finally {
    clearIO();
  }
  assert.deepEqual(calls.map((c) => c.room).sort(), ['role:admin', 'role:student']);
  assert.ok(calls.every((c) => c.event === REALTIME_EVENTS.NOTICE_CHANGED));
  // Signal only: metadata, never the notice title/message.
  assert.deepEqual(calls[0].payload, {
    change: 'created',
    id: 'n1',
    audience: 'Students',
    status: 'Published',
    academicYear: null,
  });
});

test('an All notice change reaches students and teachers, and legacy audiences only admins', () => {
  const calls = [];
  setIO({ to: (room) => ({ emit: (event, payload) => calls.push({ room, event, payload }) }) });
  try {
    emitNoticeChanged({ change: 'updated', audience: 'All' });
    emitNoticeChanged({ change: 'deleted', audience: 'Parents' });
  } finally {
    clearIO();
  }
  assert.deepEqual(calls.map((c) => c.room), [
    'role:admin',
    'role:student',
    'role:teacher',
    'role:admin',
  ]);
});

test('a leave change reaches admins and only the matching receptionist category', () => {
  const calls = [];
  setIO({ to: (room) => ({ emit: (event, payload) => calls.push({ room, event, payload }) }) });
  try {
    emitLeaveChanged({ change: 'created', id: 'l1', type: 'Student', status: 'Pending' });
    emitLeaveChanged({ change: 'updated', id: 'l2', type: 'Teacher', status: 'Approved' });
  } finally {
    clearIO();
  }
  assert.deepEqual(calls.map((c) => c.room), [
    'role:admin',
    'receptionist:cat:Student Leave',
    'role:admin',
    'receptionist:cat:Teacher Leave',
  ]);
  assert.ok(calls.every((c) => c.event === REALTIME_EVENTS.LEAVE_CHANGED));
  // Never addressed to a user room: a leave signal cannot leak to another user.
  assert.ok(calls.every((c) => !c.room.startsWith('user:')));
});
