import TimetableEntry from '../models/timetableEntry.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import teacherSession from './teacherSession.service.js';
import studentAttendanceService from './studentAttendance.service.js';

// Teacher Manual Student Attendance — permission-gated backend.
//
// Teachers may manually mark student attendance ONLY when the existing School
// Settings → Attendance Settings flag "Teacher Manual Student Attendance" is
// ON (default OFF). When OFF every one of these endpoints is denied (403) and
// the teacher still keeps their own attendance + leave access.
//
// The responsible class is NEVER chosen by the teacher: it is derived
// automatically from the existing Admin Timetable (`timetableentries`). The
// timetable has no day/date axis — one entry = one (class, time slot, subject)
// booking for the academic year — so "the teacher's first scheduled period"
// means the earliest Time Slot start time among the teacher's saved PERIOD
// entries for the year. The class of that first period is the attendance class.
//
//   - The teacher is ALWAYS resolved from the authenticated session.
//   - `classId` / `className` / `class` / `teacherId` / `teacher` selectors
//     are denied outright (403) — the frontend is never trusted for
//     authorization.
//   - Saving is delegated to the existing Student Attendance service, so the
//     standard rules apply unchanged: student IDs are validated against the
//     derived class + year, weekend/holiday/event/time/late/edit rules,
//     leave-marking setting and duplicate protection are all preserved.
//   - If the timetable changes, the responsible class automatically follows
//     the updated entries on every request (no caching, no stored copy).

const { resolveTeacher, resolveAcademicYear, assertActiveTeacher } = teacherSession;

const ENTRY_POPULATE = [
  { path: 'classId', select: 'className status' },
  { path: 'timeSlotId', select: 'startTime endTime type label status' },
  { path: 'subjectId', select: 'subjectName subjectCode' },
];

const VALID_STATUSES = ['Present', 'Absent', 'Late', 'Leave'];

const isManualStudentAttendanceOn = async () => {
  const settings = await SchoolSettings.getSettings();
  return settings.teacherManualStudentAttendance === true;
};

const assertManualAccess = async () => {
  const enabled = await isManualStudentAttendanceOn();
  if (!enabled) {
    throw new ApiError(
      403,
      'Teacher Manual Student Attendance is currently disabled in School Settings. Only your own attendance and leave are available.',
    );
  }
};

const rejectTargetingSelectors = (payload, message) => {
  for (const key of ['teacherId', 'teacher', 'classId', 'class', 'className', 'studentId']) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      throw new ApiError(403, `${key} targeting is not allowed. ${message}`);
    }
  }
};

// Responsible class = the class of the teacher's FIRST scheduled period in the
// existing Admin Timetable for the academic year. Only real PERIOD entries with
// a valid time slot and a real class are considered; BREAK slots never carry a
// teaching class and are skipped. Entries are ordered by the real slot start
// time, so the earliest period of the day wins.
const deriveResponsibleClass = async (teacher, year) => {
  const entries = await TimetableEntry.find({ academicYear: year, teacherId: teacher._id })
    .populate(ENTRY_POPULATE)
    .lean();

  const periods = entries
    .filter((entry) => entry.timeSlotId && entry.classId && entry.timeSlotId.type !== 'BREAK')
    .sort((a, b) => String(a.timeSlotId.startTime).localeCompare(String(b.timeSlotId.startTime)));

  const first = periods[0] || null;

  if (!first) {
    return null;
  }

  return {
    entryId: String(first._id),
    classId: String(first.classId._id),
    className: first.classId.className || '',
    classStatus: first.classId.status || null,
    subjectId: first.subjectId ? String(first.subjectId._id) : null,
    subjectName: first.subjectId?.subjectName || '',
    slotLabel: first.timeSlotId.label || '',
    startTime: first.timeSlotId.startTime || null,
    endTime: first.timeSlotId.endTime || null,
  };
};

const getResponsibleClass = async (user, filters = {}) => {
  rejectTargetingSelectors(filters, 'Your class is always derived from your timetable.');

  await assertManualAccess();

  const teacher = await resolveTeacher(user);
  assertActiveTeacher(teacher);

  const year = await resolveAcademicYear(filters.academicYear, teacher.academicYear);
  const responsibleClass = await deriveResponsibleClass(teacher, year);

  return {
    enabled: true,
    academicYear: year,
    responsibleClass,
  };
};

