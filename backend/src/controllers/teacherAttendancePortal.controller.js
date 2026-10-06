import { asyncHandler } from '../utils/asyncHandler.js';
import teacherAttendancePortalService from '../services/teacherAttendancePortal.service.js';

// Teacher Portal — My Attendance (READ-ONLY).
const getMyAttendance = asyncHandler(async (req, res) => {
  const result = await teacherAttendancePortalService.getMyAttendance(req.user, req.query);

  return res.status(200).json({
    success: true,
    message: 'My attendance fetched successfully',
    data: result,
  });
});

export {
  getMyAttendance,
};