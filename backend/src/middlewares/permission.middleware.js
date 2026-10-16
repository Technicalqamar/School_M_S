import { ApiError } from '../utils/apiError.js';
import { hasModuleOrPageAccess, hasActionAccess } from '../constants/permissions.js';

// Server-side authorization for Receptionist access to the shared Admin
// modules.
//
// The receptionist's permission set is attached to the request by the `protect`
// middleware from trusted server-side data (`req.receptionistProfile`), never
// from anything the client submits. A missing grant is denied by default;
// holding a `module:<key>` key opens the whole module, holding a
// `page:<module>:<page>` key opens exactly that page, and holding an
// `action:<module>:<action>` key opens exactly that operation. Granting one
// module never implies another.
//
// Admins bypass the check so the Admin panel keeps the same handlers, and
// non-receptionist portal roles are rejected outright. Every route that a
// receptionist may legitimately use is guarded by this middleware; everything
// else stays `authorize('admin')`-only so a direct URL/API call cannot bypass
// the permission model.

const requireRoleForPermissionCheck = (req) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authorized');
  }

  if (req.user.role === 'admin') {
    return null;
  }

  if (req.user.role !== 'receptionist') {
    throw new ApiError(403, 'Role is not allowed to access this resource');
  }

  return Array.isArray(req.receptionistProfile?.permissions)
    ? req.receptionistProfile.permissions
    : [];
};

const requireModuleAccess = (moduleKey, pageKey = null) => {
  return (req, res, next) => {
    const permissions = requireRoleForPermissionCheck(req);
    if (permissions === null) {
      return next();
    }

    if (!hasModuleOrPageAccess(permissions, moduleKey, pageKey)) {
      throw new ApiError(403, 'You do not have permission to access this module');
    }

    return next();
  };
};

// Granular action-level guard. Gating is exactly `hasActionAccess`: the whole
// module, the exact action key, or one of the action's `impliedByPages` grants
// it (plus the narrow cross-module read dependencies). Every mutation and every
// non-trivial read on receptionist-facing endpoints is gated this way so a page
// grant can never silently open unrelated work.
const requireActionAccess = (moduleKey, actionKey) => {
  return (req, res, next) => {
    const permissions = requireRoleForPermissionCheck(req);
    if (permissions === null) {
      return next();
    }

    if (!hasActionAccess(permissions, moduleKey, actionKey)) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }

    return next();
  };
};

// Non-middleware form of `requireActionAccess`, for handlers whose required
// action is only known at runtime (e.g. the shared QR-scan endpoint, where the
// action depends on whether the scanned card belongs to a student or a teacher).
// It performs the exact same role resolution as the middleware - Admins bypass,
// Receptionists are checked against their stored grants, and every other role is
// rejected - so authorization can never drift between the two entry points.
const userHasActionAccess = (req, moduleKey, actionKey) => {
  const permissions = requireRoleForPermissionCheck(req);
  if (permissions === null) {
    return true;
  }

  return hasActionAccess(permissions, moduleKey, actionKey);
};

// Guard that admits an actor holding ANY of the listed actions. Used by endpoints
// whose exact action is only known after the request is inspected by the handler
// (the shared QR-scan route); it still fails closed for roles that may not use
// the endpoint at all, keeping the permission check ahead of body validation.
const requireAnyActionAccess = (moduleKey, actionKeys) => {
  return (req, res, next) => {
    const permissions = requireRoleForPermissionCheck(req);
    if (permissions === null) {
      return next();
    }

    const allowed = actionKeys.some((actionKey) => hasActionAccess(permissions, moduleKey, actionKey));
    if (!allowed) {
      throw new ApiError(403, 'You do not have permission to perform this action');
    }

    return next();
  };
};

export { requireModuleAccess, requireActionAccess, userHasActionAccess, requireAnyActionAccess };