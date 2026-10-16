// Focused tests for the Global Student Search helpers and the Single Student
// Management route helpers. Both modules are framework-free, so they run under
// the project's existing `node --test` setup (no new test framework).
//
// Covered here:
//   * search term normalisation / debounce gating / request shape
//   * unambiguous student labelling (used to avoid selecting the wrong student)
//   * client-side roster filtering for Attendance Management
//   * single-student route parsing (admin + receptionist namespaces)
//   * permission-safe path building (always a real, concrete student id)

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  MIN_SEARCH_LENGTH,
  SEARCH_SUGGESTION_LIMIT,
  normalizeSearchTerm,
  shouldSearch,
  buildStudentSearchParams,
  getStudentLabel,
  getStudentMeta,
  filterStudentsByNameOrId,
} = await import('../src/utils/studentSearch.js');

const {
  parseStudentRoute,
  buildStudentPath,
  buildStudentAttendancePath,
  isStudentPortalPath,
} = await import('../src/utils/singleStudent.js');

test('normalizeSearchTerm trims but never coerces non-strings', () => {
  assert.equal(normalizeSearchTerm('  Ali  '), 'Ali');
  assert.equal(normalizeSearchTerm('\t\nRaza '), 'Raza');
  assert.equal(normalizeSearchTerm(''), '');
  assert.equal(normalizeSearchTerm(null), '');
  assert.equal(normalizeSearchTerm(undefined), '');
  assert.equal(normalizeSearchTerm(42), '');
});

test('shouldSearch gates very short terms and ignores surrounding whitespace', () => {
  assert.equal(MIN_SEARCH_LENGTH, 2);
  assert.equal(shouldSearch('a'), false);
  assert.equal(shouldSearch(' a '), false);
  assert.equal(shouldSearch('ab'), true);
  assert.equal(shouldSearch('Ali'), true);
  assert.equal(shouldSearch(''), false);
  // A custom threshold is honoured.
  assert.equal(shouldSearch('ab', 3), false);
  assert.equal(shouldSearch('abc', 3), true);
});

test('buildStudentSearchParams requests a single focused page, never everything', () => {
  const params = buildStudentSearchParams('  Hina  ');
  assert.deepEqual(params, { search: 'Hina', page: 1, limit: SEARCH_SUGGESTION_LIMIT });
  // Callers can request a tighter cap but the page is always the first one.
  assert.deepEqual(buildStudentSearchParams('Ali', 5), { search: 'Ali', page: 1, limit: 5 });
});

test('getStudentLabel always pairs the name with the Student ID', () => {
  assert.equal(
    getStudentLabel({ fullName: 'Hina Khan', studentId: 'STD-000123' }),
    'Hina Khan (STD-000123)',
  );
  assert.equal(getStudentLabel({ fullName: 'Hina Khan' }), 'Hina Khan');
  assert.equal(getStudentLabel({ studentId: 'STD-000123' }), 'STD-000123');
  assert.equal(getStudentLabel(null), '');
});

test('getStudentMeta shows class and Student ID for disambiguation', () => {
  assert.equal(getStudentMeta({ class: 'Class 5', studentId: 'STD-000123' }), 'Class 5 · STD-000123');
  assert.equal(getStudentMeta({ class: 'Class 5' }), 'Class 5');
  assert.equal(getStudentMeta({}), '');
});

test('filterStudentsByNameOrId matches names and ids case-insensitively', () => {
  const roster = [
    { fullName: 'Hina Khan', studentId: 'STD-000123' },
    { fullName: 'Ali Raza', studentId: 'STD-000456' },
    { fullName: 'hina malik', studentId: 'STD-000789' },
  ];

  // Name prefix, MID-name and full name all match.
  assert.equal(filterStudentsByNameOrId(roster, 'hin').length, 2);
  assert.equal(filterStudentsByNameOrId(roster, 'HINA KHAN').length, 1);
  // Student ID (case-insensitive, substring of the id) matches.
  assert.equal(filterStudentsByNameOrId(roster, 'std-000456')[0].fullName, 'Ali Raza');
  // Leading/trailing spaces are ignored.
  assert.equal(filterStudentsByNameOrId(roster, '  raza ').length, 1);
  // Empty term returns the roster untouched; non-arrays are safe.
  assert.equal(filterStudentsByNameOrId(roster, '   ').length, 3);
  assert.deepEqual(filterStudentsByNameOrId(null, 'ali'), []);
  // No match yields an empty list (drives the "no results" state).
  assert.deepEqual(filterStudentsByNameOrId(roster, 'zzz'), []);
});

test('parseStudentRoute recognises the single-student route in both portals', () => {
  assert.deepEqual(parseStudentRoute('/admin/students/STD-000123'), {
    portal: 'admin',
    basePath: '/admin',
    studentId: 'STD-000123',
    section: '',
  });
  assert.deepEqual(parseStudentRoute('/receptionist/students/STD-000123/fees'), {
    portal: 'receptionist',
    basePath: '/receptionist',
    studentId: 'STD-000123',
    section: 'fees',
  });
});

