import mongoose from 'mongoose';
import Receptionist from '../models/receptionist.model.js';
import UserAccount from '../models/userAccount.model.js';
import AuditLog from '../models/auditLog.model.js';
import { ApiError } from '../utils/apiError.js';
import {
  DEFAULT_RECEPTIONIST_PERMISSIONS,
  sanitizePermissions,
} from '../constants/permissions.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;

// Public shape of a receptionist returned to the Admin UI. Never includes the
// password hash or any secret.
const formatReceptionist = (receptionist, account = null) => ({
  id: receptionist._id,
  receptionistId: receptionist.receptionistId,
  fullName: receptionist.fullName,
  email: receptionist.email || '',
  phone: receptionist.phone || '',
  status: receptionist.status,
  isActive: account ? account.isActive : receptionist.status === 'Active',
  permissions: Array.isArray(receptionist.permissions) ? receptionist.permissions : [],
  lastLogin: account ? account.lastLogin || null : null,
  mustChangePassword: account ? account.mustChangePassword === true : false,
  createdAt: receptionist.createdAt,
  updatedAt: receptionist.updatedAt,
});

const logAudit = async (action, receptionist, performedBy, details = {}) => {
  if (!performedBy) return;
  await AuditLog.create({
    action,
    module: 'USER',
    entityId: receptionist.receptionistId,
    entityType: 'Receptionist',
    performedBy,
    details: {
      receptionistId: receptionist.receptionistId,
      fullName: receptionist.fullName,
      ...details,
    },
  });
};

const findAccount = (receptionistId) =>
  UserAccount.findOne({ referenceId: receptionistId, referenceModel: 'Receptionist' });

/**
 * Create a Receptionist profile and its linked login account.
 *
 * The Admin supplies both the Receptionist ID (loginId) and the initial
 * password explicitly - there is no default-password flow and no auto
 * generation. The loginId must be unique (validated here against existing
 * profiles; the UserAccount `loginId` unique index is a second line of
 * defence). The password is hashed by the UserAccount model and the plaintext
 * is never logged, persisted or returned after creation. Receptionist accounts
 * do not use the `mustChangePassword` first-login flow: they log in directly
 * with the Admin-assigned password.
 */
