import { asyncHandler } from '../utils/asyncHandler.js';
import defaultPasswordService from '../services/defaultPassword.service.js';

const getDefaultPasswords = asyncHandler(async (req, res) => {
  const data = await defaultPasswordService.getDefaultPasswords();

  return res.status(200).json({
    success: true,
    message: 'Default password settings fetched successfully',
    data,
  });
});

const updateDefaultPasswords = asyncHandler(async (req, res) => {
  const { student, teacher } = req.body || {};

  const data = await defaultPasswordService.updateDefaultPasswords({
    student,
    teacher,
    performedBy: req.user?._id,
  });

  return res.status(200).json({
    success: true,
    message: 'Default password settings updated successfully',
    data,
  });
});

export { getDefaultPasswords, updateDefaultPasswords };
