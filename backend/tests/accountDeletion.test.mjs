// Tests to pin secure account deletion behavior (student/teacher).
// On delete, linked portal UserAccounts should be deactivated (isActive false).
// Services should throw 404 when appropriate. These are import/contract checks.

import test from 'node:test';
import assert from 'node:assert/strict';

const { ApiError } = await import('../src/utils/apiError.js');
const studentService = (await import('../src/services/student.service.js')).default;
const teacherService = (await import('../src/services/teacher.service.js')).default;

test('student service exports deleteStudent', () => {
  assert.equal(typeof studentService.deleteStudent, 'function');
});

test('teacher service exports deleteTeacher', () => {
  assert.equal(typeof teacherService.deleteTeacher, 'function');
});

test('ApiError behaves as expected', () => {
  const err = new ApiError(404, 'Not found');
  assert.equal(err.statusCode, 404);
  assert.equal(err.message, 'Not found');
});
