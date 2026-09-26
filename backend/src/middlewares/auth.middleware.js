import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import Admin from '../models/admin.model.js';
import UserAccount from '../models/userAccount.model.js';

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Not authorized, no token');
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw new ApiError(401, 'Not authorized, no token');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.accessType = decoded.accessType || null;
    req.accessAdminId = decoded.adminId || null;
    req.accessStudentId = decoded.studentId || null;

    req.user = await Admin.findById(decoded.id).select('-password');
    if (!req.user) {
      req.user = await UserAccount.findById(decoded.id).select('-password');
    }

    if (!req.user) {
      throw new ApiError(401, 'Account not found');
    }

    return next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token');
    }
    throw new ApiError(401, 'Not authorized');
  }
});

export { protect };
