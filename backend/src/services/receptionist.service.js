import mongoose from 'mongoose';
import Receptionist from '../models/receptionist.model.js';
import UserAccount from '../models/userAccount.model.js';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import Class from '../models/class.model.js';
import AuditLog from '../models/auditLog.model.js';
import { ApiError } from '../utils/apiError.js';
import defaultPasswordService from './defaultPassword.service.js';
import studentService from './student.service.js';
import {
  DEFAULT_RECEPTIONIST_PERMISSIONS,
  sanitizePermissions,
} from '../constants/permissions.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Public shape of a receptionist returned to the Admin UI. Never includes the
// password hash, encrypted default-password material or any secret.
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
 * Create a Receptionist profile and its linked login account. The initial
 * password comes from the Admin-configured Receptionist Default Password (the
 * same configurable system used for students/teachers) and is hashed by the
 * UserAccount model. The plaintext is returned once so the Admin can hand it
 * over; it is never logged or persisted in plaintext.
 */
const createReceptionist = async (data, performedBy = null) => {
  const fullName = (data.fullName || '').trim();
  if (fullName.length < 3 || fullName.length > 100) {
    throw new ApiError(400, 'Full name must be between 3 and 100 characters');
  }

  const password = await defaultPasswordService.getDefaultPasswordForRole('receptionist');
  if (!password) {
    throw new ApiError(
      400,
      'Receptionist default password is not configured. Set it in User Accounts before creating receptionist accounts.',
    );
  }

  const permissions = sanitizePermissions(
    Array.isArray(data.permissions) ? data.permissions : DEFAULT_RECEPTIONIST_PERMISSIONS,
  );

  let receptionist = null;
  try {
    receptionist = await Receptionist.create({
      fullName,
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim(),
      status: data.isActive === false ? 'Inactive' : 'Active',
      permissions,
      createdBy: performedBy || null,
    });

    const account = await UserAccount.create({
      loginId: receptionist.receptionistId,
      role: 'receptionist',
      referenceId: receptionist._id,
      referenceModel: 'Receptionist',
      password,
      email: receptionist.email || undefined,
      phone: receptionist.phone || undefined,
      fullName: receptionist.fullName,
      isActive: receptionist.status === 'Active',
      mustChangePassword: true,
    });

    await logAudit('CREATE', receptionist, performedBy, { permissions });

    return {
      receptionist: formatReceptionist(receptionist, account),
      temporaryCredentials: {
        loginId: receptionist.receptionistId,
        password,
      },
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

const resetReceptionistPassword = async (id, newPassword, performedBy = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid receptionist ID');
  }
  if (!newPassword || newPassword.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }
  const receptionist = await Receptionist.findById(id);
  if (!receptionist) {
    throw new ApiError(404, 'Receptionist not found');
  }
  const account = await findAccount(receptionist._id);
  if (!account) {
    throw new ApiError(404, 'Linked account not found');
  }

  account.password = newPassword;
  // An Admin reset always forces the receptionist to set a new password on the
  // next login.
  account.mustChangePassword = true;
  await account.save();

  await logAudit('UPDATE', receptionist, performedBy, { passwordReset: true });

  return true;
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

/**
 * Genuine aggregate counts for the Receptionist dashboard. No fabricated
 * statistics: every figure is read from the database.
 */
const getPortalDashboard = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [students, activeStudents, teachers, classes, newAdmissions, recentStudents] = await Promise.all([
    Student.countDocuments(),
    Student.countDocuments({ status: 'Active' }),
    Teacher.countDocuments(),
    Class.countDocuments(),
    Student.countDocuments({ admissionDate: { $gte: monthStart, $lt: monthEnd } }),
    Student.find().sort({ createdAt: -1 }).limit(5).select('studentId fullName class status').lean(),
  ]);

  return {
    statistics: {
      totalStudents: students,
      activeStudents,
      totalTeachers: teachers,
      totalClasses: classes,
      newAdmissions,
      month: MONTHS[now.getMonth()],
    },
    recentStudents: recentStudents.map((student) => ({
      studentId: student.studentId,
      fullName: student.fullName,
      class: student.class,
      status: student.status,
    })),
  };
};

const getPortalStudents = (query) => studentService.getAllStudents(query);

const getPortalStudent = async (studentId) => {
  const student = await studentService.getStudentById(studentId);
  if (!student) {
    throw new ApiError(404, 'Student not found');
  }
  return student;
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
  getPortalDashboard,
  getPortalStudents,
  getPortalStudent,
};
