import Teacher from '../models/teacher.model.js';
import TeacherAttendance from '../models/teacherAttendance.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import attendanceRules from './attendanceRules.service.js';
import leaveService from './leave.service.js';

// Minimum delay between check-in and check-out (in milliseconds).
// A valid QR re-scan can only perform check-out after this window has passed.
const MIN_CHECKOUT_DELAY_MS = 10 * 60 * 1000;

const resolveAcademicYear = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || String(new Date().getFullYear());
};

const formatTimeStr = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// HH:MM form for the Late Attendance rule. The rule's time parser only accepts
// two-part HH:MM values (matching the School Settings time format), so a
// seconds-padded string would silently fail the parse and never flag Late.
const formatClockHm = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

// School Settings → School End Time is the cutoff for the teacher working day.
// It drives both the check-out cap (a check-out can never be recorded later than
// School End Time) and the automatic check-out (checked-in teachers who never
// checked out are closed at School End Time once it has passed). No times are
// hard-coded — everything comes from the configured settings.
const getSchoolEndPolicy = async (attendanceDate) => {
  const settings = await SchoolSettings.getSettings();
  const endStr = settings.schoolEndTime?.trim();

  if (!endStr) {
    return { enabled: false, schoolEndTime: '', cutoff: null };
  }

  const endMin = attendanceRules.parseTime(endStr);
  const d = new Date(attendanceDate);
  if (endMin === null || Number.isNaN(d.getTime())) {
    return { enabled: false, schoolEndTime: endStr, cutoff: null };
  }

  const cutoff = new Date(d);
  cutoff.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

  return { enabled: true, schoolEndTime: endStr, cutoff };
};

// Automatic Checkout at School End Time: once the configured School End Time has
// passed, every teacher who checked in but never checked out gets their check-out
// set exactly to School End Time so working hours cannot keep increasing after the
// school day ends. Records whose check-in happened after School End Time are left
// untouched (a post-cutoff arrival must not get a negative-time auto check-out).
// This materializes the pending check-out in the database AND patches the lean
// rows already fetched so the caller returns consistent data.
const settleAutoCheckouts = async (records, attendanceDate) => {
  const policy = await getSchoolEndPolicy(attendanceDate);
  if (!policy.enabled || !policy.cutoff) return;

  const now = new Date();
  if (now.getTime() < policy.cutoff.getTime()) return;

  const pending = records.filter(
    (record) =>
      record.checkIn
      && !record.checkOut
      && new Date(record.checkIn).getTime() <= policy.cutoff.getTime(),
  );

  if (pending.length === 0) return;

  await TeacherAttendance.updateMany(
    { _id: { $in: pending.map((record) => record._id) }, checkOut: null },
    { $set: { checkOut: policy.cutoff } },
  );

  // Reflect the materialized check-out in the records returned to the caller.
  pending.forEach((record) => {
    record.checkOut = policy.cutoff;
  });
};

const findTeacherByQr = async (qrValue, academicYear) => {
  const trimmed = typeof qrValue === 'string' ? qrValue.trim() : '';
  if (!trimmed) return null;

  const teacherQuery = {
    status: 'Active',
  };

  if (academicYear) {
    teacherQuery.academicYear = resolveAcademicYear(academicYear);
  }

  const teachers = await Teacher.find(teacherQuery)
    .select('_id teacherId fullName academicYear status')
    .lean();

  if (teachers.length === 0) return null;

  const match = teachers.find((teacher) => {
    const values = [
      teacher.teacherId,
      `TCH-${teacher.teacherId}`,
      `QR-${teacher.teacherId}`,
      `QR-${teacher.teacherId}-`,
    ];

    return values.some((value) => value === trimmed)
      || trimmed.includes(teacher.teacherId)
      || trimmed.includes(`TCH-${teacher.teacherId}`)
      || trimmed.includes(`QR-${teacher.teacherId}`);
  });

  return match || null;
};

