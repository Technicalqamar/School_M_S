import { asyncHandler } from '../utils/asyncHandler.js';
import teacherClassScheduleService from '../services/teacherClassSchedule.service.js';

const getMyClassSchedule = asyncHandler(async (req, res) => {
  const data = await teacherClassScheduleService.getMyClassSchedule(req.user, {
    academicYear: req.query.academicYear,
    teacherId: req.query.teacherId,
    classId: req.query.classId,
  });

  return res.status(200).json({
    success: true,
    message: 'My class schedule fetched successfully',
    data,
  });
});

export { getMyClassSchedule };