import Student from '../models/student.model.js';
import Class from '../models/class.model.js';
import TimeSlot from '../models/timeSlot.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import TimetableEntry from '../models/timetableEntry.model.js';
import { ApiError } from '../utils/apiError.js';
import portalAccessService from './portalAccess.service.js';

// Student Class Schedule — READ-ONLY backend.
//
// Flow: logged-in student → existing Student record → student's Class →
// Admin Timetable (saved `timetableentries` from the Create Timetable module)
// → that class's timetable only.
//
//   - The class is ALWAYS derived automatically from the authenticated
//     student session. There is no parameter (path or query) that lets a
//     student select another class; an explicit `classId` request is denied.
//   - The day is composed from the same building blocks the Admin Timetable
//     (Designer) uses: the year's Time Slots form the chronological row axis
//     (Period + Break), and the class's saved entries supply the subject and
//     teacher for the teaching slots. Breaks and free periods carry no
//     subject/teacher, exactly like the admin grid.
//   - Only GET-style reads happen here. This service never creates, updates
//     or deletes any document.
//   - Historical Academic Years are only presented when real timetable
//     records exist for that (year, class) — a year without entries returns
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

  throw new ApiError(403, 'Only students can access the student class schedule');
};

// Resolves the student whose class timetable is being requested.
//
// Normal student sessions resolve the student from the authenticated
// account. Administrator-authorized portal access resolves the SELECTED
// student only from the portal access context embedded in the token
// (accessType + accessStudentId); if the authenticated account is itself a
// student account (portal token), it must be linked to the very same selected
// student, so no other student's data can ever be returned.
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

const ENTRY_POPULATE = [
  { path: 'classId', select: 'className academicYear status' },
  { path: 'timeSlotId', select: 'startTime endTime type label academicYear status' },
  { path: 'subjectId', select: 'subjectName subjectCode' },
  { path: 'teacherId', select: 'fullName teacherId email status' },
];

// One row of the student's day. Teaching slots carry the saved subject and
// teacher; break slots carry their break label (break information); teaching
// slots without a saved entry are honest free periods. `timeSlotId` may be
// null when a saved entry references a time slot that no longer exists —
// such entries are skipped so the schedule always reflects real slot data.
const buildRow = (entry, slot, year, className) => {
  const isBreak = slot.type === 'BREAK';
  const scheduled = Boolean(entry);

  return {
    id: scheduled ? String(entry._id) : String(slot._id),
    type: slot.type || 'PERIOD',
    isBreak,
    isScheduled: scheduled,
    timeSlotId: String(slot._id),
    slotLabel: slot.label || '',
    startTime: slot.startTime || null,
    endTime: slot.endTime || null,
    subjectId: scheduled && entry.subjectId ? String(entry.subjectId._id) : null,
    subjectName: scheduled ? entry.subjectId?.subjectName || null : null,
    subjectCode: scheduled ? entry.subjectId?.subjectCode || null : null,
    teacherId: scheduled && entry.teacherId ? String(entry.teacherId._id) : null,
    teacherFullName: scheduled ? entry.teacherId?.fullName || null : null,
    teacherCode: scheduled ? entry.teacherId?.teacherId || null : null,
    className,
    academicYear: year,
  };
};

const getMyClassSchedule = async (user, context = {}, filters = {}) => {
  // A student can never select a class. The class always comes from the
  // authenticated session, so any attempt to target another class is denied
  // outright — this endpoint exposes no such capability.
  if (filters.classId !== undefined && filters.classId !== null && String(filters.classId).trim() !== '') {
    throw new ApiError(403, 'Class selection is not allowed. You can only view your own class timetable.');
  }

  const student = await resolveStudentForRequest(user, context);
  assertActiveStudent(student);

  const year = await resolveAcademicYear(filters.academicYear, student.academicYear);

  // Automatically identify the logged-in student's class from their record.
  let classDoc = null;
  if (student.class) {
    classDoc = await Class.findOne({
      className: student.class,
      academicYear: year,
      isDeleted: { $ne: true },
    })
      .select('className academicYear status')
      .lean();

    // Defensive fallback: some classes may not carry the same academic year
    // label as the student record.
    if (!classDoc) {
      classDoc = await Class.findOne({ className: student.class, isDeleted: { $ne: true } })
        .select('className academicYear status')
        .lean();
    }
  }

  const className = classDoc?.className || student.class || '';
  const timetable = [];

  if (classDoc) {
    const [timeSlots, entryDocs] = await Promise.all([
      TimeSlot.find({ academicYear: year }).lean(),
      TimetableEntry.find({ academicYear: year, classId: classDoc._id })
        .populate(ENTRY_POPULATE)
        .lean(),
    ]);

    timeSlots.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

    // A schedule is only presented when real timetable records exist for this
    // (year, class). Empty/missing years return an honest empty schedule —
    // nothing is ever fabricated.
    if (entryDocs.length > 0) {
      const entryBySlot = new Map();
      for (const entry of entryDocs) {
        const slot = entry.timeSlotId;
        if (!slot) continue;
        entryBySlot.set(String(slot._id), entry);
      }

      for (const slot of timeSlots) {
        const entry = entryBySlot.get(String(slot._id));
        if (!slot) continue;
        timetable.push(buildRow(entry, slot, year, className));
      }
    }
  }

  return {
    student: {
      id: student._id,
      studentId: student.studentId,
      fullName: student.fullName,
      className: student.class || '',
      academicYear: student.academicYear || '',
    },
    class: classDoc
      ? { id: String(classDoc._id), className: classDoc.className, academicYear: classDoc.academicYear }
      : null,
    academicYear: year,
    timetable,
  };
};

export default {
  getMyClassSchedule,
};