const getTeachersWithAttendance = async (academicYear, date) => {
  const resolvedYear = resolveAcademicYear(academicYear);
  const attendanceDate = normalizeAttendanceDate(date || new Date().toISOString().split('T')[0]);

  if (!attendanceDate) {
    throw new ApiError(400, 'Invalid attendance date');
  }

  const teachers = await Teacher.find({
    academicYear: resolvedYear,
    status: 'Active',
  })
    .select('_id teacherId fullName teacherImage academicYear')
    .sort({ fullName: 1 })
    .lean();

  if (teachers.length === 0) {
    return { teachers: [], attendanceMap: {} };
  }

  const dateRange = getDateRangeForQuery(attendanceDate);
  const records = await TeacherAttendance.find({
    teacher: { $in: teachers.map((teacher) => teacher._id) },
    date: { $gte: dateRange.start, $lt: dateRange.end },
  })
    .select('teacher status checkIn checkOut method')
    .lean();

  // Automatic Checkout at School End Time: teachers who checked in but never
  // checked out are closed exactly at School End Time once it has passed, so
  // working hours cannot keep increasing after the school day ends.
  await settleAutoCheckouts(records, attendanceDate);

  const attendanceMap = {};
  records.forEach((record) => {
    attendanceMap[record.teacher.toString()] = {
      id: record._id.toString(),
      status: record.status,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      method: record.method,
    };
  });

  // Approved-leave integration: a teacher with an approved leave covering this
  // date defaults to "Leave" when no attendance record exists yet. Existing
  // marked records (Present/Absent/Late/Leave) always take precedence.
  const leaveCoverage = await leaveService.getApprovedLeaveCoverage({
    type: 'Teacher',
    personIds: teachers.map((teacher) => teacher._id),
    date: date || attendanceDate.toISOString().split('T')[0],
  });

  teachers.forEach((teacher) => {
    const key = teacher._id.toString();
    if (!attendanceMap[key] && leaveCoverage[key]) {
      attendanceMap[key] = {
        id: '',
        status: 'Leave',
        checkIn: null,
        checkOut: null,
        method: 'Manual',
        leaveReason: leaveCoverage[key].reason,
        leaveId: leaveCoverage[key].id,
      };
    }
  });

  return {
    teachers,
    attendanceMap,
    academicYear: resolvedYear,
    date: attendanceDate.toISOString().split('T')[0],
  };
};

