import { ApiError } from '../utils/apiError.js';

const MIN_LENGTH = 6;
const MAX_LENGTH = 128;

const checkPassword = (value, label) => {
  if (value === undefined) return;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, `${label} must be a non-empty string`);
  }
  if (value.length < MIN_LENGTH) {
    throw new ApiError(400, `${label} must be at least ${MIN_LENGTH} characters`);
  }
  if (value.length > MAX_LENGTH) {
    throw new ApiError(400, `${label} must be at most ${MAX_LENGTH} characters`);
  }
};

const validateUpdateDefaultPasswords = (req, res, next) => {
  const { student, teacher, receptionist } = req.body || {};

  if (student === undefined && teacher === undefined && receptionist === undefined) {
    throw new ApiError(400, 'Provide a student, teacher and/or receptionist default password to update');
  }

  checkPassword(student, 'Student default password');
  checkPassword(teacher, 'Teacher default password');
  checkPassword(receptionist, 'Receptionist default password');

  next();
};

export { validateUpdateDefaultPasswords };
