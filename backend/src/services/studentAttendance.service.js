import StudentAttendance from '../models/studentAttendance.model.js';
import Student from '../models/student.model.js';
import IdCardManagement from '../models/idCardManagement.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import attendanceRules from './attendanceRules.service.js';
import leaveService from './leave.service.js';

const VALID_CLASS_NAMES = [
  'Montessori', 'Nursery', 'KG 1', 'KG 2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

const formatTimeStr = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const normalizeAttendanceDate = (value) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const normalized = new Date(parsed);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getDateRangeForQuery = (value) => {
  const start = normalizeAttendanceDate(value);
  if (!start) return null;

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const saveAttendance = async (data, userId) => {
  const { academicYear, class: className, date, records } = data;

  // ── Step 1: Validate Student exists ──────────────────────────────

  const studentFilter = {
    academicYear,
    status: 'Active',
  };

  if (className) {
    studentFilter.class = className;
  }

  const students = await Student.find(studentFilter)
    .select('_id studentId fullName studentImage class academicYear').lean();

  if (students.length === 0) {
    throw new ApiError(404, `No active students found for ${className || 'any class'} in ${academicYear}`);
  }

  const studentClassMap = {};
  students.forEach((s) => {
    studentClassMap[s._id.toString()] = s.class;
  });

  const studentIds = new Set(students.map((s) => s._id.toString()));
  const invalidRecords = records.filter((r) => !studentIds.has(r.student));
  if (invalidRecords.length > 0) {
    throw new ApiError(400, 'Some student IDs do not belong to the selected class and academic year');
  }

  // ── Step 2: Validate Attendance Date ─────────────────────────────

  const attendanceDate = normalizeAttendanceDate(date);
  if (!attendanceDate || Number.isNaN(attendanceDate.getTime())) {
    throw new ApiError(400, 'Invalid attendance date');
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (attendanceDate.getTime() > today.getTime()) {
    throw new ApiError(400, 'Cannot mark attendance for a future date');
  }

  // ── Step 3: Weekend Rule ─────────────────────────────────────────

  const weekendResult = await attendanceRules.checkWeekendPolicy(date);
  if (weekendResult.isWeekend) {
    throw new ApiError(400, `Attendance cannot be marked because today is ${weekendResult.weekendDay} (configured as a weekend day).`);
  }

  // ── Step 4: Holiday Rule ─────────────────────────────────────────

  const holidayResult = await attendanceRules.checkHolidayPolicy(date, { appliesTo: 'Students' });
  if (holidayResult.isHoliday) {
    const holidayNames = holidayResult.holidays.map((h) => h.name).join(', ');
    throw new ApiError(400, `Attendance cannot be marked because today is an official holiday (${holidayNames}).`);
  }

  // ── Step 5: Event Rule + Audience Validation ─────────────────────

  const eventResult = await attendanceRules.checkEventPolicy(date);
  if (eventResult.hasEvent) {
    for (const event of eventResult.events) {
      if (event.attendanceRequired === 'No') {
        throw new ApiError(400,
          `Attendance is disabled because of the event: ${event.name}.`
        );
      }
      if (event.audience && !['All', 'Students'].includes(event.audience)) {
        throw new ApiError(400,
          `Attendance cannot be marked because the event "${event.name}" is restricted to ${event.audience} only. Student attendance is not allowed for this event.`
        );
      }
    }
  }

  // ── Step 5.5: Leave Rule ─────────────────────────────────────────

  const leaveRecords = records.filter((r) => r.status === 'Leave');
  if (leaveRecords.length > 0) {
    const settings = await SchoolSettings.getSettings();
    if (!settings.allowLeaveMarking) {
      throw new ApiError(400,
        'Leave marking is currently disabled in School Settings. Enable "Allow Leave Marking" to use this option.'
      );
    }
  }

  // ── Step 6: Attendance Time Rule ─────────────────────────────────

  const timeResult = await attendanceRules.checkAttendanceTimeRules();
  if (timeResult.phase === 'before-start') {
    throw new ApiError(400, timeResult.message);
  }

  // ── Step 7: Late Rule (per-record) ───────────────────────────────

  const processedRecords = await Promise.all(
    records.map(async (record) => {
      let recordStatus = record.status;

      if (recordStatus === 'Present') {
        const checkInDate = new Date();
        const checkInTimeStr = formatTimeStr(checkInDate);

        if (checkInTimeStr) {
          const lateResult = await attendanceRules.checkLateRule({ checkInTime: checkInTimeStr });
          if (lateResult.isLate) {
            recordStatus = 'Late';
          }
        }
      }

      // After the configured Attendance End Time the window is closed: an entry
      // marked Present is recorded as Late instead (never blocked, never Present).
      if (recordStatus === 'Present' && timeResult.phase === 'after-close') {
        recordStatus = 'Late';
      }

      return { ...record, status: recordStatus };
    }),
  );

  // ── Step 8 & 9: Duplicate protection + Edit rule check ──────────

  const dateRange = getDateRangeForQuery(attendanceDate);
  const existingRecords = await StudentAttendance.find({
    student: { $in: students.map((s) => s._id) },
    date: { $gte: dateRange.start, $lt: dateRange.end },
  }).lean();

  if (existingRecords.length > 0) {
    const editResult = await attendanceRules.checkEditRules(existingRecords[0]);
    if (!editResult.canEdit) {
      throw new ApiError(400, editResult.message);
    }
  }

  // ── Step 10: Save Attendance ─────────────────────────────────────

  const bulkOps = processedRecords.map((record) => ({
    updateOne: {
      filter: {
        student: record.student,
        date: { $gte: dateRange.start, $lt: dateRange.end },
      },
      update: {
        $set: {
          student: record.student,
          class: studentClassMap[record.student] || className,
          academicYear,
          date: attendanceDate,
          status: record.status,
          method: record.method || 'Manual',
          checkIn: record.status !== 'Absent' ? new Date() : undefined,
          remarks: record.remarks || '',
          markedBy: userId,
        },
      },
      upsert: true,
    },
  }));

  await StudentAttendance.bulkWrite(bulkOps);

  const attendanceMap = {};
  processedRecords.forEach((r) => {
    attendanceMap[r.student] = {
      status: r.status,
      method: r.method || 'Manual',
    };
  });

  return {
    academicYear,
    class: className,
    date,
    totalStudents: students.length,
    markedCount: processedRecords.length,
    attendanceMap,
  };
};

const qrScanAttendance = async (data, userId) => {
  const { qrValue, academicYear, className, date } = data || {};

  // ── Step 1: QR Value presence ───────────────────────────────

  if (!qrValue || typeof qrValue !== 'string' || !qrValue.trim()) {
    throw new ApiError(400, 'QR value is required');
  }

  // ── Step 2: Resolve QR value → ID Card → Student ────────────

  const card = await IdCardManagement.findOne({ qrValue: qrValue.trim() }).lean();

  if (!card) {
    throw new ApiError(404, 'Invalid QR code. No student card matches this QR value');
  }

  const student = await Student.findById(card.student).lean();

  if (!student) {
    throw new ApiError(404, 'QR code is not linked to a valid student');
  }

  // ── Step 3: Active student + class + academic year checks ───

  if (student.status !== 'Active') {
    throw new ApiError(
      400,
      `Student ${student.studentId} (${student.fullName}) is not active. Attendance cannot be marked via QR.`,
    );
  }

  if (academicYear && student.academicYear !== academicYear) {
    throw new ApiError(
      400,
      `QR belongs to ${student.fullName} (${student.studentId}) whose academic year is ${student.academicYear}, not ${academicYear}`,
    );
  }

  if (className && className !== 'All Classes' && student.class !== className) {
    throw new ApiError(
      400,
      `QR belongs to ${student.fullName} (${student.studentId}) of class ${student.class}, not ${className}`,
    );
  }

  // ── Step 4: Attendance date (default today) ─────────────────

  const attendanceDate = normalizeAttendanceDate(date || new Date().toISOString().split('T')[0]);

  if (!attendanceDate || isNaN(attendanceDate.getTime())) {
    throw new ApiError(400, 'Invalid attendance date');
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (attendanceDate.getTime() > today.getTime()) {
    throw new ApiError(400, 'Cannot mark attendance for a future date');
  }

  // ── Step 4.5: Attendance Time Rule (used for post-window behavior) ─

  // Read once so the same window state drives both the duplicate-handling below
  // and the final status decision.
  const timeResult = await attendanceRules.checkAttendanceTimeRules();
  const postEndTime = timeResult.phase === 'after-close';

  // ── Step 5: Duplicate prevention (same student + date) ──────

  const qrDateRange = getDateRangeForQuery(attendanceDate);
  const existingRecord = await StudentAttendance.findOne({
    student: student._id,
    date: { $gte: qrDateRange.start, $lt: qrDateRange.end },
  }).lean();

  // After the Attendance End Time an already-absent student who arrives late is
  // updated from Absent to Late instead of being treated as a duplicate.
  const lateArrivalFromAbsent = postEndTime && existingRecord && existingRecord.status === 'Absent';

  if (existingRecord && !lateArrivalFromAbsent) {
    throw new ApiError(
      409,
      `Attendance already marked for ${student.fullName} (${student.studentId}) on ${attendanceDate
        .toISOString()
        .split('T')[0]} with status "${existingRecord.status}" (method: ${existingRecord.method})`,
    );
  }

  // ── Step 6: Apply the same attendance rules as manual flow ──

  const weekendResult = await attendanceRules.checkWeekendPolicy(attendanceDate);
  if (weekendResult.isWeekend) {
    throw new ApiError(
      400,
      `Attendance cannot be marked because ${weekendResult.weekendDay} is configured as a weekend day.`,
    );
  }

  const holidayResult = await attendanceRules.checkHolidayPolicy(attendanceDate, { appliesTo: 'Students' });
  if (holidayResult.isHoliday) {
    const holidayNames = holidayResult.holidays.map((h) => h.name).join(', ');
    throw new ApiError(
      400,
      `Attendance cannot be marked because ${holidayNames} is an official holiday.`,
    );
  }

  const eventResult = await attendanceRules.checkEventPolicy(attendanceDate);
  if (eventResult.hasEvent) {
    for (const event of eventResult.events) {
      if (event.attendanceRequired === 'No') {
        throw new ApiError(
          400,
          `Attendance is disabled because of the event: ${event.name}.`,
        );
      }
      if (event.audience && !['All', 'Students'].includes(event.audience)) {
        throw new ApiError(
          400,
          `Attendance cannot be marked because the event "${event.name}" is restricted to ${event.audience} only. Student attendance is not allowed for this event.`,
        );
      }
    }
  }

  if (timeResult.phase === 'before-start') {
    throw new ApiError(400, timeResult.message);
  }

  // Undefined `postEndTime` is computed in Step 4.5 above and drives the status
  // decision in Step 7. After the Attendance End Time scans are never blocked —
  // they are recorded as Late (an already-absent late arrival is updated to Late).

  // ── Step 7: Late rule (same as manual Present handling) ─────

  const checkInDate = new Date();
  let status;
  if (postEndTime) {
    // Post-window arrival: the window is closed, so do not mark Present; record
    // the arrival as Late regardless of the late-grace rule.
    status = 'Late';
  } else {
    status = 'Present';
    const checkInTimeStr = formatTimeStr(checkInDate);
    if (checkInTimeStr) {
      const lateResult = await attendanceRules.checkLateRule({ checkInTime: checkInTimeStr });
      if (lateResult.isLate) {
        status = 'Late';
      }
    }
  }

  // ── Step 8: Save attendance with method QR ──────────────────

  let record;
  if (lateArrivalFromAbsent) {
    record = await StudentAttendance.findByIdAndUpdate(
      existingRecord._id,
      {
        $set: {
          status: 'Late',
          method: 'QR',
          checkIn: checkInDate,
          remarks: 'Marked via QR scan (late arrival after attendance end time)',
          markedBy: userId,
        },
      },
      { new: true },
    );
  } else {
    record = await StudentAttendance.create({
      student: student._id,
      class: student.class,
      academicYear: student.academicYear,
      date: attendanceDate,
      status,
      method: 'QR',
      checkIn: checkInDate,
      remarks: 'Marked via QR scan',
      markedBy: userId,
    });
  }

  return {
    id: record._id.toString(),
    student: {
      studentId: student.studentId,
      fullName: student.fullName,
      class: student.class,
      academicYear: student.academicYear,
    },
    date: attendanceDate.toISOString().split('T')[0],
    status,
    method: 'QR',
    checkIn: checkInDate,
  };
};

const getStudentsWithAttendance = async (academicYear, className, date) => {
  const studentFilter = {
    academicYear,
    status: 'Active',
  };

  if (className && className !== 'All Classes') {
    studentFilter.class = className;
  }

  const students = await Student.find(studentFilter)
    .select('studentId fullName studentImage class academicYear')
    .sort({ fullName: 1 })
    .lean();

  if (students.length === 0) {
    return { students: [], attendanceMap: {} };
  }

  const attendanceDate = normalizeAttendanceDate(date);
  const studentIds = students.map((s) => s._id);
  const dateRange = getDateRangeForQuery(attendanceDate);

  const attendanceRecords = await StudentAttendance.find({
    student: { $in: studentIds },
    date: { $gte: dateRange.start, $lt: dateRange.end },
  })
    .select('student status checkIn method')
    .lean();

  const attendanceMap = {};
  attendanceRecords.forEach((record) => {
    attendanceMap[record.student.toString()] = {
      status: record.status,
      checkIn: record.checkIn,
      method: record.method,
    };
  });

  // Approved-leave integration: a student with an approved leave covering this
  // date defaults to "Leave" when no attendance record exists yet. Existing
  // marked records (Present/Absent/Late/Leave) always take precedence.
  const leaveCoverage = await leaveService.getApprovedLeaveCoverage({
    type: 'Student',
    personIds: students.map((s) => s._id),
    date: date || attendanceDate.toISOString().split('T')[0],
  });

  students.forEach((student) => {
    const key = student._id.toString();
    if (!attendanceMap[key] && leaveCoverage[key]) {
      attendanceMap[key] = {
        status: 'Leave',
        checkIn: null,
        method: 'Manual',
        leaveReason: leaveCoverage[key].reason,
        leaveId: leaveCoverage[key].id,
      };
    }
  });

  // Auto-Absent: when "Auto Mark Absent after Attendance End Time" is enabled and
  // the Attendance End Time has passed, every eligible student without a record
  // (and without an approved leave — Leave above takes precedence) is shown as
  // Absent instead of Pending. This is a display-level default only: no placeholder
  // records are written. A later QR scan or manual mark creates/updates the real
  // record, so an auto-absent student who arrives late turns into Late (Absent → Late).
  const autoAbsentResult = await attendanceRules.shouldAutoMarkAbsent(attendanceDate);
  if (autoAbsentResult.autoMarkAbsent && autoAbsentResult.isAfterEndTime) {
    students.forEach((student) => {
      const key = student._id.toString();
      if (!attendanceMap[key]) {
        attendanceMap[key] = {
          status: 'Absent',
          checkIn: null,
          method: 'Manual',
          autoMarked: true,
        };
      }
    });
  }

  return { students, attendanceMap };
};

const getAttendanceByClass = async (className, academicYear, date) => {
  const filter = {};

  if (className && className !== 'All Classes') {
    filter.class = className;
  }

  if (academicYear) {
    filter.academicYear = academicYear;
  }

  if (date) {
    filter.date = new Date(date);
  }

  return StudentAttendance.find(filter)
    .populate('student', 'studentId fullName class')
    .sort({ date: -1 })
    .lean();
};

const getAttendanceByDate = async (date, academicYear) => {
  const filter = { date: new Date(date) };

  if (academicYear) {
    filter.academicYear = academicYear;
  }

  return StudentAttendance.find(filter)
    .populate('student', 'studentId fullName class')
    .sort({ createdAt: -1 })
    .lean();
};

const getAttendanceByStudent = async (studentId, academicYear) => {
  const filter = { student: studentId };

  if (academicYear) {
    filter.academicYear = academicYear;
  }

  return StudentAttendance.find(filter)
    .populate('student', 'studentId fullName class')
    .sort({ date: -1 })
    .lean();
};

const getAttendanceHistory = async (filters = {}) => {
  const {
    academicYear,
    class: classFilter,
    status,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 500,
  } = filters;

  // Accept both the backend query convention (`class`) and the frontend
  // convention (`className`) for the Class filter.
  const className = classFilter || filters.className;

  const studentFilter = { status: 'Active' };

  if (academicYear) {
    studentFilter.academicYear = academicYear;
  }

  if (className) {
    studentFilter.class = className;
  }

  if (search) {
    studentFilter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } },
    ];
  }

  const matchingStudents = await Student.find(studentFilter)
    .select('_id studentId fullName studentImage class academicYear')
    .lean();

  if (matchingStudents.length === 0) {
    return { records: [], total: 0 };
  }

  const studentIdMap = {};
  matchingStudents.forEach((s) => {
    studentIdMap[s._id.toString()] = s;
  });

  const attendanceFilter = {
    student: { $in: matchingStudents.map((s) => s._id) },
  };

  if (status && status !== 'All') {
    attendanceFilter.status = status;
  }

  if (fromDate || toDate) {
    attendanceFilter.date = {};
    if (fromDate) attendanceFilter.date.$gte = new Date(fromDate);
    if (toDate) attendanceFilter.date.$lte = new Date(toDate);
  }

  const total = await StudentAttendance.countDocuments(attendanceFilter);

  const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * parseInt(limit, 10);

  const attendanceRecords = await StudentAttendance.find(attendanceFilter)
    .sort({ date: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .lean();

  const records = attendanceRecords.map((record) => {
    const student = studentIdMap[record.student.toString()] || {};
    const checkInTime = record.checkIn
      ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      : null;

    return {
      id: record._id.toString(),
      name: student.fullName || 'Unknown',
      personId: student.studentId || '',
      type: 'Student',
      classOrDept: student.class || record.class,
      academicYear: student.academicYear || record.academicYear,
      date: record.date.toISOString().split('T')[0],
      checkIn: checkInTime,
      status: record.status,
      mode: record.method === 'QR' ? 'QR Code' : 'Manual',
    };
  });

  return { records, total };
};

const getAttendanceReports = async (filters = {}) => {
  return getAttendanceHistory(filters);
};

const deleteAttendance = async (id) => {
  const record = await StudentAttendance.findById(id);

  if (!record) {
    throw new ApiError(404, 'Attendance record not found');
  }

  await StudentAttendance.findByIdAndDelete(id);

  return record;
};

const resetCheckIn = async (studentId, date, academicYear, checkIn) => {
  const filter = { student: studentId, date: new Date(date) };
  if (academicYear) filter.academicYear = academicYear;

  const record = await StudentAttendance.findOne(filter);
  if (!record) {
    throw new ApiError(404, 'Attendance record not found');
  }

  if (checkIn) {
    record.checkIn = new Date(checkIn);
    await record.save();
  } else {
    await StudentAttendance.findByIdAndUpdate(
      record._id,
      { $unset: { checkIn: '' } },
      { new: true },
    );
  }

  return record;
};

const deleteBulkAttendance = async (className, academicYear, date) => {
  const filter = {};

  if (className && className !== 'All Classes') {
    filter.class = className;
  }

  if (academicYear) {
    filter.academicYear = academicYear;
  }

  if (date) {
    filter.date = new Date(date);
  }

  const result = await StudentAttendance.deleteMany(filter);

  return { deletedCount: result.deletedCount };
};

export default {
  saveAttendance,
  qrScanAttendance,
  getStudentsWithAttendance,
  getAttendanceByClass,
  getAttendanceByDate,
  getAttendanceByStudent,
  getAttendanceHistory,
  getAttendanceReports,
  deleteAttendance,
  deleteBulkAttendance,
  resetCheckIn,
};