const saveAttendance = async (data, userId) => {
  const { academicYear, date, records } = data || {};
  const resolvedYear = resolveAcademicYear(academicYear);

  if (!date) {
    throw new ApiError(400, 'Attendance date is required');
  }

  const attendanceDate = normalizeAttendanceDate(date);
  if (!attendanceDate) {
    throw new ApiError(400, 'Invalid attendance date');
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (attendanceDate.getTime() > today.getTime()) {
    throw new ApiError(400, 'Cannot mark attendance for a future date');
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new ApiError(400, 'At least one teacher attendance record is required');
  }

  const weekendResult = await attendanceRules.checkWeekendPolicy(attendanceDate);
  if (weekendResult.isWeekend) {
    throw new ApiError(400, `Attendance cannot be marked because today is ${weekendResult.weekendDay} (configured as a weekend day).`);
  }

  const holidayResult = await attendanceRules.checkHolidayPolicy(attendanceDate, { appliesTo: 'Teachers' });
  if (holidayResult.isHoliday) {
    const holidayNames = holidayResult.holidays.map((holiday) => holiday.name).join(', ');
    throw new ApiError(400, `Attendance cannot be marked because today is an official holiday (${holidayNames}).`);
  }

  const eventResult = await attendanceRules.checkEventPolicy(attendanceDate, { audience: 'Teachers' });
  if (eventResult.hasEvent) {
    for (const event of eventResult.events) {
      if (event.attendanceRequired === 'No') {
        throw new ApiError(400, `Attendance is disabled because of the event: ${event.name}.`);
      }
      if (event.audience && !['All', 'Teachers'].includes(event.audience)) {
        throw new ApiError(400, `Attendance cannot be marked because the event '${event.name}' is restricted to ${event.audience} only. Teacher attendance is not allowed for this event.`);
      }
    }
  }

  // Attendance time rule: respect the configured Attendance Start Time (check-in
  // before it is blocked). After the configured Attendance End Time the window is
  // closed but attendance is NOT blocked — a Present entry is recorded as Late.
  const timeResult = await attendanceRules.checkAttendanceTimeRules();
  if (timeResult.phase === 'before-start') {
    throw new ApiError(400, timeResult.message);
  }

  const teacherIds = records.map((record) => record.teacher).filter(Boolean);
  if (teacherIds.length !== new Set(teacherIds).size) {
    throw new ApiError(400, 'Duplicate teacher entries were provided in the same submission');
  }

  const teachers = await Teacher.find({
    _id: { $in: teacherIds },
    status: 'Active',
    academicYear: resolvedYear,
  })
    .select('_id teacherId fullName academicYear')
    .lean();

  if (teachers.length !== teacherIds.length) {
    throw new ApiError(400, 'One or more teachers do not belong to the selected academic year or are not active');
  }

  const teacherMap = Object.fromEntries(teachers.map((teacher) => [teacher._id.toString(), teacher]));
  const processedRecords = await Promise.all(
    records.map(async (record) => {
      const teacherId = record.teacher;
      const teacher = teacherMap[teacherId.toString()];
      if (!teacher) {
        throw new ApiError(404, `Teacher not found for ID: ${teacherId}`);
      }

      const dateRange = getDateRangeForQuery(attendanceDate);
      const existingRecord = await TeacherAttendance.findOne({
        teacher: teacher._id,
        date: { $gte: dateRange.start, $lt: dateRange.end },
      }).lean();

      if (existingRecord) {
        throw new ApiError(409, `Attendance already marked for ${teacher.fullName} (${teacher.teacherId}) on ${attendanceDate.toISOString().split('T')[0]}`);
      }

      let status = record.status;
      if (status === 'Present') {
        if (timeResult.phase === 'after-close') {
          // After the configured Attendance End Time the window is closed: an
          // entry marked Present is recorded as Late instead (never blocked,
          // never Present), mirroring the Student Attendance timing behavior.
          status = 'Late';
        } else {
          const checkInTime = formatClockHm(new Date());
          if (checkInTime) {
            const lateResult = await attendanceRules.checkLateRule({ checkInTime });
            if (lateResult.isLate) {
              status = 'Late';
            }
          }
        }
      }

      return {
        teacher: teacher._id,
        status,
        method: record.method || 'Manual',
        remarks: record.remarks || '',
      };
    }),
  );

  const createdRecords = await Promise.all(
    processedRecords.map(async (record) => TeacherAttendance.create({
      teacher: record.teacher,
      academicYear: resolvedYear,
      date: attendanceDate,
      status: record.status,
      method: record.method,
      checkIn: ['Present', 'Late'].includes(record.status) ? new Date() : undefined,
      remarks: record.remarks,
      markedBy: userId,
    })),
  );

  return {
    academicYear: resolvedYear,
    date: attendanceDate.toISOString().split('T')[0],
    totalTeachers: createdRecords.length,
    records: createdRecords.map((record) => ({
      id: record._id.toString(),
      teacher: record.teacher.toString(),
      status: record.status,
      method: record.method,
      checkIn: record.checkIn || null,
      checkOut: record.checkOut || null,
    })),
  };
};

const qrScanTeacherAttendance = async (data, userId) => {
  const { qrValue, academicYear, date } = data || {};
  const trimmedQrValue = typeof qrValue === 'string' ? qrValue.trim() : '';

  if (!trimmedQrValue) {
    throw new ApiError(400, 'QR value is required');
  }

  const resolvedYear = resolveAcademicYear(academicYear);
  const teacher = await findTeacherByQr(trimmedQrValue, resolvedYear);
  if (!teacher) {
    throw new ApiError(404, 'Invalid Teacher QR code. No active teacher matches this QR value');
  }

  if (teacher.academicYear && teacher.academicYear !== resolvedYear) {
    throw new ApiError(400, `QR belongs to ${teacher.fullName} (${teacher.teacherId}) whose academic year is ${teacher.academicYear}, not ${resolvedYear}`);
  }

  const attendanceDate = normalizeAttendanceDate(date || new Date().toISOString().split('T')[0]);
  if (!attendanceDate || Number.isNaN(attendanceDate.getTime())) {
    throw new ApiError(400, 'Invalid attendance date');
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (attendanceDate.getTime() > today.getTime()) {
    throw new ApiError(400, 'Cannot mark attendance for a future date');
  }

  const dateRange = getDateRangeForQuery(attendanceDate);
  const existingRecord = await TeacherAttendance.findOne({
    teacher: teacher._id,
    date: { $gte: dateRange.start, $lt: dateRange.end },
  }).lean();

  // ── Same-day record exists → handle check-out (or reject invalid re-scan) ──
  if (existingRecord) {
    // Already checked out: never perform a duplicate check-out.
    if (existingRecord.checkOut) {
      const checkOutLabel = formatTimeStr(existingRecord.checkOut);
      throw new ApiError(
        409,
        `Teacher ${teacher.fullName} (${teacher.teacherId}) already checked out at ${checkOutLabel}. Attendance was not modified.`,
      );
    }

    // Only checked-in (Present/Late) records are eligible for check-out.
    // Absent/Leave records marked manually cannot be checked out via scan.
    const isCheckedInStatus = ['Present', 'Late'].includes(existingRecord.status);
    if (!isCheckedInStatus || !existingRecord.checkIn) {
      throw new ApiError(
        409,
        `Attendance already marked for ${teacher.fullName} (${teacher.teacherId}) on ${attendanceDate.toISOString().split('T')[0]} with status "${existingRecord.status}" (method: ${existingRecord.method})`,
      );
    }

    // Enforce the 10-minute minimum between check-in and check-out.
    const checkInTime = new Date(existingRecord.checkIn).getTime();
    const elapsedMs = Date.now() - checkInTime;

    if (elapsedMs < MIN_CHECKOUT_DELAY_MS) {
      const checkInLabel = formatTimeStr(existingRecord.checkIn);
      const remainingMinutes = Math.max(1, Math.ceil((MIN_CHECKOUT_DELAY_MS - elapsedMs) / 60000));
      throw new ApiError(
        409,
        `Already checked-in at ${checkInLabel}. Checkout is available after 10 minutes of check-in (try again in approximately ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}).`,
      );
    }

    // 10+ minutes have passed → perform the real check-out (status stays unchanged).
    // A check-out can never be recorded later than the configured School End Time:
    // it is capped at School End Time so working hours stop at the end of the day.
    const rawCheckOut = new Date();
    const endPolicy = await getSchoolEndPolicy(attendanceDate);
    const checkOutDate = endPolicy.enabled && endPolicy.cutoff && rawCheckOut.getTime() > endPolicy.cutoff.getTime()
      ? endPolicy.cutoff
      : rawCheckOut;

    await TeacherAttendance.updateOne(
      { _id: existingRecord._id },
      { $set: { checkOut: checkOutDate } },
    );

    return {
      action: 'checkout',
      id: existingRecord._id.toString(),
      teacher: {
        teacherId: teacher.teacherId,
        fullName: teacher.fullName,
        academicYear: teacher.academicYear,
      },
      date: attendanceDate.toISOString().split('T')[0],
      status: existingRecord.status,
      method: 'QR',
      checkIn: existingRecord.checkIn,
      checkOut: checkOutDate,
    };
  }

  // ── First scan of the day → check-in (existing policy checks preserved) ──
  const weekendResult = await attendanceRules.checkWeekendPolicy(attendanceDate);
  if (weekendResult.isWeekend) {
    throw new ApiError(400, `Attendance cannot be marked because ${weekendResult.weekendDay} is configured as a weekend day.`);
  }

  const holidayResult = await attendanceRules.checkHolidayPolicy(attendanceDate, { appliesTo: 'Teachers' });
  if (holidayResult.isHoliday) {
    const holidayNames = holidayResult.holidays.map((holiday) => holiday.name).join(', ');
    throw new ApiError(400, `Attendance cannot be marked because ${holidayNames} is an official holiday.`);
  }

  const eventResult = await attendanceRules.checkEventPolicy(attendanceDate, { audience: 'Teachers' });
  if (eventResult.hasEvent) {
    for (const event of eventResult.events) {
      if (event.attendanceRequired === 'No') {
        throw new ApiError(400, `Attendance is disabled because of the event: ${event.name}.`);
      }
      if (event.audience && !['All', 'Teachers'].includes(event.audience)) {
        throw new ApiError(400, `Attendance cannot be marked because the event '${event.name}' is restricted to ${event.audience} only. Teacher attendance is not allowed for this event.`);
      }
    }
  }

  const timeResult = await attendanceRules.checkAttendanceTimeRules();
  if (timeResult.phase === 'before-start') {
    throw new ApiError(400, timeResult.message);
  }

  // After the configured Attendance End Time scans are never blocked — the check-in
  // is recorded as Late instead of Present, and the actual scan timestamp is kept.
  const postEndTime = timeResult.phase === 'after-close';

  const checkInDate = new Date();
  let status;
  if (postEndTime) {
    status = 'Late';
  } else {
    status = 'Present';
    const checkInTimeStr = formatClockHm(checkInDate);
    if (checkInTimeStr) {
      const lateResult = await attendanceRules.checkLateRule({ checkInTime: checkInTimeStr });
      if (lateResult.isLate) {
        status = 'Late';
      }
    }
  }

  const record = await TeacherAttendance.create({
    teacher: teacher._id,
    academicYear: resolvedYear,
    date: attendanceDate,
    status,
    method: 'QR',
    checkIn: checkInDate,
    remarks: 'Marked via Teacher QR scan',
    markedBy: userId,
  });

  return {
    action: 'checkin',
    id: record._id.toString(),
    teacher: {
      teacherId: teacher.teacherId,
      fullName: teacher.fullName,
      academicYear: teacher.academicYear,
    },
    date: attendanceDate.toISOString().split('T')[0],
    status,
    method: 'QR',
    checkIn: checkInDate,
  };
};

const getAttendanceByDate = async (date, academicYear) => {
  const resolvedYear = resolveAcademicYear(academicYear);
  const filter = { academicYear: resolvedYear };

  if (date) {
    const attendanceDate = normalizeAttendanceDate(date);
    if (!attendanceDate) {
      throw new ApiError(400, 'Invalid attendance date');
    }
    const range = getDateRangeForQuery(attendanceDate);
    filter.date = { $gte: range.start, $lt: range.end };
  }

  const records = await TeacherAttendance.find(filter)
    .populate('teacher', 'teacherId fullName academicYear')
    .sort({ date: -1 })
    .lean();

  return records;
};

const getAttendanceByTeacher = async (teacherId, academicYear) => {
  const filter = { teacher: teacherId };
  if (academicYear) filter.academicYear = resolveAcademicYear(academicYear);

  return TeacherAttendance.find(filter)
    .populate('teacher', 'teacherId fullName academicYear')
    .sort({ date: -1 })
    .lean();
};

const getAttendanceHistory = async (filters = {}) => {
  const {
    academicYear,
    status,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 500,
  } = filters;

  const teacherFilter = { status: 'Active' };
  if (academicYear) {
    teacherFilter.academicYear = resolveAcademicYear(academicYear);
  }

  if (search) {
    const pattern = new RegExp(search, 'i');
    teacherFilter.$or = [
      { fullName: pattern },
      { teacherId: pattern },
      { cnic: pattern },
    ];
  }

  const matchingTeachers = await Teacher.find(teacherFilter)
    .select('_id teacherId fullName academicYear')
    .lean();

  if (matchingTeachers.length === 0) {
    return { records: [], total: 0 };
  }

  const attendanceFilter = {
    teacher: { $in: matchingTeachers.map((teacher) => teacher._id) },
  };

  if (status && status !== 'All') {
    attendanceFilter.status = status;
  }

  if (fromDate || toDate) {
    attendanceFilter.date = {};
    if (fromDate) attendanceFilter.date.$gte = new Date(fromDate);
    if (toDate) attendanceFilter.date.$lte = new Date(toDate);
  }

  const total = await TeacherAttendance.countDocuments(attendanceFilter);
  const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * parseInt(limit, 10);

  const attendanceRecords = await TeacherAttendance.find(attendanceFilter)
    .populate('teacher', 'teacherId fullName academicYear')
    .sort({ date: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .lean();

  const teacherMap = Object.fromEntries(matchingTeachers.map((teacher) => [teacher._id.toString(), teacher]));

  const records = attendanceRecords.map((record) => {
    const teacher = teacherMap[record.teacher?._id?.toString()] || teacherMap[record.teacher?.toString()] || {};
    const checkInTime = record.checkIn
      ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      : null;

    const checkOutTime = record.checkOut
      ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      : null;

    return {
      id: record._id.toString(),
      name: teacher.fullName || 'Unknown',
      personId: teacher.teacherId || '',
      type: 'Teacher',
      academicYear: teacher.academicYear || record.academicYear,
      date: record.date.toISOString().split('T')[0],
      checkIn: checkInTime,
      checkOut: checkOutTime,
      status: record.status,
      mode: record.method === 'QR' ? 'QR Code' : 'Manual',
    };
  });

  return { records, total };
};

const getAttendanceReports = async (filters = {}) => getAttendanceHistory(filters);

const deleteAttendance = async (id) => {
  const record = await TeacherAttendance.findById(id);
  if (!record) {
    throw new ApiError(404, 'Attendance record not found');
  }

  await TeacherAttendance.findByIdAndDelete(id);
  return record;
};

const resetCheckIn = async (teacherId, date, academicYear, checkIn) => {
  const filter = { teacher: teacherId, date: new Date(date) };
  if (academicYear) filter.academicYear = resolveAcademicYear(academicYear);

  const record = await TeacherAttendance.findOne(filter);
  if (!record) {
    throw new ApiError(404, 'Attendance record not found');
  }

  if (checkIn) {
    record.checkIn = new Date(checkIn);
    await record.save();
  } else {
    await TeacherAttendance.findByIdAndUpdate(record._id, { $unset: { checkIn: '' } }, { new: true });
  }

  return record;
};

export {
  findTeacherByQr,
  resolveAcademicYear,
  getTeachersWithAttendance,
  saveAttendance,
  qrScanTeacherAttendance,
  getAttendanceByDate,
  getAttendanceByTeacher,
  getAttendanceHistory,
  getAttendanceReports,
  deleteAttendance,
  resetCheckIn,
};

export default {
  resolveAcademicYear,
  getTeachersWithAttendance,
  saveAttendance,
  qrScanTeacherAttendance,
  getAttendanceByDate,
  getAttendanceByTeacher,
  getAttendanceHistory,
  getAttendanceReports,
  deleteAttendance,
  resetCheckIn,
  findTeacherByQr,
};