const getClassStudents = async (user, filters = {}) => {
  rejectTargetingSelectors(filters, 'Students are always derived from your timetable class.');

  await assertManualAccess();

  const teacher = await resolveTeacher(user);
  assertActiveTeacher(teacher);

  const year = await resolveAcademicYear(filters.academicYear, teacher.academicYear);
  const responsibleClass = await deriveResponsibleClass(teacher, year);

  if (!responsibleClass) {
    throw new ApiError(
      404,
      'No timetable period found for you in this academic year. Contact the administration to assign your class in the timetable.',
    );
  }

  const date = filters.date || new Date().toISOString().split('T')[0];
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new ApiError(400, 'Invalid date format');
  }

  // Delegates to the existing Student Attendance "students + attendance map"
  // loader for the derived class only — a real attendee must belong to that
  // class in the current academic year.
  const result = await studentAttendanceService.getStudentsWithAttendance(year, responsibleClass.className, date);

  return {
    enabled: true,
    academicYear: year,
    class: {
      classId: responsibleClass.classId,
      className: responsibleClass.className,
      period: {
        slotLabel: responsibleClass.slotLabel,
        startTime: responsibleClass.startTime,
        endTime: responsibleClass.endTime,
        subjectName: responsibleClass.subjectName,
      },
    },
    date,
    students: result.students,
    attendanceMap: result.attendanceMap,
  };
};

const saveStudentAttendance = async (user, data = {}, userId) => {
  rejectTargetingSelectors(data, 'Attendance is only allowed for your timetable-derived class.');

  await assertManualAccess();

  const teacher = await resolveTeacher(user);
  assertActiveTeacher(teacher);

  const year = await resolveAcademicYear(data.academicYear, teacher.academicYear);
  const responsibleClass = await deriveResponsibleClass(teacher, year);

  if (!responsibleClass) {
    throw new ApiError(
      404,
      'No timetable period found for you in this academic year. Contact the administration to assign your class in the timetable.',
    );
  }

  if (!data.date || !String(data.date).trim()) {
    throw new ApiError(400, 'Attendance date is required');
  }

  const records = data.records;
  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'At least one student attendance record is required');
  }

  // The same statuses the Admin Student Attendance module accepts. Validated
  // here because the mark flow is reached through this service (not the admin
  // express validation) and the existing service does not validate statuses.
  for (const record of records) {
    if (!record || !record.student) {
      throw new ApiError(400, 'Student reference is required for each record');
    }
    if (!record.status || !VALID_STATUSES.includes(record.status)) {
      throw new ApiError(400, `Invalid status '${record.status}'. Allowed: ${VALID_STATUSES.join(', ')}`);
    }
    if (record.method && !['Manual', 'QR'].includes(record.method)) {
      throw new ApiError(400, `Invalid method '${record.method}'. Allowed: Manual, QR`);
    }
    if (record.remarks !== undefined && record.remarks !== null && typeof record.remarks !== 'string') {
      throw new ApiError(400, 'Remarks must be a string');
    }
  }

  // Delegates to the EXISTING Student Attendance rules: student IDs are checked
  // against the derived class + academic year, and weekend / holiday / event /
  // time / late / edit rules, the leave-marking setting and duplicate
  // protection all apply unchanged.
  const result = await studentAttendanceService.saveAttendance(
    {
      academicYear: year,
      class: responsibleClass.className,
      date: String(data.date).trim(),
      records,
    },
    userId,
  );

  return {
    ...result,
    class: {
      classId: responsibleClass.classId,
      className: responsibleClass.className,
      period: {
        slotLabel: responsibleClass.slotLabel,
        startTime: responsibleClass.startTime,
        endTime: responsibleClass.endTime,
        subjectName: responsibleClass.subjectName,
      },
    },
  };
};

export default {
  getResponsibleClass,
  getClassStudents,
  saveStudentAttendance,
};