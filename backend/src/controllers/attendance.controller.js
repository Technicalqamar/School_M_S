import { asyncHandler } from '../utils/asyncHandler.js';
import commonAttendanceService from '../services/commonAttendance.service.js';

const qrScanAttendance = asyncHandler(async (req, res) => {
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
