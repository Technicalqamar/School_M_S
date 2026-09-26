import { asyncHandler } from '../utils/asyncHandler.js';
import teacherClassStudentsService from '../services/teacherClassStudents.service.js';

const getClassStudents = asyncHandler(async (req, res) => {
  const { classId } = req.params;
  const { search } = req.query;

  const result = await teacherClassStudentsService.getClassStudents(req.user, {
    classId,
    search: typeof search === 'string' ? search.trim() : '',
  });

  return res.status(200).json({
    success: true,
    message: 'Class students fetched successfully',
    data: result,
  });
});

export { getClassStudents };