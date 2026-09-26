import { asyncHandler } from '../utils/asyncHandler.js';
import teacherMyResultsService from '../services/teacherMyResults.service.js';

const getMyResults = asyncHandler(async (req, res) => {
  const result = await teacherMyResultsService.getMyResults(req.user, {
    academicYear: req.query.academicYear ? String(req.query.academicYear) : '',
    examId: String(req.query.examId || ''),
    className: String(req.query.className || ''),
    subjectId: req.query.subjectId ? String(req.query.subjectId) : '',
  });

  return res.status(200).json({
    success: true,
    message: 'My results fetched successfully',
    data: result,
  });
});

export { getMyResults };