test('parseStudentRoute tolerates trailing slashes, queries and encoded ids', () => {
  assert.equal(parseStudentRoute('/admin/students/STD-000123/')?.studentId, 'STD-000123');
  assert.equal(parseStudentRoute('/admin/students/STD-000123?x=1')?.studentId, 'STD-000123');
  assert.equal(parseStudentRoute('/admin/students/STD%2D000123/academic')?.studentId, 'STD-000123');
  assert.equal(parseStudentRoute('/admin/students/STD-000123/academic/')?.section, 'academic');
});

test('parseStudentRoute rejects the list route and unrelated paths', () => {
  // The students LIST has no id and must not be treated as a selected student.
  assert.equal(parseStudentRoute('/admin/students'), null);
  assert.equal(parseStudentRoute('/receptionist/students'), null);
  // Wrong portal, wrong segment, or too short.
  assert.equal(parseStudentRoute('/teacher/students/STD-000123'), null);
  assert.equal(parseStudentRoute('/admin/teachers/T-1'), null);
  assert.equal(parseStudentRoute('/admin'), null);
  assert.equal(parseStudentRoute(''), null);
  assert.equal(parseStudentRoute(null), null);
  assert.equal(parseStudentRoute(undefined), null);
});

test('buildStudentPath produces namespace-correct student routes', () => {
  assert.equal(buildStudentPath('admin', 'STD-000123'), '/admin/students/STD-000123');
  assert.equal(
    buildStudentPath('receptionist', 'STD-000123', 'academic'),
    '/receptionist/students/STD-000123/academic',
  );
  // Unknown portals never leak into an arbitrary namespace.
  assert.equal(buildStudentPath('teacher', 'STD-000123'), '/admin/students/STD-000123');
  assert.equal(buildStudentPath(undefined, 'STD-000123'), '/admin/students/STD-000123');
});

test('buildStudentAttendancePath preselects class and student in the portal', () => {
  const student = { class: 'Class 5', studentId: 'STD-000123' };
  assert.equal(
    buildStudentAttendancePath('admin', student),
    '/admin/attendance?class=Class+5&student=STD-000123',
  );
  assert.equal(
    buildStudentAttendancePath('receptionist', student),
    '/receptionist/attendance?class=Class+5&student=STD-000123',
  );
  // A student without context still yields a usable (unfiltered) link.
  assert.equal(buildStudentAttendancePath('admin', {}), '/admin/attendance');
});

test('isStudentPortalPath is the boolean form used by guards', () => {
  assert.equal(isStudentPortalPath('/admin/students/STD-000123/fees'), true);
  assert.equal(isStudentPortalPath('/admin/students'), false);
  assert.equal(isStudentPortalPath('/admin/dashboard'), false);
});

// Selecting a suggestion must open the workspace for THAT exact Student ID.
// The search bar composes the target from the selected student (never from a
// positional index), so this test pins that contract down.
test('selecting a search result yields the exact selected student workspace path', () => {
  const suggestions = [
    { fullName: 'Hina Khan', studentId: 'STD-000123', class: 'Class 5' },
    { fullName: 'Hina Malik', studentId: 'STD-000789', class: 'Class 6' },
  ];
  const selected = suggestions[1];
  const target = buildStudentPath('admin', selected.studentId);
  assert.equal(target, '/admin/students/STD-000789');
  // The path resolves back to the same student - never the other suggestion.
  assert.equal(parseStudentRoute(target)?.studentId, 'STD-000789');
  assert.notEqual(parseStudentRoute(target)?.studentId, suggestions[0].studentId);
});

// The selected Student ID alone must never widen access: opening a workspace
// still requires the same grant the route guard checks, and an unrelated grant
// does not qualify. (Mirrors the SingleStudentSidebarGroup / RequireModule
// check so the sidebar cannot advertise a page the guard would reject.)
test('opening a student workspace is permission-gated, independent of the id', async () => {
  const { hasModuleAccess, buildPageKey, buildModuleKey } = await import(
    '../src/constants/receptionistPermissions.js'
  );

  const admin = { role: 'admin', permissions: [] };
  const grantedReceptionist = { role: 'receptionist', permissions: [buildPageKey('student-management', 'all-students')] };
  const wholeModuleReceptionist = { role: 'receptionist', permissions: [buildModuleKey('student-management')] };
  const unrelatedReceptionist = { role: 'receptionist', permissions: [buildPageKey('fee-management', 'collect-fee')] };
  const teacher = { role: 'teacher', permissions: [buildPageKey('student-management', 'all-students')] };

  assert.equal(hasModuleAccess(admin, 'student-management', 'all-students'), true);
  assert.equal(hasModuleAccess(grantedReceptionist, 'student-management', 'all-students'), true);
  assert.equal(hasModuleAccess(wholeModuleReceptionist, 'student-management', 'all-students'), true);
  assert.equal(hasModuleAccess(unrelatedReceptionist, 'student-management', 'all-students'), false);
  assert.equal(hasModuleAccess(teacher, 'student-management', 'all-students'), false);
  assert.equal(hasModuleAccess(null, 'student-management', 'all-students'), false);
});
