import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';
import Student from '../models/student.model.js';
import UserAccount from '../models/userAccount.model.js';
import AuditLog from '../models/auditLog.model.js';
import { ApiError } from '../utils/apiError.js';

const ACCESS_TYPE = 'admin_portal_access';
const DEFAULT_EXPIRES_IN = '15m';

const getPortalExpiryMs = () => {
  const raw = process.env.PORTAL_ACCESS_EXPIRES_IN || DEFAULT_EXPIRES_IN;
  const match = String(raw).match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * multipliers[unit];
};

const authorizeStudentPortalAccess = async ({ admin, studentId }) => {
  if (!admin || admin.role !== 'admin') {
    throw new ApiError(403, 'Only administrators can authorize portal access');
  }

  if (!studentId) {
    throw new ApiError(400, 'Student ID is required');
  }

  const student = await Student.findOne({ studentId });
  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  if (student.status !== 'Active') {
    throw new ApiError(403, 'This student\'s profile is inactive and cannot access the portal');
  }

  const account = await UserAccount.findOne({
    referenceModel: 'Student',
    referenceId: student._id,
  });

  if (!account) {
    throw new ApiError(404, 'No portal account is linked to this student. Contact the administration.');
  }

  if (!account.isActive) {
    throw new ApiError(403, 'This student\'s account is deactivated and cannot access the portal');
  }

  const expiresInValue = process.env.PORTAL_ACCESS_EXPIRES_IN || DEFAULT_EXPIRES_IN;
  const expiresInMs = getPortalExpiryMs();

  const portalToken = jwt.sign(
    {
      id: account._id,
      role: 'student',
      accessType: ACCESS_TYPE,
      adminId: admin._id,
      studentId: student.studentId,
      purpose: ACCESS_TYPE,
    },
    process.env.JWT_SECRET,
    { expiresIn: expiresInValue },
  );

  await AuditLog.create({
    action: 'LOGIN',
    module: 'PORTAL',
    entityId: student.studentId,
    entityType: 'Student',
    performedBy: admin._id,
    details: {
      accessType: ACCESS_TYPE,
      purpose: ACCESS_TYPE,
      studentId: student.studentId,
      studentName: student.fullName,
      studentClass: student.class,
      studentAcademicYear: student.academicYear,
      adminId: admin._id,
      adminName: admin.fullName,
      adminEmail: admin.email,
    },
  });

  return {
    portalToken,
    expiresInMs,
    accessType: ACCESS_TYPE,
    user: {
      id: account._id,
      fullName: account.fullName || student.fullName,
      role: 'student',
      studentId: student.studentId,
    },
    student: {
      id: student._id,
      studentId: student.studentId,
      fullName: student.fullName,
      class: student.class,
      academicYear: student.academicYear,
      status: student.status,
      studentImage: student.studentImage,
    },
    admin: {
      id: admin._id,
      fullName: admin.fullName,
      email: admin.email,
    },
  };
};

const getPortalContext = async ({ account, studentId, adminId }) => {
  if (!account || account.role !== 'student') {
    throw new ApiError(403, 'Unauthorized portal access');
  }

  const student = await Student.findById(account.referenceId);
  if (!student) {
    throw new ApiError(404, 'Linked student profile not found');
  }

  if (student.status !== 'Active') {
    throw new ApiError(403, 'This student\'s profile is inactive and cannot access the portal');
  }

  if (student.studentId !== studentId) {
    throw new ApiError(403, 'Portal access could not be verified for this student');
  }

  if (!account.isActive) {
    throw new ApiError(403, 'This student\'s account has been deactivated');
  }

  const admin = adminId ? await Admin.findById(adminId).select('fullName email') : null;

  return {
    accessType: ACCESS_TYPE,
    purpose: ACCESS_TYPE,
    expiresInMs: getPortalExpiryMs(),
    student: {
      id: student._id,
      studentId: student.studentId,
      fullName: student.fullName,
      class: student.class,
      academicYear: student.academicYear,
      status: student.status,
      studentImage: student.studentImage,
      fatherName: student.fatherName,
      gender: student.gender,
    },
    account: {
      id: account._id,
      isActive: account.isActive,
      lastLogin: account.lastLogin || null,
      lastLogout: account.lastLogout || null,
    },
    admin: admin
      ? {
          id: admin._id,
          fullName: admin.fullName,
          email: admin.email,
        }
      : null,
  };
};

const endPortalAccess = async ({ payload }) => {
  if (!payload || payload.accessType !== ACCESS_TYPE) {
    throw new ApiError(403, 'Invalid portal access session');
  }

  if (payload.studentId) {
    const student = await Student.findOne({ studentId: payload.studentId });
    if (student) {
      await UserAccount.updateOne(
        { referenceModel: 'Student', referenceId: student._id },
        { $set: { lastLogout: new Date() } }
      );
    }
  }

  await AuditLog.create({
    action: 'LOGOUT',
    module: 'PORTAL',
    entityId: payload.studentId,
    entityType: 'Student',
    performedBy: payload.adminId,
    details: {
      accessType: ACCESS_TYPE,
      purpose: ACCESS_TYPE,
      studentId: payload.studentId,
      adminId: payload.adminId,
      endedAt: new Date(),
    },
  });

  return true;
};

export default {
  authorizeStudentPortalAccess,
  getPortalContext,
  endPortalAccess,
  ACCESS_TYPE,
};