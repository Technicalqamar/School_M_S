// Focused tests for the bulk-delete protection on Student Attendance.
//
// `DELETE /api/v1/student-attendance` previously built an empty filter and handed
// it to `deleteMany({})` when no selector was supplied, which erased every
// attendance record. These tests pin both layers of the fix:
//   * the service-level guard (`assertBulkDeleteFilter`) that refuses an empty
//     filter before `deleteMany()` can run, on any code path; and
//   * the route-level validator that rejects empty/invalid selectors for normal
//     HTTP traffic.
//
// No DB connection is required: the service throws before touching the model, and
// the validator is a pure middleware.

import test from 'node:test';
import assert from 'node:assert/strict';

const { assertBulkDeleteFilter } = await import('../src/utils/bulkDeleteGuard.js');
const { validateDeleteBulkAttendance } = await import('../src/validations/studentAttendance.validation.js');
const { ApiError } = await import('../src/utils/apiError.js');
const { default: studentAttendanceService } = await import('../src/services/studentAttendance.service.js');

const isApiError400 = (error) => error instanceof ApiError && error.statusCode === 400;

// Runs the validator against `query`. Returns true when it calls next(); throws
// whatever the middleware throws otherwise.
const runValidator = (query) => {
  let nextCalled = false;
  validateDeleteBulkAttendance({ query }, {}, () => {
    nextCalled = true;
  });
  return nextCalled;
};

test('assertBulkDeleteFilter rejects an empty or non-object filter', () => {
  assert.throws(() => assertBulkDeleteFilter({}), isApiError400);
  assert.throws(() => assertBulkDeleteFilter(null), isApiError400);
  assert.throws(() => assertBulkDeleteFilter(undefined), isApiError400);
  assert.throws(() => assertBulkDeleteFilter('Class 1'), isApiError400);
});

test('assertBulkDeleteFilter passes through a filter with a selector', () => {
  const filter = { academicYear: '2025' };
  assert.equal(assertBulkDeleteFilter(filter), filter);
  assert.equal(assertBulkDeleteFilter({ class: 'Class 1' }).class, 'Class 1');
});

test('validateDeleteBulkAttendance rejects a request with no usable selector', () => {
  assert.throws(() => runValidator({}), isApiError400);
  assert.throws(() => runValidator({ className: 'All Classes' }), isApiError400);
  assert.throws(() => runValidator({ className: '   ' }), isApiError400);
  assert.throws(() => runValidator({ academicYear: '', date: '' }), isApiError400);
});

test('validateDeleteBulkAttendance rejects invalid selector values', () => {
  assert.throws(() => runValidator({ academicYear: 'abc' }), isApiError400);
  assert.throws(() => runValidator({ className: 'Class 99' }), isApiError400);
  assert.throws(() => runValidator({ date: 'not-a-date' }), isApiError400);
});

test('validateDeleteBulkAttendance accepts a valid filtered request', () => {
  assert.equal(runValidator({ academicYear: '2025' }), true);
  assert.equal(runValidator({ className: 'Class 1' }), true);
  assert.equal(runValidator({ date: '2025-01-15' }), true);
  assert.equal(runValidator({ className: 'KG 1', academicYear: '2025', date: '2025-01-15' }), true);
});

test('the service refuses to delete when no selector reaches it', async () => {
  await assert.rejects(
    () => studentAttendanceService.deleteBulkAttendance(undefined, undefined, undefined),
    isApiError400,
  );
  await assert.rejects(
    () => studentAttendanceService.deleteBulkAttendance('All Classes', '', ''),
    isApiError400,
  );
  await assert.rejects(
    () => studentAttendanceService.deleteBulkAttendance('', '', 'not-a-date'),
    isApiError400,
  );
});
