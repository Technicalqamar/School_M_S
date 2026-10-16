import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import Admin from '../models/admin.model.js';
import UserAccount from '../models/userAccount.model.js';
import Receptionist from '../models/receptionist.model.js';

// Portal accounts created automatically with a temporary password must change it
// before using the portal. Until then their access is limited to the exact paths
// needed to complete that flow (fetch session/flag, log out, change password).
// The refresh-token route is public (no `protect`), so it needs no entry here.
//
// These are the FULL request paths (including the `/api/v1` mount prefix) and are
// matched by exact pathname equality only. Matching the raw `req.originalUrl`
// with a substring test let any request that merely *contained* an allow-listed
// fragment - for example `/api/v1/students?x=/auth/me` - slip past the gate,
// because a query string is part of `originalUrl`.
const API_PREFIX = '/api/v1';
const PASSWORD_CHANGE_ALLOWLIST = new Set([
  `${API_PREFIX}/auth/me`,
  `${API_PREFIX}/auth/logout`,
  `${API_PREFIX}/profile/change-password`,
]);

// Tokens issued for admin-authorized portal access (see portalAccess.service) must
// keep working regardless of the flag; Admin sessions are never affected because
// Admin records do not carry `mustChangePassword`.
const PORTAL_ACCESS_TYPE = 'admin_portal_access';

// `req.originalUrl` always carries the query string, while `req.path`/`req.baseUrl`
// shift depending on which router this middleware runs in. Derive the pathname
// from `originalUrl`, discard the query entirely, and normalise a single trailing
// slash so the only thing that can ever satisfy the allow-list is an exact path.
const getRequestPathname = (req) => {
  const rawPath = (req.originalUrl || '').split('?')[0];
  if (rawPath.length > 1 && rawPath.endsWith('/')) {
    return rawPath.slice(0, -1);
  }
  return rawPath;
};

const isPasswordChangePending = (req) =>
  Boolean(req.user) &&
  req.user.mustChangePassword === true &&
  req.accessType !== PORTAL_ACCESS_TYPE &&
  !PASSWORD_CHANGE_ALLOWLIST.has(getRequestPathname(req));

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

    // Attach the Receptionist profile (which owns the permission set) from
    // trusted server-side data. Permission middleware and portal handlers read
    // permissions from here, never from the request payload or JWT claims.
    if (req.user.role === 'receptionist' && req.user.referenceId) {
      req.receptionistProfile = await Receptionist.findById(req.user.referenceId).select(
        'receptionistId status permissions',
      );
    }

    if (isPasswordChangePending(req)) {
      throw new ApiError(
        403,
        'Temporary password must be changed before accessing the portal',
      );
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

export { protect, isPasswordChangePending };
