import Teacher from '../models/teacher.model.js';
import Admin from '../models/admin.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';

// Shared Teacher Portal session helpers.
//
// The authenticated teacher behind every Teacher Portal request is resolved
// here so no new portal route can accidentally target another teacher's data:
//
//   - Normal teacher portal accounts are UserAccounts linked to a Teacher
//     profile via (referenceId, referenceModel = 'Teacher').
//   - Legacy/edge case: a teacher-role Admin account links to its Teacher
//     profile through `referenceId` or (falling back) its `teacherId` teacher
//     code. It is never derived from anything the client sends.
//
// The academic year comes from the teacher's own profile, falling back to the
// existing central/default system source (school settings) — never from a
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

const resolveAcademicYear = async (value, teacherAcademicYear) => {
  // No year requested → the teacher's enrolled year, falling back to the
  // existing central/default system source.
  if (value === undefined || value === null || !String(value).trim()) {
    if (teacherAcademicYear && ACADEMIC_YEAR_REGEX.test(String(teacherAcademicYear))) {
      return String(teacherAcademicYear).trim();
    }
    return getCurrentAcademicYear();
  }

  const year = String(value).trim();
  if (!ACADEMIC_YEAR_REGEX.test(year)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  return year;
};

const resolveTeacher = async (user) => {
  if (user.referenceId && user.referenceModel === 'Teacher') {
    const teacher = await Teacher.findById(user.referenceId);
    if (!teacher) {
      throw new ApiError(404, 'Linked teacher profile not found');
    }
    return teacher;
  }

  if (user.role === 'teacher') {
    const admin = await Admin.findById(user._id).select('teacherId referenceId status fullName');
    if (!admin) {
      throw new ApiError(404, 'Teacher profile not found');
    }

    let teacher = null;
    if (admin.referenceId) {
      teacher = await Teacher.findById(admin.referenceId);
    }
    if (!teacher && admin.teacherId) {
      teacher = await Teacher.findOne({ teacherId: admin.teacherId });
    }
    if (!teacher) {
      throw new ApiError(404, 'Linked teacher profile not found');
    }
    return teacher;
  }

  throw new ApiError(403, 'Only teachers can access teacher portal resources');
};

const assertActiveTeacher = (teacher) => {
  if (String(teacher.status).toLowerCase() !== 'active') {
    throw new ApiError(403, 'Your teacher profile is inactive. Contact the administration.');
  }
};

export default {
  getCurrentAcademicYear,
  resolveAcademicYear,
  resolveTeacher,
  assertActiveTeacher,
};