const createReceptionist = async (data, performedBy = null) => {
  const fullName = (data.fullName || '').trim();
  if (!fullName || fullName.length < 3 || fullName.length > 100) {
    throw new ApiError(400, 'Full name must be between 3 and 100 characters');
  }

  const receptionistId = (data.receptionistId || '').trim();
  if (!receptionistId) {
    throw new ApiError(400, 'Receptionist ID (login ID) is required');
  }
  if (receptionistId.length > 50) {
    throw new ApiError(400, 'Receptionist ID must be at most 50 characters');
  }
  const existing = await Receptionist.findOne({ receptionistId });
  if (existing) {
    throw new ApiError(409, 'This Receptionist ID is already in use. Choose a unique login ID.');
  }

  const password = typeof data.password === 'string' ? data.password : '';
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError(
      400,
      `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
    );
  }

  const permissions = sanitizePermissions(
    Array.isArray(data.permissions) ? data.permissions : DEFAULT_RECEPTIONIST_PERMISSIONS,
  );

  let receptionist = null;
  try {
    receptionist = await Receptionist.create({
      receptionistId,
      fullName,
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim(),
      status: data.isActive === false ? 'Inactive' : 'Active',
      permissions,
      createdBy: performedBy || null,
    });

    const account = await UserAccount.create({
      loginId: receptionistId,
      role: 'receptionist',
      referenceId: receptionist._id,
      referenceModel: 'Receptionist',
      password,
      email: receptionist.email || undefined,
      phone: receptionist.phone || undefined,
      fullName: receptionist.fullName,
      isActive: receptionist.status === 'Active',
      mustChangePassword: false,
    });

    await logAudit('CREATE', receptionist, performedBy, { permissions });

    return {
      receptionist: formatReceptionist(receptionist, account),
    };
  } catch (error) {
    // Compensate so a failed account creation never leaves an orphaned profile.
    if (receptionist) {
      await Receptionist.deleteOne({ _id: receptionist._id }).catch(() => {});
    }
    throw error;
  }
};

const getReceptionists = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};
  if (query.status === 'Active' || query.status === 'Inactive') {
    filter.status = query.status;
  }
  if (query.search) {
    const pattern = new RegExp(escapeRegex(String(query.search).trim()), 'i');
    filter.$or = [{ fullName: pattern }, { receptionistId: pattern }, { email: pattern }, { phone: pattern }];
  }

  const [receptionists, total] = await Promise.all([
    Receptionist.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Receptionist.countDocuments(filter),
  ]);

  const accounts = await UserAccount.find({
    referenceModel: 'Receptionist',
    referenceId: { $in: receptionists.map((r) => r._id) },
  });
  const accountByRef = new Map(accounts.map((a) => [String(a.referenceId), a]));

  return {
    receptionists: receptionists.map((r) => formatReceptionist(r, accountByRef.get(String(r._id)))),
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};

const getReceptionistById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid receptionist ID');
  }
  const receptionist = await Receptionist.findById(id);
  if (!receptionist) {
    throw new ApiError(404, 'Receptionist not found');
  }
  return formatReceptionist(receptionist, await findAccount(receptionist._id));
};

const updateReceptionist = async (id, data, performedBy = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid receptionist ID');
  }
  const receptionist = await Receptionist.findById(id);
  if (!receptionist) {
    throw new ApiError(404, 'Receptionist not found');
  }

  // receptionistId is the login ID: it is immutable after creation so the
  // linked account's loginId stays in sync and audit history stays coherent.
  if (data.receptionistId !== undefined && String(data.receptionistId).trim() !== receptionist.receptionistId) {
    throw new ApiError(400, 'Receptionist ID cannot be changed after creation');
  }

  if (data.fullName !== undefined) {
    const fullName = (data.fullName || '').trim();
    if (fullName.length < 3 || fullName.length > 100) {
      throw new ApiError(400, 'Full name must be between 3 and 100 characters');
    }
    receptionist.fullName = fullName;
  }
  if (data.email !== undefined) receptionist.email = (data.email || '').trim();
  if (data.phone !== undefined) receptionist.phone = (data.phone || '').trim();
  if (data.permissions !== undefined) {
    receptionist.permissions = sanitizePermissions(data.permissions);
  }

  await receptionist.save();

  const account = await findAccount(receptionist._id);
  if (account) {
    account.fullName = receptionist.fullName;
    account.email = receptionist.email || undefined;
    account.phone = receptionist.phone || undefined;
    await account.save();
  }

  await logAudit('UPDATE', receptionist, performedBy);

  return formatReceptionist(receptionist, account);
};

const updateReceptionistStatus = async (id, isActive, performedBy = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid receptionist ID');
  }
  const receptionist = await Receptionist.findById(id);
  if (!receptionist) {
    throw new ApiError(404, 'Receptionist not found');
  }

  const status = isActive ? 'Active' : 'Inactive';
  receptionist.status = status;
  await receptionist.save();

  const account = await findAccount(receptionist._id);
  if (account) {
    account.isActive = Boolean(isActive);
    await account.save();
  }

  await logAudit('UPDATE', receptionist, performedBy, { status });

  return formatReceptionist(receptionist, account);
};

const updateReceptionistPermissions = async (id, permissions, performedBy = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid receptionist ID');
  }
  if (!Array.isArray(permissions)) {
    throw new ApiError(400, 'Permissions must be an array');
  }
  const receptionist = await Receptionist.findById(id);
  if (!receptionist) {
    throw new ApiError(404, 'Receptionist not found');
  }

  receptionist.permissions = sanitizePermissions(permissions);
  await receptionist.save();

  await logAudit('UPDATE', receptionist, performedBy, { permissions: receptionist.permissions });

  return formatReceptionist(receptionist, await findAccount(receptionist._id));
};

// Admin-only password reset for a forgotten receptionist password. Used by the
// Receptionist Management module; the route is mounted behind
// `protect + authorize('admin')`, and the service performs its own role check
// so the operation can never be invoked by a Receptionist (including their own
// account). The new password is hashed by the UserAccount model on save; the
// plaintext and the hash are never returned or logged. Following the
// receptionist creation convention (they log in directly with the
// Admin-assigned password, with no must-change-password first-login flow), the
// reset clears `mustChangePassword` so the next login works with the new
// password immediately.
const resetReceptionistPassword = async (id, newPassword, performedBy = null, performerRole = null) => {
  if (performerRole !== 'admin') {
    throw new ApiError(403, 'Only an Admin can reset a receptionist password');
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid receptionist ID');
  }
  const receptionist = await Receptionist.findById(id);
  if (!receptionist) {
    throw new ApiError(404, 'Receptionist not found');
  }

  const password = typeof newPassword === 'string' ? newPassword : '';
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError(
      400,
      `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
    );
  }

  const account = await findAccount(receptionist._id);
  if (!account) {
    throw new ApiError(404, 'Receptionist login account not found');
  }

  account.password = password;
  account.mustChangePassword = false;
  await account.save();

  await logAudit('UPDATE', receptionist, performedBy, { resetPassword: true });

  return formatReceptionist(receptionist, account);
};

const deleteReceptionist = async (id, performedBy = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid receptionist ID');
  }
  const receptionist = await Receptionist.findById(id);
  if (!receptionist) {
    throw new ApiError(404, 'Receptionist not found');
  }

  await Promise.all([
    UserAccount.deleteOne({ referenceId: receptionist._id, referenceModel: 'Receptionist' }),
    Receptionist.deleteOne({ _id: receptionist._id }),
  ]);

  await logAudit('DELETE', receptionist, performedBy);

  return { receptionistId: receptionist.receptionistId };
};

export default {
  createReceptionist,
  getReceptionists,
  getReceptionistById,
  updateReceptionist,
  updateReceptionistStatus,
  updateReceptionistPermissions,
  resetReceptionistPassword,
  deleteReceptionist,
};