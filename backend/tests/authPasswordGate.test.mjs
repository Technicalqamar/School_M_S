// Focused tests for the forced password-change gate in the `protect` middleware.
//
// Portal accounts created with a temporary password (`mustChangePassword: true`)
// may only reach the identity, logout, and password-change endpoints until they
// change it. The gate previously matched the raw `req.originalUrl` with a
// substring test, so appending `?x=/auth/me` to any URL bypassed it. These tests
// pin the hardened contract: exact, path-only matching, query-string agnostic.
//
// The middleware is imported directly (no DB connection); only the pure
// decision function is exercised.

import test from 'node:test';
import assert from 'node:assert/strict';

const { isPasswordChangePending } = await import('../src/middlewares/auth.middleware.js');

// Minimal fake `req` carrying only the fields the decision reads.
const req = (overrides = {}) => ({
  user: { role: 'student', mustChangePassword: true },
  accessType: null,
  originalUrl: '/api/v1/students',
  ...overrides,
});

test('a temporary-password account is blocked from normal endpoints', () => {
  assert.equal(isPasswordChangePending(req({ originalUrl: '/api/v1/students' })), true);
  assert.equal(isPasswordChangePending(req({ originalUrl: '/api/v1/student/dashboard' })), true);
  assert.equal(isPasswordChangePending(req({ originalUrl: '/api/v1/school-settings' })), true);
});

test('the identity, logout, and change-password endpoints stay reachable', () => {
  assert.equal(isPasswordChangePending(req({ originalUrl: '/api/v1/auth/me' })), false);
  assert.equal(isPasswordChangePending(req({ originalUrl: '/api/v1/auth/logout' })), false);
  assert.equal(
    isPasswordChangePending(req({ originalUrl: '/api/v1/profile/change-password' })),
    false,
  );
});

test('query strings never bypass the gate', () => {
  // The regression: a substring match on originalUrl matched `?x=/auth/me`.
  assert.equal(
    isPasswordChangePending(req({ originalUrl: '/api/v1/students?x=/auth/me' })),
    true,
  );
  assert.equal(
    isPasswordChangePending(req({ originalUrl: '/api/v1/student/dashboard?redirect=/auth/me' })),
    true,
  );
  assert.equal(
    isPasswordChangePending(req({ originalUrl: '/api/v1/students?x=/profile/change-password' })),
    true,
  );
  assert.equal(
    isPasswordChangePending(req({ originalUrl: '/api/v1/students?x=/auth/logout' })),
    true,
  );
  // A query string on a genuinely permitted endpoint is still permitted.
  assert.equal(
    isPasswordChangePending(req({ originalUrl: '/api/v1/auth/me?next=/students' })),
    false,
  );
});

test('only the exact allow-listed paths are permitted', () => {
  // A path that merely *starts with* an allow-listed fragment must be blocked.
  assert.equal(isPasswordChangePending(req({ originalUrl: '/api/v1/auth/me-extra' })), true);
  assert.equal(isPasswordChangePending(req({ originalUrl: '/api/v1/auth/logout/all' })), true);
  assert.equal(
    isPasswordChangePending(req({ originalUrl: '/api/v1/profile/change-password/extra' })),
    true,
  );
  // A single trailing slash is normalised and still permitted.
  assert.equal(isPasswordChangePending(req({ originalUrl: '/api/v1/auth/me/' })), false);
});

test('the flag only applies to temporary-password portal accounts', () => {
  assert.equal(isPasswordChangePending(req({ user: { role: 'student' } })), false);
  assert.equal(isPasswordChangePending(req({ user: { mustChangePassword: false } })), false);
  // Admin-authorized portal-access tokens bypass the gate entirely.
  assert.equal(
    isPasswordChangePending(req({ accessType: 'admin_portal_access' })),
    false,
  );
  // No authenticated user at all.
  assert.equal(isPasswordChangePending({ originalUrl: '/api/v1/students' }), false);
});
