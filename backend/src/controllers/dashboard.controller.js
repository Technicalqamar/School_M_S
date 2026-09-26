import { asyncHandler } from '../utils/asyncHandler.js';
import dashboardService from '../services/dashboard.service.js';

const getDashboardData = asyncHandler(async (req, res) => {
  const result = await dashboardService.getDashboardData({ academicYear: req.query.academicYear });

  return res.status(200).json({
    success: true,
    message: 'Dashboard data fetched successfully',
    data: result,
  });
});

export { getDashboardData };