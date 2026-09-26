import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import Admin from '../models/admin.model.js';

const setSecurityLock = asyncHandler(async (req, res) => {
  const { lock } = req.body;

  if (!lock || lock.length < 4) {
    throw new ApiError(400, 'Security lock must be at least 4 characters');
  }

  const admin = await Admin.findById(req.user._id);

  if (admin.securityLockHash) {
    throw new ApiError(400, 'Security lock already exists. Use change option.');
  }

  const salt = await bcrypt.genSalt(10);
  admin.securityLockHash = await bcrypt.hash(lock, salt);
  await admin.save();

  res.json({ success: true, message: 'Security lock created successfully' });
});

const verifySecurityLock = asyncHandler(async (req, res) => {
  const { lock } = req.body;

  const admin = await Admin.findById(req.user._id);

  if (!admin.securityLockHash) {
    return res.json({ success: true, hasLock: false });
  }

  if (!lock) {
    return res.json({ success: true, hasLock: true });
  }

  const isValid = await admin.compareSecurityLock(lock);
  if (!isValid) {
    throw new ApiError(401, 'Invalid security lock');
  }

  res.json({ success: true, hasLock: true, verified: true });
});

const changeSecurityLock = asyncHandler(async (req, res) => {
  const { oldLock, newLock } = req.body;

  if (!oldLock || !newLock) {
    throw new ApiError(400, 'Old lock and new lock are required');
  }

  if (newLock.length < 4) {
    throw new ApiError(400, 'New security lock must be at least 4 characters');
  }

  const admin = await Admin.findById(req.user._id);

  if (!admin.securityLockHash) {
    throw new ApiError(400, 'No security lock set. Set one first.');
  }

  const isValid = await admin.compareSecurityLock(oldLock);
  if (!isValid) {
    throw new ApiError(401, 'Invalid old security lock');
  }

  const salt = await bcrypt.genSalt(10);
  admin.securityLockHash = await bcrypt.hash(newLock, salt);
  await admin.save();

  res.json({ success: true, message: 'Security lock changed successfully' });
});

export { setSecurityLock, verifySecurityLock, changeSecurityLock };
