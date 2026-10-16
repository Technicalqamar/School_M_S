// Focused tests for Teacher QR attendance authorization.
//
// Root cause being pinned: the shared `POST /attendance/qr-scan` endpoint
// (used by the Teacher Attendance scanner) was gated by a single static
// `student-attendance-mark` action. That both let a student-only operator record
// TEACHER attendance and blocked a teacher-only operator from checking teachers
// in. Authorization is now resolved from the scanned card type
// (student -> student-attendance-mark, teacher -> teacher-attendance-mark) and
// checked before any attendance is written.
//
// All tests are DB-less: the pure authorization/decision logic is exercised
// directly, and the controller is driven with the QR service methods mocked on
// the shared module object (the controller holds the same reference).

import test from 'node:test';
import assert from 'node:assert/strict';

const { ApiError } = await import('../src/utils/apiError.js');
const { userHasActionAccess, requireAnyActionAccess } = await import('../src/middlewares/permission.middleware.js');
const {
  ATTENDANCE_MODULE_KEY,
  resolveQrScanAction,
  resolveQrTargetType,
} = await import('../src/services/commonAttendance.service.js');
const { default: commonAttendanceService } = await import('../src/services/commonAttendance.service.js');
const { qrScanAttendance } = await import('../src/controllers/attendance.controller.js');

const MODULE = ATTENDANCE_MODULE_KEY;
const TEACHER_ACTION = 'action:attendance-management:teacher-attendance-mark';
const STUDENT_ACTION = 'action:attendance-management:student-attendance-mark';
const TEACHER_PAGE = 'page:attendance-management:teacher-attendance';

const receptionist = (permissions) => ({
  user: { _id: 'rec-1', role: 'receptionist' },
  receptionistProfile: { permissions },
});

const admin = () => ({ user: { _id: 'admin-1', role: 'admin' } });

const isApiError = (status) => (error) =>
  error instanceof ApiError && error.statusCode === status;

// Drives the real `qrScanAttendance` controller through its asyncHandler wrapper
// and resolves with the response object a success path would have produced, or
// rejects with the error the wrapper forwards to `next`.
const invoke = (req) =>
  new Promise((resolve, reject) => {
    const res = {
      statusCode: undefined,
      payload: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        resolve(this);
        return this;
      },
    };

    qrScanAttendance(req, res, (err) => (err ? reject(err) : resolve(res)));
  });

const teacherScan = {
  type: 'teacher',
  action: 'checkin',
  status: 'Present',
  teacher: { teacherId: 'TCH-1', fullName: 'Jane Doe' },
};
const teacherCheckout = {
  type: 'teacher',
  action: 'checkout',
  status: 'Present',
  teacher: { teacherId: 'TCH-1', fullName: 'Jane Doe' },
  checkOut: new Date('2025-01-01T10:00:00.000Z'),
};
const studentScan = {
  type: 'student',
  action: 'checkin',
  status: 'Present',
  student: { studentId: 'STD-1', fullName: 'Sam Doe' },
};

test('QR scan actions separate the student and teacher operations', () => {
  assert.equal(resolveQrScanAction('student'), 'student-attendance-mark');
  assert.equal(resolveQrScanAction('teacher'), 'teacher-attendance-mark');
  assert.equal(resolveQrScanAction('unknown'), null);
  assert.equal(resolveQrScanAction(undefined), null);
  assert.equal(resolveQrScanAction(null), null);
});

test('resolveQrTargetType returns null for blank / non-string codes (no DB lookup)', async () => {
  for (const value of ['', '   ', null, undefined, 123, {}, []]) {
    assert.equal(await resolveQrTargetType(value, '2025'), null);
  }
});

test('admin bypasses the per-type action check', () => {
  assert.equal(userHasActionAccess(admin(), MODULE, 'student-attendance-mark'), true);
  assert.equal(userHasActionAccess(admin(), MODULE, 'teacher-attendance-mark'), true);
});

test('teacher and student QR permissions are independent', () => {
  const teacherOnly = receptionist([TEACHER_ACTION]);
  assert.equal(userHasActionAccess(teacherOnly, MODULE, 'teacher-attendance-mark'), true);
  assert.equal(userHasActionAccess(teacherOnly, MODULE, 'student-attendance-mark'), false);

  const studentOnly = receptionist([STUDENT_ACTION]);
  assert.equal(userHasActionAccess(studentOnly, MODULE, 'student-attendance-mark'), true);
  assert.equal(userHasActionAccess(studentOnly, MODULE, 'teacher-attendance-mark'), false);
});

test('a teacher-attendance page grant implies only the teacher mark action', () => {
  const pageGrant = receptionist([TEACHER_PAGE]);
  assert.equal(userHasActionAccess(pageGrant, MODULE, 'teacher-attendance-mark'), true);
  assert.equal(userHasActionAccess(pageGrant, MODULE, 'student-attendance-mark'), false);
});

test('a receptionist with no attendance grant is denied both actions', () => {
  const none = receptionist([]);
  assert.equal(userHasActionAccess(none, MODULE, 'teacher-attendance-mark'), false);
  assert.equal(userHasActionAccess(none, MODULE, 'student-attendance-mark'), false);
});

test('disallowed and unauthenticated roles are rejected', () => {
  assert.throws(
    () => userHasActionAccess({ user: { role: 'teacher' } }, MODULE, 'teacher-attendance-mark'),
    isApiError(403),
  );
  assert.throws(
    () => userHasActionAccess({ user: { role: 'student' } }, MODULE, 'student-attendance-mark'),
    isApiError(403),
  );
  assert.throws(
    () => userHasActionAccess({}, MODULE, 'teacher-attendance-mark'),
    isApiError(401),
  );
});

