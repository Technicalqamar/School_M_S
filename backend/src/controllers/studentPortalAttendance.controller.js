import { asyncHandler } from '../utils/asyncHandler.js';
import studentPortalAttendanceService from '../services/studentPortalAttendance.service.js';

const getMyAttendance = asyncHandler(async (req, res) => {
  const data = await studentPortalAttendanceService.getMyAttendance(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    {
      academicYear: req.query.academicYear,
      studentId: req.query.studentId,
      student: req.query.student,
      classId: req.query.classId,
      class: req.query.class,
    }
  );

  return res.status(200).json({
    success: true,
    message: 'Attendance fetched successfully',
    data,
  });
});

export { getMyAttendance };