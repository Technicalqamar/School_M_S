import Teacher from '../models/teacher.model.js';
import Admin from '../models/admin.model.js';
import Student from '../models/student.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import { getTeacherScope } from './teacherScope.service.js';

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

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }

  return String(new Date().getFullYear());
};

const resolveTeacherProfile = async (user) => {
  if (user.referenceId && user.referenceModel === 'Teacher') {
    const teacher = await Teacher.findById(user.referenceId);
    if (!teacher) {
      throw new ApiError(404, 'Linked teacher profile not found');
    }
    return teacher;
  }

  if (user.role === 'teacher') {
    const teacher = await Admin.findById(user._id).select('assignedSubjects teacherId fullName status');
    if (!teacher) {
      throw new ApiError(404, 'Teacher profile not found');
    }
    return teacher;
  }

  throw new ApiError(403, 'Only teachers can access their classes');
};

const getMyClasses = async (user) => {
  const teacher = await resolveTeacherProfile(user);

  if (teacher.status !== 'Active') {
    throw new ApiError(403, 'Your teacher profile is inactive. Contact the administration.');
  }

  const academicYear = await getCurrentAcademicYear();

  const scope = await getTeacherScope(teacher, academicYear);

  if (scope.length === 0) {
    return { classes: [] };
  }

  const classesResult = await Promise.all(
    scope.map(async (entry) => {
      const studentCount = await Student.countDocuments(classMembershipFilter(entry.className, entry.academicYear));

      return {
        classId: entry.classId,
        className: entry.className,
        academicYear: entry.academicYear,
        status: entry.status,
        subjects: entry.subjects,
        totalStudents: studentCount,
      };
    }),
  );

  return { classes: classesResult };
};

export default { getMyClasses };