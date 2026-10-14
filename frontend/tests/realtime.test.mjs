import test from 'node:test';
import assert from 'node:assert/strict';

// Frontend realtime tests run on Node's built-in test runner (no extra
// dependency, no bundler): the modules under test are pure ES modules with no
// React, DOM or `import.meta.env` usage. The React provider/hook themselves are
// exercised through the production build + lint, not here.

const { REALTIME_EVENTS, REALTIME_BUS_EVENTS } = await import('../src/realtime/events.js');
const { subscribeRealtime, publishRealtime } = await import('../src/realtime/realtimeBus.js');
const {
  notificationServiceKeyForRole,
  noticeServiceKeyForRole,
  isLeaveStatusNotification,
} = await import('../src/realtime/routing.js');

test('event names mirror the backend contract exactly', () => {
  assert.deepEqual(REALTIME_EVENTS, {
    READY: 'realtime:ready',
    NOTIFICATION_NEW: 'notification:new',
    NOTIFICATION_READ: 'notification:read',
    NOTIFICATION_ALL_READ: 'notification:all-read',
    NOTIFICATION_DELETED: 'notification:deleted',
    NOTIFICATION_UNREAD_COUNT: 'notification:unread-count',
    NOTICE_CHANGED: 'notice:changed',
    LEAVE_CHANGED: 'leave:changed',
  });
  assert.deepEqual(Object.keys(REALTIME_BUS_EVENTS).sort(), [
    'LEAVES_CHANGED',
    'NOTICES_CHANGED',
    'NOTIFICATIONS_CHANGED',
    'RESYNC',
  ]);
});

test('the bus delivers to subscribers and stops after unsubscribe', () => {
  const seen = [];
  const off = subscribeRealtime('bus:basic', (payload) => seen.push(payload));
  publishRealtime('bus:basic', 1);
  publishRealtime('bus:basic', 2);
  off();
  publishRealtime('bus:basic', 3);
  assert.deepEqual(seen, [1, 2]);
});

test('a throwing subscriber never breaks the others', () => {
  const seen = [];
  const offBad = subscribeRealtime('bus:throwing', () => {
    throw new Error('boom');
  });
  const offGood = subscribeRealtime('bus:throwing', (payload) => seen.push(payload));
  assert.doesNotThrow(() => publishRealtime('bus:throwing', 'ok'));
  offBad();
  offGood();
  assert.deepEqual(seen, ['ok']);
});

test('publishing with no subscribers is a safe no-op', () => {
  assert.doesNotThrow(() => publishRealtime('bus:nobody', { any: true }));
});

test('notifications route only to a known principal role', () => {
  assert.equal(notificationServiceKeyForRole('admin'), 'admin');
  assert.equal(notificationServiceKeyForRole('student'), 'student');
  assert.equal(notificationServiceKeyForRole('teacher'), 'teacher');
  assert.equal(notificationServiceKeyForRole('receptionist'), 'receptionist');
  // Never guess: an unknown or not-yet-ready role refreshes nothing.
  assert.equal(notificationServiceKeyForRole(null), null);
  assert.equal(notificationServiceKeyForRole('principal'), null);
});

test('students/teachers get their own notice board; admin+receptionist share the admin screen', () => {
  assert.equal(noticeServiceKeyForRole('student'), 'student');
  assert.equal(noticeServiceKeyForRole('teacher'), 'teacher');
  assert.equal(noticeServiceKeyForRole('admin'), 'admin');
  assert.equal(noticeServiceKeyForRole('receptionist'), 'admin');
  assert.equal(noticeServiceKeyForRole(null), 'admin');
});

test('only leave decision notifications refresh a portal leave list', () => {
  assert.equal(isLeaveStatusNotification('LEAVE_APPROVED'), true);
  assert.equal(isLeaveStatusNotification('LEAVE_REJECTED'), true);
  // The requester's own submission already updated their UI optimistically.
  assert.equal(isLeaveStatusNotification('LEAVE_REQUESTED'), false);
  assert.equal(isLeaveStatusNotification(undefined), false);
});
