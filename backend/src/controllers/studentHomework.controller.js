import { asyncHandler } from '../utils/asyncHandler.js';
import studentHomeworkService from '../services/studentHomework.service.js';

const getStudentAssignments = asyncHandler(async (req, res) => {
  const { search, subject, status, page, limit } = req.query;

  const result = await studentHomeworkService.getMyAssignments(req.user, {
    search,
    subject,
    status,
    page,
    limit,
  });

  return res.status(200).json({
    success: true,
    message: 'Assignments fetched successfully',
    data: result,
  });
});

const getStudentAssignment = asyncHandler(async (req, res) => {
  const result = await studentHomeworkService.getMyAssignment(req.user, req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Assignment fetched successfully',
    data: result,
  });
});

export { getStudentAssignments, getStudentAssignment };