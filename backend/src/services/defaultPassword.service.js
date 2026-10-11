import DefaultPasswordSetting from '../models/defaultPasswordSetting.model.js';
import AuditLog from '../models/auditLog.model.js';
import { ApiError } from '../utils/apiError.js';
import { encryptSecret, decryptSecret } from '../utils/secretCrypto.js';

const ROLES = ['student', 'teacher'];
const MIN_LENGTH = 6;
const MAX_LENGTH = 128;

const assertPassword = (value, label) => {
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

// Decrypt one role's stored value. A corrupted or undecryptable payload is
// treated as "not configured" (and logged) so a bad value can never crash the
// Admin settings page or silently leak ciphertext.
const decryptRole = (doc, role) => {
  const encrypted = doc?.[role];
  if (!encrypted || !encrypted.ciphertext) return null;
  try {
    return decryptSecret(encrypted);
  } catch (error) {
    console.error(`Failed to decrypt ${role} default password setting:`, error.message);
    return null;
  }
};

/**
 * Admin-facing read. Returns the currently configured default passwords as
 * plaintext so an authorized Admin can view/update them. Only exposed through
 * the Admin-only route.
 */
const getDefaultPasswords = async () => {
  const doc = await DefaultPasswordSetting.getSettings();
  return {
    student: decryptRole(doc, 'student'),
    teacher: decryptRole(doc, 'teacher'),
  };
};

/**
 * Internal read used by the automatic account-creation flow. Returns the
 * configured plaintext for the role, or null when it has not been set.
 */
const getDefaultPasswordForRole = async (role) => {
  if (!ROLES.includes(role)) {
    throw new ApiError(400, 'Role must be student or teacher');
  }
  const doc = await DefaultPasswordSetting.getSettings();
  return decryptRole(doc, role);
};

/**
 * Create/update the configured default passwords. Only the provided roles are
 * changed; the plaintext is encrypted before persistence and is never logged.
 */
const updateDefaultPasswords = async ({ student, teacher, performedBy = null } = {}) => {
  const provided = [];
  if (student !== undefined) provided.push('student');
  if (teacher !== undefined) provided.push('teacher');

  if (provided.length === 0) {
    throw new ApiError(400, 'Provide a student and/or teacher default password to update');
  }

  assertPassword(student, 'Student default password');
  assertPassword(teacher, 'Teacher default password');

  const doc = await DefaultPasswordSetting.getSettings();

  if (student !== undefined) doc.student = encryptSecret(student);
  if (teacher !== undefined) doc.teacher = encryptSecret(teacher);
  doc.updatedBy = performedBy || null;

  await doc.save();

  if (performedBy) {
    await AuditLog.create({
      action: 'UPDATE',
      module: 'USER',
      entityId: doc.key,
      entityType: 'DefaultPasswordSetting',
      performedBy,
      // Never include the secret itself in the audit trail.
      details: { updatedRoles: provided },
    });
  }

  return {
    student: decryptRole(doc, 'student'),
    teacher: decryptRole(doc, 'teacher'),
  };
};

export default {
  getDefaultPasswords,
  getDefaultPasswordForRole,
  updateDefaultPasswords,
};
