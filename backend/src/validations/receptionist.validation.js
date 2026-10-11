import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';
import { isValidPermission } from '../constants/permissions.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateOptionalEmail = (email) => {
  if (email === undefined || email === '' || email === null) return;
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    throw new ApiError(400, 'Invalid email format');
  }
};

const validateOptionalString = (value, label, max = 100) => {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    throw new ApiError(400, `${label} must be a string`);
  }
  if (value.length > max) {
    throw new ApiError(400, `${label} must be at most ${max} characters`);
  }
};

const validatePermissions = (permissions) => {
  if (permissions === undefined) return;
  if (!Array.isArray(permissions)) {
    throw new ApiError(400, 'Permissions must be an array');
  }
  if (permissions.some((permission) => !isValidPermission(permission))) {
    throw new ApiError(400, 'One or more permissions are invalid');
  }
};

const validateCreateReceptionist = (req, res, next) => {
  const { fullName, email, phone, isActive, permissions } = req.body || {};

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 3) {
    throw new ApiError(400, 'Full name must be at least 3 characters');
  }
  if (fullName.trim().length > 100) {
    throw new ApiError(400, 'Full name must be at most 100 characters');
  }

  validateOptionalEmail(email);
  validateOptionalString(phone, 'Phone', 20);

  if (isActive !== undefined && typeof isActive !== 'boolean') {
    throw new ApiError(400, 'isActive must be a boolean');
  }

  validatePermissions(permissions);

  next();
};

const validateUpdateReceptionist = (req, res, next) => {
  const { fullName, email, phone, permissions } = req.body || {};

  if (fullName !== undefined) {
    if (typeof fullName !== 'string' || fullName.trim().length < 3) {
      throw new ApiError(400, 'Full name must be at least 3 characters');
    }
    if (fullName.trim().length > 100) {
      throw new ApiError(400, 'Full name must be at most 100 characters');
    }
  }

  validateOptionalEmail(email);
  validateOptionalString(phone, 'Phone', 20);
  validatePermissions(permissions);

  next();
};

const validateUpdatePermissions = (req, res, next) => {
  const { permissions } = req.body || {};
  if (!Array.isArray(permissions)) {
    throw new ApiError(400, 'Permissions must be an array');
  }
  if (permissions.some((permission) => !isValidPermission(permission))) {
    throw new ApiError(400, 'One or more permissions are invalid');
  }
  next();
};

const validateReceptionistStatus = (req, res, next) => {
  const { isActive } = req.body || {};
  if (typeof isActive !== 'boolean') {
    throw new ApiError(400, 'isActive must be a boolean value');
  }
  next();
};

const validateReceptionistPassword = (req, res, next) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }
  next();
};

const validateReceptionistObjectId = (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid ID format');
  }
  next();
};

export {
  validateCreateReceptionist,
  validateUpdateReceptionist,
  validateUpdatePermissions,
  validateReceptionistStatus,
  validateReceptionistPassword,
  validateReceptionistObjectId,
};
