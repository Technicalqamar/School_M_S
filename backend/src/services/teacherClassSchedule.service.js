import TimeSlot from '../models/timeSlot.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import TimetableEntry from '../models/timetableEntry.model.js';
import Teacher from '../models/teacher.model.js';
import Admin from '../models/admin.model.js';
import { ApiError } from '../utils/apiError.js';

// Teacher Class Schedule — READ-ONLY backend.
//
// Flow: logged-in teacher → existing Teacher profile → Admin Timetable
// (saved `timetableentries` from the Create Timetable module) → the rows of
// that teacher only.
//
//   - The teacher is ALWAYS derived automatically from the authenticated
//     session. There is no parameter (path or query) that lets a teacher
//     select another teacher; explicit `teacherId`/`classId` requests are
//     denied outright, so one teacher can never see another teacher's
//     schedule.
//   - The Admin Timetable is NOT day-wise: `timetableentries` have no
//     Monday–Sunday / date axis. One entry = one (class, time slot, subject)
//     booking for the academic year, and the timetable is a single reusable
//     daily grid built from Time Slots (Periods + Breaks). This service
//     therefore returns the teacher's own saved entries exactly ONCE each —
//     it never fabricates days or repeats the same record on a weekday axis.
//   - Each returned row carries the real Time Slot data (slot label, start
//     time, end time, PERIOD/BREAK type) plus the real Class and Subject of
//     the saved entry. Periods the teacher is not booked for are simply not
//     present in the list.
//   - Only GET-style reads happen here. This service never creates, updates
//     or deletes any document.
//   - Historical Academic Years are only presented when real timetable
//     records exist for that (year, teacher) — a year without entries returns
//     an honest empty schedule, never a fabricated one.

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

// Central/default academic year straight from school settings (never hard-coded).
const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear).trim();
  }

  return String(new Date().getFullYear());
};

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

// Resolves the Teacher document behind the authenticated account.
//
// Normal teacher portal accounts are UserAccounts linked to a Teacher profile
// via (referenceId, referenceModel = 'Teacher').
//
// Legacy/edge case: a teacher-role Admin account links to its Teacher profile
// through `referenceId` or (falling back) its `teacherId` teacher code. It is
// never derived from anything the client sends.
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

  throw new ApiError(403, 'Only teachers can access their class schedule');
};

const assertActiveTeacher = (teacher) => {
  if (String(teacher.status).toLowerCase() !== 'active') {
    throw new ApiError(403, 'Your teacher profile is inactive. Contact the administration.');
  }
};

const ENTRY_POPULATE = [
  { path: 'classId', select: 'className academicYear status' },
  { path: 'timeSlotId', select: 'startTime endTime type label academicYear status' },
  { path: 'subjectId', select: 'subjectName subjectCode' },
  { path: 'teacherId', select: 'fullName teacherId email status' },
];

// One row of the teacher's schedule = one REAL saved timetable entry with its
// real Time Slot attached. The timetable has no day axis, so a record appears
// exactly once — never repeated on a weekday grid. `timeSlotId` may be null
// when a saved entry references a time slot that no longer exists; such
// entries are skipped so the schedule always reflects real slot data.
const buildRow = (entry, slot, year) => {
  const isBreak = slot.type === 'BREAK';

  return {
    id: String(entry._id),
    entryId: String(entry._id),
    academicYear: year,
    type: slot.type || 'PERIOD',
    isBreak,
    isScheduled: true,
    timeSlotId: String(slot._id),
    slotLabel: slot.label || '',
    startTime: slot.startTime || null,
    endTime: slot.endTime || null,
    slotStatus: slot.status || null,
    classId: entry.classId ? String(entry.classId._id) : null,
    className: entry.classId?.className || null,
    classStatus: entry.classId?.status || null,
    subjectId: entry.subjectId ? String(entry.subjectId._id) : null,
    subjectName: entry.subjectId?.subjectName || null,
    subjectCode: entry.subjectId?.subjectCode || null,
    teacherId: entry.teacherId ? String(entry.teacherId._id) : null,
    teacherFullName: entry.teacherId?.fullName || null,
    teacherCode: entry.teacherId?.teacherId || null,
  };
};

const getMyClassSchedule = async (user, filters = {}) => {
  // A teacher can never select another teacher (or a class) to view. The
  // teacher always comes from the authenticated session, so any attempt to
  // target another teacher's schedule is denied outright — this endpoint
  // exposes no such capability.
  if (filters.teacherId !== undefined && filters.teacherId !== null && String(filters.teacherId).trim() !== '') {
    throw new ApiError(403, 'Teacher selection is not allowed. You can only view your own class schedule.');
  }

  if (filters.classId !== undefined && filters.classId !== null && String(filters.classId).trim() !== '') {
    throw new ApiError(403, 'Class selection is not allowed. You can only view your own class schedule.');
  }

  const year = await resolveAcademicYear(filters.academicYear);
  const teacher = await resolveTeacher(user);
  assertActiveTeacher(teacher);

  const entryDocs = await TimetableEntry.find({ academicYear: year, teacherId: teacher._id })
    .populate(ENTRY_POPULATE)
    .lean();

  // The teacher's booked periods, in chronological order. Each saved entry is
  // a real (class, time slot, subject) record and appears exactly once. The
  // Admin Timetable has no weekday axis, so no days are generated here.
  const timetable = entryDocs
    .filter((entry) => entry.timeSlotId)
    .sort((a, b) => String(a.timeSlotId.startTime).localeCompare(String(b.timeSlotId.startTime)))
    .map((entry) => buildRow(entry, entry.timeSlotId, year));

  return {
    teacher: {
      id: String(teacher._id),
      teacherId: teacher.teacherId || '',
      fullName: teacher.fullName || '',
    },
    academicYear: year,
    timetable,
  };
};

export default {
  getMyClassSchedule,
};