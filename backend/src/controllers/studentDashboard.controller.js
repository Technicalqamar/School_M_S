import { asyncHandler } from '../utils/asyncHandler.js';
import studentDashboardService from '../services/studentDashboard.service.js';

const getStudentDashboardData = asyncHandler(async (req, res) => {
  const result = await studentDashboardService.getStudentDashboardData(req.user, {
    accessType: req.accessType,
    accessStudentId: req.accessStudentId,
  });

  return res.status(200).json({
    success: true,
    message: 'Student dashboard data fetched successfully',
    data: result,
  });
});

export { getStudentDashboardData };