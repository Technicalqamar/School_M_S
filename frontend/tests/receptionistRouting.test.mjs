import test from 'node:test';
import assert from 'node:assert/strict';

// Receptionist portal routing tests. These run on Node's built-in test runner
// (no extra dependency, no bundler): `receptionistPermissions.js` is a pure ES
// module with no React, DOM or `import.meta.env` usage. The React route tree
// itself is exercised through the production build + lint, not here.
//
// The shared Admin pages are mounted under two URL namespaces: `/admin` (Admin
// panel) and `/receptionist` (Receptionist portal). These tests lock in that a
// receptionist is always resolved into `/receptionist/...` and never `/admin`,
// while Admin resolution is byte-for-byte unchanged.

const {
  ADMIN_BASE_PATH,
  RECEPTIONIST_BASE_PATH,
  getPortalBasePath,
  toPortalPath,
  findFirstAccessibleModulePath,
  buildModuleKey,
  buildPageKey,
} = await import('../src/constants/receptionistPermissions.js');

test('portal base path is role-specific and defaults to Admin', () => {
  assert.equal(ADMIN_BASE_PATH, '/admin');
  assert.equal(RECEPTIONIST_BASE_PATH, '/receptionist');
  assert.equal(getPortalBasePath('receptionist'), '/receptionist');
  assert.equal(getPortalBasePath('admin'), '/admin');
  assert.equal(getPortalBasePath('teacher'), '/admin');
  assert.equal(getPortalBasePath(null), '/admin');
  assert.equal(getPortalBasePath(undefined), '/admin');
});

test('toPortalPath rewrites only /admin paths, and only for receptionists', () => {
  // Receptionist: /admin... -> /receptionist...
  assert.equal(toPortalPath('receptionist', '/admin'), '/receptionist');
  assert.equal(toPortalPath('receptionist', '/admin/students'), '/receptionist/students');
  assert.equal(
    toPortalPath('receptionist', '/admin/fees/fee-structure'),
    '/receptionist/fees/fee-structure',
  );
  // Admin (and every other role) is untouched.
  assert.equal(toPortalPath('admin', '/admin/students'), '/admin/students');
  assert.equal(toPortalPath('admin', '/admin'), '/admin');
  // Non-/admin paths are never rewritten, and guards pass through falsy input.
  assert.equal(toPortalPath('receptionist', '/teacher/dashboard'), '/teacher/dashboard');
  assert.equal(toPortalPath('receptionist', null), null);
  assert.equal(toPortalPath('receptionist', undefined), undefined);
  // A path that merely starts with the letters "admin" is not rewritten.
  assert.equal(toPortalPath('receptionist', '/administrators'), '/administrators');
});

test('a receptionist never resolves to an /admin landing route', () => {
  const user = { role: 'receptionist', permissions: [buildModuleKey('dashboard')] };
  const landing = findFirstAccessibleModulePath(user);
  assert.equal(landing, '/receptionist');
  assert.ok(!landing.startsWith('/admin'));
});

test('whole-module grants resolve to the module path under /receptionist', () => {
  const user = { role: 'receptionist', permissions: [buildModuleKey('student-management')] };
  assert.equal(findFirstAccessibleModulePath(user), '/receptionist/students');
});

test('a page grant resolves to that page path under /receptionist', () => {
  const user = {
    role: 'receptionist',
    permissions: [buildPageKey('exam-management', 'results')],
  };
  assert.equal(findFirstAccessibleModulePath(user), '/receptionist/exams/results');
});

test('an action-only grant falls back to the module path under /receptionist', () => {
  const user = {
    role: 'receptionist',
    permissions: [buildPageKey('timetable-management', 'designer')],
  };
  // The Designer page has no dedicated route, so the module path is returned.
  assert.equal(findFirstAccessibleModulePath(user), '/receptionist/timetable');
});

test('no grants resolve to null (caller sends the user to access-denied)', () => {
  assert.equal(findFirstAccessibleModulePath({ role: 'receptionist', permissions: [] }), null);
  assert.equal(findFirstAccessibleModulePath({ role: 'receptionist' }), null);
});

test('the resolver is receptionist-only, so Admin resolution is unchanged', () => {
  assert.equal(findFirstAccessibleModulePath({ role: 'admin', permissions: ['module:dashboard'] }), null);
  assert.equal(findFirstAccessibleModulePath({ role: 'teacher', permissions: [] }), null);
  assert.equal(findFirstAccessibleModulePath(null), null);
});
