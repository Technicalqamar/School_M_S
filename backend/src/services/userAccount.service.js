import mongoose from 'mongoose';
import UserAccount from '../models/userAccount.model.js';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import Receptionist from '../models/receptionist.model.js';
import AuditLog from '../models/auditLog.model.js';
import { ApiError } from '../utils/apiError.js';
import bcrypt from 'bcryptjs';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getProfileModel = (role) => (role === 'student' ? Student : Teacher);

// All three portal roles resolve through their linked profile. Receptionist has
// its own profile document so the shared listing helpers stay correct.
const PROFILE_MODELS = {
  student: Student,
  teacher: Teacher,
  receptionist: Receptionist,
};

const resolveProfile = async (account) => {
  const Model = PROFILE_MODELS[account.role];
  if (!Model) return null;
  const profile = await Model.findById(account.referenceId).lean();
  return profile || null;
};

const buildAccountResponse = (account, profile = null) => {
  const isStudent = account.role === 'student';
  const isTeacher = account.role === 'teacher';
  const profileId = isStudent
    ? profile?.studentId
    : isTeacher
      ? profile?.teacherId
      : profile?.receptionistId;

  return {
    id: account._id,
    loginId: account.loginId,
    role: account.role,
    referenceId: account.referenceId,
    referenceModel: account.referenceModel,
    fullName: account.fullName || profile?.fullName || '',
    email: account.email || '',
    phone: account.phone || '',
    profileImage: account.profileImage || profile?.studentImage || profile?.teacherImage || '',
    accountStatus: account.isActive ? 'Active' : 'Inactive',
    isActive: account.isActive,
    profileStatus: profile ? profile.status : 'Unknown',
    profileId,
    lastLogin: account.lastLogin || null,
    lastLogout: account.lastLogout || null,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    profile: profile || null,
  };
};

const logAudit = async (action, account, performedBy) => {
  if (!performedBy) return;
  await AuditLog.create({
    action,
    module: 'USER',
    entityId: account.loginId,
    entityType: 'UserAccount',
    performedBy,
    details: {
      loginId: account.loginId,
      role: account.role,
      referenceModel: account.referenceModel,
    },
  });
};

const sanitizeAccount = (doc) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password;
  return obj;
};

// Only an Admin may operate on Receptionist account records. A receptionist who
// holds User Accounts module access may manage Student/Teacher accounts, but can
// never view, modify, activate/deactivate, delete or reset a receptionist
// account (including their own). Those operations remain Admin-only, enforced
// server-side regardless of what the UI shows.
const assertReceptionistAccountManageable = (account, performerRole) => {
  if (performerRole && performerRole !== 'admin' && account.role === 'receptionist') {
    throw new ApiError(403, 'Receptionist accounts can only be managed by an Administrator');
  }
};

/**
 * Core account builder shared by the manual admin flow and automatic creation
 * triggered when a new Student/Teacher profile is created. It rejects the
 * manual `createAccount` duplication while keeping identical duplicate checks,
 * password hashing (model pre-save), reference linkage, and audit behavior.
 */
