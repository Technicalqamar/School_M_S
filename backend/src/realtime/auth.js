import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';
import UserAccount from '../models/userAccount.model.js';
import Receptionist from '../models/receptionist.model.js';
import { hasActionAccess } from '../constants/permissions.js';
import {
  NOTIFICATION_RECIPIENT_ROLES,
  NOTIFICATION_CATEGORY_VALUES,
  NOTIFICATION_CATEGORY_PERMISSION_ACTIONS,
} from '../constants/notification.constants.js';

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO handshake authentication.
//
// Mirrors the REST `protect` middleware exactly:
//   • the same JWT secret and token payload (`id`);
//   • the same lookup order (Admin first, then portal UserAccount);
//   • Receptionist permissions read from the profile in the database, never
//     from the token or the client.
//
// The client only ever supplies a token. Role, user id and room membership are
// derived here from trusted server-side data, so a client can never widen its
// own access.
// ─────────────────────────────────────────────────────────────────────────────

const PORTAL_ACCESS_TYPE = 'admin_portal_access';
const NOTIFICATION_BELL_MODULE = 'notification-bell';

const unauthorized = (message) => {
  const error = new Error(message || 'Not authorized');
  error.data = { code: 'unauthorized' };
  return error;
};

// Accepts the token from the standard Socket.IO handshake locations, in the
// same order the frontend will use it.
const extractToken = (socket) => {
  const fromAuth = socket?.handshake?.auth?.token;
  if (fromAuth && String(fromAuth).trim()) return String(fromAuth).trim();

  const header = socket?.handshake?.headers?.authorization;
  if (header && header.startsWith('Bearer ')) {
    const value = header.slice(7).trim();
    if (value) return value;
  }

  const fromQuery = socket?.handshake?.query?.token;
  if (fromQuery && String(fromQuery).trim()) return String(fromQuery).trim();

  return null;
};

// Verifies the JWT only. Pure and side-effect free so it can be unit tested
// without a database connection.
const verifyToken = (token) => {
  if (!token) throw unauthorized('Not authorized, no token');
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error?.name === 'TokenExpiredError') throw unauthorized('Token expired');
    if (error?.name === 'JsonWebTokenError') throw unauthorized('Invalid token');
    throw unauthorized('Not authorized');
  }
};

// Resolves the notification-bell categories a receptionist is allowed to
// receive, from the permission set stored on their profile.
const resolveReceptionistCategories = (permissions) => {
  const categories = [];
  for (const category of NOTIFICATION_CATEGORY_VALUES) {
    const actionKey = NOTIFICATION_CATEGORY_PERMISSION_ACTIONS[category];
    if (actionKey && hasActionAccess(permissions, NOTIFICATION_BELL_MODULE, actionKey)) {
      categories.push(category);
    }
  }
  return categories;
};

// Loads the authenticated principal and the rooms it may join, from the
// database. Throws an error with `data.code === 'unauthorized'` on any failure.
const resolveSocketPrincipal = async (decoded) => {
  if (!decoded || !decoded.id) throw unauthorized('Invalid token payload');

  let account = await Admin.findById(decoded.id).select('_id role isActive');
  let fromAdmin = Boolean(account);

  if (!account) {
    account = await UserAccount.findById(decoded.id).select(
      '_id role isActive referenceId referenceModel mustChangePassword',
    );
  }

  if (!account) throw unauthorized('Account not found');
  if (account.isActive === false) throw unauthorized('Account is inactive');

  const accessType = decoded.accessType || null;

  // Parity with `protect`: a portal account still on its temporary password may
  // not use the portal, unless the token is an admin-authorized portal access.
  if (
    !fromAdmin &&
    account.mustChangePassword === true &&
    accessType !== PORTAL_ACCESS_TYPE
  ) {
    throw unauthorized('Temporary password must be changed before accessing the portal');
  }

  // Identity matches the Notification Engine's `recipient.user` / `readBy`:
  // Admin records are the admin principal; portal accounts use their own _id.
  const role = fromAdmin ? NOTIFICATION_RECIPIENT_ROLES.ADMIN : account.role;
  const principal = {
    role,
    userId: account._id,
    profileId: fromAdmin ? account._id : (account.referenceId || null),
    profileModel: fromAdmin ? 'Admin' : (account.referenceModel || null),
    accessType,
    permissions: [],
    categories: [],
  };

  if (role === NOTIFICATION_RECIPIENT_ROLES.RECEPTIONIST) {
    if (!account.referenceId) throw unauthorized('Receptionist profile not found');
    const profile = await Receptionist.findById(account.referenceId).select(
      'receptionistId status permissions',
    );
    if (!profile || profile.status !== 'Active') {
      throw unauthorized('Receptionist profile is inactive');
    }
    principal.permissions = Array.isArray(profile.permissions) ? profile.permissions : [];
    principal.categories = resolveReceptionistCategories(principal.permissions);
  }

  return principal;
};

// Socket.IO middleware. Rejects the handshake (never reaches a room) when the
// token is missing, invalid or expired, or the principal cannot be resolved.
const socketAuthMiddleware = async (socket, next) => {
  try {
    const decoded = verifyToken(extractToken(socket));
    const principal = await resolveSocketPrincipal(decoded);
    socket.data.principal = principal;
    return next();
  } catch (error) {
    if (error?.data?.code === 'unauthorized') return next(error);
    return next(unauthorized('Not authorized'));
  }
};

export {
  PORTAL_ACCESS_TYPE,
  extractToken,
  verifyToken,
  resolveReceptionistCategories,
  resolveSocketPrincipal,
  socketAuthMiddleware,
};

export default {
  extractToken,
  verifyToken,
  resolveReceptionistCategories,
  resolveSocketPrincipal,
  socketAuthMiddleware,
};
