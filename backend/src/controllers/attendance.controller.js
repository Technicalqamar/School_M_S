import { asyncHandler } from '../utils/asyncHandler.js';
import commonAttendanceService, {
  ATTENDANCE_MODULE_KEY,
  resolveQrScanAction,
} from '../services/commonAttendance.service.js';
import { ApiError } from '../utils/apiError.js';
import { userHasActionAccess } from '../middlewares/permission.middleware.js';

// Shared student/teacher QR-scan endpoint.
//
// A single route accepts BOTH a student ID card and a teacher QR, but they are
// different operations with different permissions. Authorization is therefore
// resolved from what the scanned code actually is, and checked BEFORE any
// attendance is written - reusing the student mark action for a teacher scan
// (or vice versa) would either escalate or deny the wrong operator.
const qrScanAttendance = asyncHandler(async (req, res) => {
  const { qrValue, academicYear } = req.body || {};

  const studentAction = resolveQrScanAction('student');
  const teacherAction = resolveQrScanAction('teacher');

  // Fail closed before the QR is even looked up: a principal with no QR
  // attendance capability (or a disallowed role) is rejected without learning
  // whether the code exists. `userHasActionAccess` throws 401/403 for roles that
  // may not use this endpoint at all, matching the middleware contract.
  const canMarkStudent = userHasActionAccess(req, ATTENDANCE_MODULE_KEY, studentAction);
  const canMarkTeacher = userHasActionAccess(req, ATTENDANCE_MODULE_KEY, teacherAction);

  if (!canMarkStudent && !canMarkTeacher) {
    throw new ApiError(403, 'You do not have permission to perform this action');
  }

  const targetType = await commonAttendanceService.resolveQrTargetType(qrValue, academicYear);

  if (!targetType) {
    throw new ApiError(404, 'Unknown QR code');
  }

  const allowed = targetType === 'teacher' ? canMarkTeacher : canMarkStudent;
  if (!allowed) {
    throw new ApiError(403, 'You do not have permission to perform this action');
  }

  const result = await commonAttendanceService.qrScanAnyAttendance(req.body, req.user._id);

  const personType = result?.type;
  const person = personType === 'teacher' ? result.teacher : result.student;
  const label = person?.fullName || person?.teacherId || person?.studentId || 'Person';

  const isCheckout = result?.action === 'checkout';

  return res.status(isCheckout ? 200 : 201).json({
    success: true,
    message: isCheckout
      ? `Teacher checked out via QR scan for ${label}`
      : `${personType === 'teacher' ? 'Teacher' : 'Student'} attendance marked as ${result.status} via QR scan for ${label}`,
    data: result,
  });
});

export { qrScanAttendance };
