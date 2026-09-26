import { ApiError } from '../utils/apiError.js';
import mongoose from 'mongoose';

const validateCreateAccount = (req, res, next) => {
  const { role, referenceId, password, email, phone, isActive } = req.body;

  if (!['student', 'teacher'].includes(role)) {
    throw new ApiError(400, 'Role must be student or teacher');
  }

  if (!referenceId) {
    throw new ApiError(400, 'Reference ID is required');
  }
  if (!mongoose.Types.ObjectId.isValid(referenceId)) {
    throw new ApiError(400, 'Invalid reference ID');
  }

  if (!password || password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  if (email !== undefined && email !== '' && email !== null) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'Invalid email format');
    }
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw new ApiError(400, 'isActive must be a boolean');
  }

  next();
};

const validateUpdateAccount = (req, res, next) => {
  const { email, phone, isActive } = req.body;

  if (email !== undefined) {
    if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'Invalid email format');
    }
  }

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw new ApiError(400, 'isActive must be a boolean');
  }

  next();
};

const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ID format');
  }
  next();
};

const validateStatusUpdate = (req, res, next) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    throw new ApiError(400, 'isActive must be a boolean value');
  }
  next();
};

const validatePasswordUpdate = (req, res, next) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }
  next();
};

const validateRoleParam = (req, res, next) => {
  const { role } = req.params;
  if (!['student', 'teacher'].includes(role)) {
    throw new ApiError(400, 'Role must be student or teacher');
  }
  next();
};

export {
  validateCreateAccount,
  validateUpdateAccount,
  validateObjectId,
  validateStatusUpdate,
  validatePasswordUpdate,
  validateRoleParam,
};