const buildAccountForProfile = async ({
  role,
  profile,
  password,
  performedBy = null,
  fields = {},
  mustChangePassword = false,
}) => {
  if (!profile || profile._id == null) {
    throw new ApiError(400, 'Linked profile is required to create an account');
  }

  const referenceModel = role === 'student' ? 'Student' : 'Teacher';
  const loginId = role === 'student' ? profile.studentId : profile.teacherId;
  if (!loginId) {
    throw new ApiError(400, `${role === 'student' ? 'Student' : 'Teacher'} ID is not available for this record`);
  }

  const [existingByLoginId, existingByRef] = await Promise.all([
    UserAccount.findOne({ loginId }),
    UserAccount.findOne({ referenceId: profile._id, referenceModel }),
  ]);

  if (existingByLoginId || existingByRef) {
    throw new ApiError(409, 'An account already exists for this Student/Teacher');
  }

  if (!password || password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  const account = await UserAccount.create({
    loginId,
    role,
    referenceId: profile._id,
    referenceModel,
    password,
    email: profile.email || undefined,
    phone: (role === 'student' ? profile.fatherPhone : profile.phoneNumber) || undefined,
    fullName: profile.fullName,
    profileImage: (role === 'student' ? profile.studentImage : profile.teacherImage) || undefined,
    profileImagePublicId: (role === 'student' ? profile.studentImagePublicId : profile.teacherImagePublicId) || undefined,
    isActive: true,
    mustChangePassword,
    ...fields,
  });

  await logAudit('CREATE', account, performedBy);

  return account;
};

const createAccount = async (data, performedBy) => {
  const { role, referenceId, password, email, phone, fullName, profileImage, profileImagePublicId, isActive } = data;

  if (!['student', 'teacher'].includes(role)) {
    throw new ApiError(400, 'Role must be student or teacher');
  }

  if (!mongoose.Types.ObjectId.isValid(referenceId)) {
    throw new ApiError(400, 'Invalid reference ID');
  }

  const Model = getProfileModel(role);
  const profile = await Model.findById(referenceId);
  if (!profile) {
    throw new ApiError(404, `${role === 'student' ? 'Student' : 'Teacher'} not found`);
  }

  const account = await buildAccountForProfile({
    role,
    profile,
    password,
    performedBy,
    fields: {
      email: email || undefined,
      phone: phone || undefined,
      fullName: fullName || profile.fullName,
      profileImage: profileImage || undefined,
      profileImagePublicId: profileImagePublicId || undefined,
      isActive: isActive !== undefined ? isActive : true,
    },
  });

  const fresh = await UserAccount.findById(account._id);
  const resolvedProfile = await resolveProfile(fresh);
  return buildAccountResponse(fresh, resolvedProfile);
};

/**
 * Create a portal account from a freshly created Student/Teacher profile.
 * Used automatically by the student/teacher creation services. The caller is
 * responsible for resolving the configured default password and returning it
 * once to the creator.
 */
const createAccountForProfile = async ({ role, profile, password, performedBy = null, mustChangePassword = true }) => {
  if (!['student', 'teacher'].includes(role)) {
    throw new ApiError(400, 'Role must be student or teacher');
  }

  return buildAccountForProfile({
    role,
    profile,
    password,
    performedBy,
    mustChangePassword,
    fields: {},
  });
};

/**
 * Remove the portal account linked to a profile. Used as part of compensating
 * cleanup when automatic account creation fails after a profile was inserted.
 */
const deleteAccountForProfile = async ({ role, profileId }) => {
  const referenceModel = role === 'student' ? 'Student' : 'Teacher';
  const account = await UserAccount.findOne({ referenceId: profileId, referenceModel });
  if (!account) return false;
  await UserAccount.deleteOne({ _id: account._id });
  return true;
};

const getAllAccounts = async (query) => {
  const { page: rawPage, limit: rawLimit, search, role, accountStatus, profileStatus } = query;

  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};
  if (role && role !== 'all') {
    filter.role = role;
  } else {
    // The generic account listing covers the Student/Teacher portals only.
    // Receptionist accounts are managed in their own dedicated section, so they
    // never appear here (and cannot be edited/deleted through this page).
    filter.role = { $in: ['student', 'teacher'] };
  }
  if (accountStatus) {
    if (accountStatus === 'Active') filter.isActive = true;
    else if (accountStatus === 'Inactive') filter.isActive = false;
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ loginId: pattern }, { fullName: pattern }];
  }

  const [rawAccounts, totalAccounts] = await Promise.all([
    UserAccount.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    UserAccount.countDocuments(filter),
  ]);

  const accounts = await Promise.all(
    rawAccounts.map(async (acc) => {
      const profile = await resolveProfile(acc);
      return buildAccountResponse(acc, profile);
    }),
  );

  let results = accounts;
  if (profileStatus) {
    results = accounts.filter((a) => a.profileStatus === profileStatus);
  }

  return {
    accounts: results,
    totalAccounts: profileStatus ? results.length : totalAccounts,
    totalPages: profileStatus ? Math.ceil(results.length / limit) : Math.ceil(totalAccounts / limit),
    currentPage: page,
  };
};

