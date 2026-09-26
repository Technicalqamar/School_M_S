import { asyncHandler } from '../utils/asyncHandler.js';
import teacherMyClassesService from '../services/teacherMyClasses.service.js';

const getMyClasses = asyncHandler(async (req, res) => {
  const result = await teacherMyClassesService.getMyClasses(req.user);

  return res.status(200).json({
    success: true,
    message: 'My classes fetched successfully',
    data: result,
  });
});

export { getMyClasses };