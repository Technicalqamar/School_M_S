import { asyncHandler } from '../utils/asyncHandler.js';
import studentClassScheduleService from '../services/studentClassSchedule.service.js';

const getMyClassSchedule = asyncHandler(async (req, res) => {
  const data = await studentClassScheduleService.getMyClassSchedule(
    req.user,
    { accessType: req.accessType, accessStudentId: req.accessStudentId },
    { academicYear: req.query.academicYear, classId: req.query.classId }
  );

  return res.status(200).json({
    success: true,
    message: 'Class schedule fetched successfully',
    data,
  });
});

export { getMyClassSchedule };