const getAccountById = async (accountId, performerRole = null) => {
  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    throw new ApiError(400, 'Invalid account ID');
  }
  const account = await UserAccount.findById(accountId);
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  assertReceptionistAccountManageable(account, performerRole);
  const profile = await resolveProfile(account);
  return buildAccountResponse(account, profile);
};

const updateAccount = async (accountId, data, performedBy, performerRole = null) => {
  const account = await UserAccount.findById(accountId);
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  assertReceptionistAccountManageable(account, performerRole);

  const allowed = ['email', 'phone', 'fullName', 'profileImage', 'profileImagePublicId', 'isActive'];

  for (const key of Object.keys(data)) {
    if (allowed.includes(key)) {
      account[key] = data[key];
    }
  }

  await account.save();
  await logAudit('UPDATE', account, performedBy);

  const profile = await resolveProfile(account);
  return buildAccountResponse(account, profile);
};

const updateAccountStatus = async (accountId, isActive, performedBy, performerRole = null) => {
  const account = await UserAccount.findById(accountId);
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  assertReceptionistAccountManageable(account, performerRole);

  const newStatus = Boolean(isActive);
  if (account.isActive === newStatus) {
    return buildAccountResponse(account, await resolveProfile(account));
  }

  account.isActive = newStatus;
  await account.save();

  await logAudit('UPDATE', account, performedBy);

  const profile = await resolveProfile(account);
  return buildAccountResponse(account, profile);
};

const updatePassword = async (accountId, newPassword, performedBy, performerRole = null) => {
  if (!newPassword || newPassword.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }
  const account = await UserAccount.findById(accountId);
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  assertReceptionistAccountManageable(account, performerRole);

  account.password = newPassword;
  // Reset by an admin requires the user to set a new password on next login.
  account.mustChangePassword = true;
  await account.save();

  await logAudit('UPDATE', account, performedBy);
  return true;
};

const deleteAccount = async (accountId, performedBy, performerRole = null) => {
  const account = await UserAccount.findById(accountId);
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }
  assertReceptionistAccountManageable(account, performerRole);

  await UserAccount.deleteOne({ _id: account._id });
  await logAudit('DELETE', account, performedBy);

  return { loginId: account.loginId, role: account.role };
};

const getAvailableProfiles = async (role, search = '') => {
  if (!['student', 'teacher'].includes(role)) {
    throw new ApiError(400, 'Role must be student or teacher');
  }

  const Model = getProfileModel(role);
  const filter = { status: 'Active' };

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ fullName: pattern }];
    if (role === 'student') {
      filter.$or.push({ studentId: pattern }, { fatherName: pattern });
    } else {
      filter.$or.push({ teacherId: pattern });
    }
  }

  const profiles = await Model.find(filter).limit(50).sort({ createdAt: -1 }).lean();

  const existing = await UserAccount.find({
    role,
    referenceModel: role === 'student' ? 'Student' : 'Teacher',
  }).select('referenceId');

  const existingRefIds = new Set(existing.map((e) => String(e.referenceId)));

  const available = profiles.filter((p) => !existingRefIds.has(String(p._id)));

  return available.map((p) => ({
    _id: p._id,
    fullName: p.fullName,
    profileId: role === 'student' ? p.studentId : p.teacherId,
    status: p.status,
  }));
};

export default {
  createAccount,
  createAccountForProfile,
  deleteAccountForProfile,
  getAllAccounts,
  getAccountById,
  updateAccount,
  updateAccountStatus,
  updatePassword,
  deleteAccount,
  getAvailableProfiles,
  buildAccountResponse,
  resolveProfile,
  sanitizeAccount,
};
