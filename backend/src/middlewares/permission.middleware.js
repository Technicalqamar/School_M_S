import { ApiError } from '../utils/apiError.js';
import { buildKey } from '../constants/permissions.js';

// Server-side authorization for Receptionist operations.
//
// The receptionist's permission set is attached to the request by the `protect`
// middleware from trusted server-side data (`req.receptionistProfile`), never
// from anything the client submits. A missing permission is denied by default;
// holding one action (e.g. `students.view`) never implies another
// (e.g. `students.create`).
//
// Admins bypass the check so the Admin panel can reuse the same handlers, and
// non-receptionist portal roles are rejected outright.
const requirePermission = (moduleKey, actionKey) => {
  const required = buildKey(moduleKey, actionKey);

  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Not authorized');
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role !== 'receptionist') {
      throw new ApiError(403, 'Role is not allowed to access this resource');
    }

    const permissions = Array.isArray(req.receptionistProfile?.permissions)
      ? req.receptionistProfile.permissions
      : [];

    if (!permissions.includes(required)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }

    return next();
  };
};

export { requirePermission };
