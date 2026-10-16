// Focused tests for the Notification Bell deep-link resolver.
//
// The fee features reuse this resolver rather than hard-coding a URL in a
// component, so this pins where a fee notification takes each reader: an Admin
// to the class-wise Fee Reminders page, a student to their own portal page, and
// a teacher (who is never a fee recipient) to their own inbox rather than a
// dead link. The resolver is a pure function of (scope, type, related id), so it
// runs under the project's existing `node --test` setup with no DOM.

import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveNotificationLink, notificationFallbackPath, NOTIFICATION_LINK_SCOPES } =
  await import('../src/utils/notificationDeepLink.js');

const notification = (type, id) => ({
  type,
  relatedEntity: id ? { id } : undefined,
});

test('an Admin fee reminder opens the class-wise Fee Reminders page', () => {
  assert.equal(
    resolveNotificationLink(notification('FEE_REMINDER'), NOTIFICATION_LINK_SCOPES.ADMIN),
    '/admin/fees/reminders',
  );
});

test('an Admin payment confirmation opens Fee Collection', () => {
  assert.equal(
    resolveNotificationLink(notification('FEE_COLLECTED'), NOTIFICATION_LINK_SCOPES.ADMIN),
    '/admin/fees/collect-fee',
  );
});

test('a student fee reminder opens the student portal reminders inbox', () => {
  assert.equal(
    resolveNotificationLink(notification('FEE_REMINDER'), NOTIFICATION_LINK_SCOPES.STUDENT),
    '/student/dashboard/fee-reminders',
  );
});

test('an admin-run Portal Access reminder stays inside the portal namespace', () => {
  const resolved = resolveNotificationLink(
    notification('FEE_REMINDER'),
    NOTIFICATION_LINK_SCOPES.PORTAL_ACCESS,
  );
  assert.equal(resolved, '/portal/access/fee-reminders');
  // A portal-access reader must never be sent into the Admin namespace.
  assert.doesNotMatch(resolved, /^\/admin/);
});

test('a teacher never receives a fee link - they fall back to their own inbox', () => {
  for (const type of ['FEE_REMINDER', 'FEE_COLLECTED']) {
    assert.equal(
      resolveNotificationLink(notification(type), NOTIFICATION_LINK_SCOPES.TEACHER),
      notificationFallbackPath(NOTIFICATION_LINK_SCOPES.TEACHER),
    );
  }
});

test('an unknown notification type always falls back to the reader inbox', () => {
  for (const scope of Object.values(NOTIFICATION_LINK_SCOPES)) {
    assert.equal(
      resolveNotificationLink(notification('SOMETHING_UNKNOWN'), scope),
      notificationFallbackPath(scope),
    );
  }
});

test('a malformed related id can never break a fee-collected link', () => {
  assert.equal(
    resolveNotificationLink(notification('FEE_COLLECTED', 'not-an-object-id'), NOTIFICATION_LINK_SCOPES.STUDENT),
    '/student/dashboard/fees',
  );
});