test('requireAnyActionAccess admits either QR action but fails closed without one', () => {
  const guard = requireAnyActionAccess(MODULE, [
    resolveQrScanAction('student'),
    resolveQrScanAction('teacher'),
  ]);

  let nextCalled = 0;
  const next = () => {
    nextCalled += 1;
  };

  guard(admin(), {}, next);
  guard(receptionist([TEACHER_ACTION]), {}, next);
  guard(receptionist([STUDENT_ACTION]), {}, next);
  assert.equal(nextCalled, 3);

  assert.throws(() => guard(receptionist([]), {}, next), isApiError(403));
  assert.throws(() => guard({ user: { role: 'teacher' } }, {}, next), isApiError(403));
  assert.equal(nextCalled, 3);
});

test('an authorized teacher operator can mark a teacher QR (existing valid flow)', async (t) => {
  t.mock.method(commonAttendanceService, 'resolveQrTargetType', async () => 'teacher');
  t.mock.method(commonAttendanceService, 'qrScanAnyAttendance', async () => teacherScan);

  const req = receptionist([TEACHER_ACTION]);
  req.body = { qrValue: 'QR-TCH-1', academicYear: '2025' };

  const res = await invoke(req);
  assert.equal(res.statusCode, 201);
  assert.match(res.payload.message, /Teacher attendance marked/);
  assert.equal(res.payload.data.type, 'teacher');
  assert.equal(commonAttendanceService.qrScanAnyAttendance.mock.calls.length, 1);
});

test('a student-only operator cannot mark teacher attendance (core bug)', async (t) => {
  t.mock.method(commonAttendanceService, 'resolveQrTargetType', async () => 'teacher');
  t.mock.method(commonAttendanceService, 'qrScanAnyAttendance', async () => teacherScan);

  const req = receptionist([STUDENT_ACTION]);
  req.body = { qrValue: 'QR-TCH-1', academicYear: '2025' };

  await assert.rejects(invoke(req), isApiError(403));
  assert.equal(commonAttendanceService.qrScanAnyAttendance.mock.calls.length, 0);
});

test('a teacher-only operator cannot mark student attendance', async (t) => {
  t.mock.method(commonAttendanceService, 'resolveQrTargetType', async () => 'student');
  t.mock.method(commonAttendanceService, 'qrScanAnyAttendance', async () => studentScan);

  const req = receptionist([TEACHER_ACTION]);
  req.body = { qrValue: 'STD-QR', academicYear: '2025' };

  await assert.rejects(invoke(req), isApiError(403));
  assert.equal(commonAttendanceService.qrScanAnyAttendance.mock.calls.length, 0);
});

test('an authorized student operator can mark a student QR', async (t) => {
  t.mock.method(commonAttendanceService, 'resolveQrTargetType', async () => 'student');
  t.mock.method(commonAttendanceService, 'qrScanAnyAttendance', async () => studentScan);

  const req = receptionist([STUDENT_ACTION]);
  req.body = { qrValue: 'STD-QR', academicYear: '2025' };

  const res = await invoke(req);
  assert.equal(res.statusCode, 201);
  assert.match(res.payload.message, /Student attendance marked/);
});

test('admin can mark a teacher QR through the shared endpoint', async (t) => {
  t.mock.method(commonAttendanceService, 'resolveQrTargetType', async () => 'teacher');
  t.mock.method(commonAttendanceService, 'qrScanAnyAttendance', async () => teacherScan);

  const req = admin();
  req.body = { qrValue: 'QR-TCH-1', academicYear: '2025' };

  const res = await invoke(req);
  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.data.teacher.teacherId, 'TCH-1');
});

test('a teacher check-out returns 200 with the check-out message', async (t) => {
  t.mock.method(commonAttendanceService, 'resolveQrTargetType', async () => 'teacher');
  t.mock.method(commonAttendanceService, 'qrScanAnyAttendance', async () => teacherCheckout);

  const req = admin();
  req.body = { qrValue: 'QR-TCH-1', academicYear: '2025' };

  const res = await invoke(req);
  assert.equal(res.statusCode, 200);
  assert.match(res.payload.message, /checked out/);
});

test('an unknown / invalid QR returns 404 and never records attendance', async (t) => {
  t.mock.method(commonAttendanceService, 'resolveQrTargetType', async () => null);
  t.mock.method(commonAttendanceService, 'qrScanAnyAttendance', async () => teacherScan);

  const req = admin();
  req.body = { qrValue: 'NOT-A-REAL-QR', academicYear: '2025' };

  await assert.rejects(invoke(req), isApiError(404));
  assert.equal(commonAttendanceService.qrScanAnyAttendance.mock.calls.length, 0);
});

test('a portal teacher role is rejected before the QR is even resolved', async (t) => {
  t.mock.method(commonAttendanceService, 'resolveQrTargetType', async () => 'teacher');
  t.mock.method(commonAttendanceService, 'qrScanAnyAttendance', async () => teacherScan);

  const req = { user: { _id: 't-1', role: 'teacher' }, body: { qrValue: 'QR-TCH-1', academicYear: '2025' } };

  await assert.rejects(invoke(req), isApiError(403));
  assert.equal(commonAttendanceService.resolveQrTargetType.mock.calls.length, 0);
  assert.equal(commonAttendanceService.qrScanAnyAttendance.mock.calls.length, 0);
});
