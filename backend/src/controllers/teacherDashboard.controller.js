import { asyncHandler } from '../utils/asyncHandler.js';
import teacherDashboardService from '../services/teacherDashboard.service.js';

const getTeacherDashboardData = asyncHandler(async (req, res) => {
  const result = await teacherDashboardService.getTeacherDashboardData(req.user);

  return res.status(200).json({
    success: true,
    message: 'Teacher dashboard data fetched successfully',
    data: result,
  });
});

export { getTeacherDashboardData };