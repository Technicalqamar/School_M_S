import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import Admin from '../models/admin.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';

// Full audience vocabulary for the Communication module (SMS, Notices,
// Notifications). Audience names mirror the Holiday/Event modules; class names
// mirror the Class/Student models so targeting stays consistent with the school
// schema.
//
// `Parents` and `Staff` are retained here for two reasons only and must not be
// treated as supported targets:
//   1. the Notice/Notification model enums still list them so documents that
//      already exist in the database remain valid (nothing is migrated or
//      deleted), and
//   2. SMS is currently DEFERRED/STOPPED and keeps its existing routes, data and
//      resolution behaviour completely untouched.
//
// They are NOT selectable in the Notices/Notifications creation or edit UI, and
// the API rejects them - see SUPPORTED_COMMUNICATION_AUDIENCES below.
const COMMUNICATION_AUDIENCES = ['All', 'Students', 'Teachers', 'Parents', 'Staff'];

// The audiences a Notice or Notification can actually be addressed to today.
// There is no Parent Portal and no Staff Portal in this system, so `Parents`
// and `Staff` notices/notifications reach nobody; the School only operates the
// Admin Panel, the Student Portal and the Teacher Panel. Kept as a separate
// constant (instead of trimming COMMUNICATION_AUDIENCES) so the SMS module keeps
// its existing behaviour while Notices/Notifications are aligned to the
// audiences that are genuinely supported.
const SUPPORTED_COMMUNICATION_AUDIENCES = ['All', 'Students', 'Teachers'];
const COMMUNICATION_CLASSES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];
const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();
  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear).trim();
  }
  return String(new Date().getFullYear());
};

// Resolves an optional academic year value from the request; falls back to the
// school's current academic year when the caller omits it.
const resolveAcademicYear = async (value) => {
  if (value === undefined || value === null || !String(value).trim()) {
    return getCurrentAcademicYear();
  }
  const year = String(value).trim();
  if (!ACADEMIC_YEAR_REGEX.test(year)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  return year;
};

// Same class-membership filter used by Class/Teacher services: a student
// belongs to a class when their current record matches, or their enrollments
// history contains an Active/Historical enrollment for that class+year.
const classMembershipFilter = (className, academicYear) => ({
  $or: [
    { class: className, academicYear, enrollments: { $exists: false } },
    { class: className, academicYear, enrollments: { $size: 0 } },
    {
      enrollments: {
        $elemMatch: {
          academicYear,
          class: className,
          status: { $in: ['Active', 'Historical'] },
        },
      },
    },
  ],
});

const assertNoClassNamesForAudience = (audience, classNames) => {
  if (classNames && classNames.length && audience !== 'Students' && audience !== 'Parents' && audience !== 'All') {
    throw new ApiError(400, `Class-based targeting is only supported for Students, Parents or All audiences`);
  }
};

// Resolves the phone targets for an SMS composition. Real records only — the
// recipient list is read from the live Student/Teacher/Admin collections for
// the resolved academic year.
const resolveSmsRecipients = async ({ audience, classNames = [], academicYear }) => {
  const year = await resolveAcademicYear(academicYear);
  assertNoClassNamesForAudience(audience, classNames);

  const recipients = [];
  const includeStudents = audience === 'All' || audience === 'Students' || audience === 'Parents';
  const includeTeachers = audience === 'All' || audience === 'Teachers';
  const includeStaff = audience === 'All' || audience === 'Staff';

  if (includeStudents) {
    const filter = { status: 'Active', academicYear: year };
    if (classNames && classNames.length) {
      filter.$or = classNames.flatMap((className) => classMembershipFilter(className, year).$or);
    }

    const students = await Student.find(filter)
      .select('fullName fatherPhone alternatePhone class academicYear')
      .lean();

    const studentRole = audience === 'Students' ? 'Student' : 'Parent';
    for (const student of students) {
      const phone = student.fatherPhone || (student.alternatePhone || '').trim();
      if (!phone) continue;
      recipients.push({
        name: student.fullName,
        phone,
        role: studentRole,
        className: student.class || null,
      });
    }
  }

  if (includeTeachers) {
    const teachers = await Teacher.find({ status: 'Active', academicYear: year })
      .select('fullName phoneNumber academicYear')
      .lean();

    for (const teacher of teachers) {
      if (!teacher.phoneNumber || !teacher.phoneNumber.trim()) continue;
      recipients.push({
        name: teacher.fullName,
        phone: teacher.phoneNumber.trim(),
        role: 'Teacher',
        className: null,
      });
    }
  }

  if (includeStaff) {
    const staff = await Admin.find({ role: 'admin', isActive: true })
      .select('fullName phone')
      .lean();

    for (const member of staff) {
      if (!member.phone || !member.phone.trim()) continue;
      recipients.push({
        name: member.fullName,
        phone: member.phone.trim(),
        role: 'Staff',
        className: null,
      });
    }
  }

  return {
    recipients,
    recipientCount: recipients.length,
    academicYear: year,
  };
};

export {
  COMMUNICATION_AUDIENCES,
  SUPPORTED_COMMUNICATION_AUDIENCES,
  COMMUNICATION_CLASSES,
  ACADEMIC_YEAR_REGEX,
  isValidObjectId,
  getCurrentAcademicYear,
  resolveAcademicYear,
  classMembershipFilter,
  assertNoClassNamesForAudience,
  resolveSmsRecipients,
};