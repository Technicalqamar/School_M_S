import Teacher from '../models/teacher.model.js';
import Student from '../models/student.model.js';
import Admin from '../models/admin.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import { getTeacherScope } from './teacherScope.service.js';
import teacherClassScheduleService from './teacherClassSchedule.service.js';

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

  throw new ApiError(403, 'Only teachers can access the teacher dashboard');
};

const getTeacherDashboardData = async (user) => {
  const teacher = await resolveTeacherProfile(user);

  if (teacher.status !== 'Active') {
    throw new ApiError(403, 'Your teacher profile is inactive. Contact the administration.');
  }

  const academicYear = await getCurrentAcademicYear();

  const scope = await getTeacherScope(teacher, academicYear);

  const myClasses = [];

  if (scope.length > 0) {
    const classStudentCounts = await Promise.all(
      scope.map(async (entry) => {
        const count = await Student.countDocuments(classMembershipFilter(entry.className, entry.academicYear));
        return { className: entry.className, count };
      }),
    );

    const studentCountByClass = new Map(classStudentCounts.map((row) => [row.className, row.count]));

    for (const entry of scope) {
      const studentCount = studentCountByClass.get(entry.className) || 0;

      for (const subject of entry.subjects) {
        myClasses.push({
          classId: entry.classId,
          className: entry.className,
          subject: subject.subjectName,
          subjectCode: subject.subjectCode || '',
          totalStudents: studentCount,
        });
      }
    }
  }

  // Today's Classes come from the REAL teacher timetable — the completed
  // TimetableEntry-based Admin Timetable system, i.e. the exact same source
  // the Teacher Class Schedule page uses. That timetable stores no day/date,
  // so each saved period appears EXACTLY once, in chronological order, with
  // its real Time Slot (period), class, subject and start/end times — no
  // Monday/Tuesday/Today labels are ever generated.
  const schedule = await teacherClassScheduleService.getMyClassSchedule(user);

  const todayClasses = (schedule.timetable || [])
    .filter((row) => row.isScheduled && !row.isBreak)
    .map((row) => ({
      period: row.slotLabel || '',
      className: row.className || '',
      subject: row.subjectName || '',
      startTime: row.startTime || null,
      endTime: row.endTime || null,
    }));

  todayClasses.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

  const distinctClassCounts = new Map();
  for (const row of myClasses) {
    const classId = String(row.classId);
    if (!distinctClassCounts.has(classId)) {
      distinctClassCounts.set(classId, row.totalStudents);
    }
  }

  return {
    statistics: {
      myClasses: distinctClassCounts.size,
      myStudents: [...distinctClassCounts.values()].reduce((sum, count) => sum + count, 0),
      todayClasses: todayClasses.length,
      pendingHomework: 0,
    },
    myClasses,
    todayClasses,
    upcomingHomework: [],
  };
};

export default { getTeacherDashboardData };