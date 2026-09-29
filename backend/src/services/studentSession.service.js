import Student from '../models/student.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import portalAccessService from './portalAccess.service.js';

// Shared Student Portal session helpers.
//
// The authenticated student behind every Student Portal request is resolved
// here, and ONLY here, so no new portal route can accidentally target another
// student's data:
//
//   - Normal student sessions resolve the student from the authenticated
//     account (UserAccount/admin-collection record linked to a Student).
//   - Administrator-authorized portal access resolves the SELECTED student
//     from the portal access context embedded in the token (accessType +
//     accessStudentId). If the authenticated account is itself a student
//     account (portal token), it must be linked to the very same selected
//     student, so no other student's data can ever be returned.
//
// The academic year comes from the student's own enrolment, falling back to
// the existing central/default system source (school settings) — never from a
// hard-coded value.

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

// Central/default academic year straight from school settings (never hard-coded).
const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear).trim();
  }

  return String(new Date().getFullYear());
};

const resolveAcademicYear = async (value, studentAcademicYear) => {
  // No year requested → the student's enrolled year, falling back to the
  // existing central/default system source.
  if (value === undefined || value === null || !String(value).trim()) {
    if (studentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(studentAcademicYear))) {
      return String(studentAcademicYear).trim();
    }
    return getCurrentAcademicYear();
  }

  const year = String(value).trim();
  if (!ACADEMIC_YEAR_REGEX.test(year)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  return year;
};

const resolveStudent = async (user) => {
  if (user.referenceId && user.referenceModel === 'Student') {
    const student = await Student.findById(user.referenceId);
    if (!student) {
      throw new ApiError(404, 'Linked student profile not found');
    }
    return student;
  }

  if (user.role === 'student') {
    const student = user.referenceId
      ? await Student.findById(user.referenceId)
      : await Student.findOne({ studentId: user.loginId || user.studentId });
    if (!student) {
      throw new ApiError(404, 'Student profile not found');
    }
    return student;
  }

  throw new ApiError(403, 'Only students can access student portal resources');
};

const resolveStudentForRequest = async (user, context = {}) => {
  if (context.accessType === portalAccessService.ACCESS_TYPE) {
    if (user?.role === 'student' && user.referenceId && user.referenceModel === 'Student') {
      const linked = await Student.findById(user.referenceId);
      if (!linked || (context.accessStudentId && String(linked.studentId) !== String(context.accessStudentId))) {
        throw new ApiError(403, 'Portal access could not be verified for this student');
      }
      return linked;
    }

    if (context.accessStudentId) {
      const selected = await Student.findOne({ studentId: context.accessStudentId });
      if (!selected) {
        throw new ApiError(404, 'Selected student not found');
      }
      return selected;
    }

    throw new ApiError(403, 'Portal access could not be verified for this student');
  }

  return resolveStudent(user);
};

const assertActiveStudent = (student) => {
  if (String(student.status).toLowerCase() !== 'active') {
    throw new ApiError(403, 'Your student profile is inactive. Contact the administration.');
  }
};

export default {
  getCurrentAcademicYear,
  resolveAcademicYear,
  resolveStudent,
  resolveStudentForRequest,
  assertActiveStudent,
};