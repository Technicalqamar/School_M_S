import TeacherAttendance from '../models/teacherAttendance.model.js';
import Leave from '../models/leave.model.js';
import { ApiError } from '../utils/apiError.js';
import teacherSession from './teacherSession.service.js';

// Teacher Portal Attendance — READ-ONLY backend (foundation).
//
// A logged-in teacher sees ONLY their own attendance, sourced in real time
// from the existing `teacherattendances` collection (the same records the
// Admin Teacher Attendance module and the QR scanner write). Nothing here
// creates, updates or deletes any attendance document — a teacher can never
// mark, edit or remove their own (or anyone else's) attendance.
//
//   - The teacher is always resolved from the authenticated session; any query
//     parameter that could target another teacher's records is denied.
//   - Each real record shows its attendance date, status, method, check-in /
//     check-out times and the working hours computed from them.
//   - Approved leave is integrated exactly like the Admin daily grid uses the
//     existing Leave logic: an Approved leave covering a date with no marked
//     record shows that date as Leave (real marked records always win).
//   - A `today` entry reports the real current-day record (or approved leave),
//     or null when there is none — no values are ever fabricated.
//   - The academic year comes from the teacher's own profile with the central/
//     default school-settings source as fallback. Historical years are only
//     presented when real records (attendance or approved leave) exist for
//     that year.

const { resolveTeacher, resolveAcademicYear, assertActiveTeacher } = teacherSession;

const formatTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// Local YYYY-MM-DD from a Date (same convention as the portal/leave code).
const formatLocalDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// UTC ISO date string (same convention as the existing attendance/leave code).
const toIsoDateStr = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Working hours = real check-out minus check-in in HH:MM. Only a genuine
// check-in + check-out pair where check-out is after check-in counts; a
// missing pair or an impossible order yields "00:00", never a made-up value.
const computeWorkingHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return '00:00';
  const inMs = new Date(checkIn).getTime();
  const outMs = new Date(checkOut).getTime();
  if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs <= inMs) return '00:00';
  const totalMinutes = Math.floor((outMs - inMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getMyAttendance = async (user, filters = {}) => {
  // A teacher can never address another teacher. Any selector that could target
  // a different teacher (or class) is denied outright — only the authenticated
  // session decides whose attendance is returned.
  for (const key of ['teacherId', 'teacher', 'classId', 'class']) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      throw new ApiError(403, `${key} targeting is not allowed. You can only view your own attendance.`);
    }
  }

  const teacher = await resolveTeacher(user);
  assertActiveTeacher(teacher);

  const year = await resolveAcademicYear(filters.academicYear, teacher.academicYear);

  // Real attendance records for this teacher + year, plus the approved leaves
  // covering that year (used to surface real leave days that are not marked).
  const [records, approvedLeaves] = await Promise.all([
    TeacherAttendance.find({ teacher: teacher._id, academicYear: year })
      .select('academicYear date status method checkIn checkOut remarks')
      .sort({ date: -1 })
      .lean(),
    Leave.find({ type: 'Teacher', teacher: teacher._id, status: 'Approved', academicYear: year })
      .select('fromDate toDate reason')
      .lean(),
  ]);

  const recordByDate = new Map();
  records.forEach((record) => {
    const date = toIsoDateStr(record.date);
    if (date) recordByDate.set(date, record);
  });

  // Real marked records take precedence over leave-derived days, exactly like
  // the Admin daily grid. Leave days are only shown once the actual date
  // arrives (a future approved leave is not attendance history yet).
  const today = formatLocalDate(new Date());
  const todayMidnight = new Date(`${today}T00:00:00`);
  const leaveByDate = new Map();

  for (const leave of approvedLeaves) {
    const start = new Date(`${leave.fromDate}T00:00:00`);
    const endRaw = new Date(`${leave.toDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(endRaw.getTime())) continue;

    const end = endRaw > todayMidnight ? todayMidnight : endRaw;
    if (start > end) continue;

    const walk = new Date(start);
    let guard = 0;
    while (walk <= end && guard < 400) {
      const day = formatLocalDate(walk);
      if (day && !recordByDate.has(day)) {
        leaveByDate.set(day, { leaveId: String(leave._id), leaveReason: leave.reason || '' });
      }
      walk.setDate(walk.getDate() + 1);
      guard += 1;
    }
  }

  const entries = [];

  recordByDate.forEach((record, date) => {
    entries.push({
      id: String(record._id),
      date,
      status: record.status,
      method: record.method === 'QR' ? 'QR Code' : 'Manual',
      checkIn: formatTime(record.checkIn),
      checkOut: formatTime(record.checkOut),
      workingHours: computeWorkingHours(record.checkIn, record.checkOut),
      remarks: record.remarks || '',
      leaveId: null,
      leaveReason: null,
    });
  });

  leaveByDate.forEach((info, date) => {
    entries.push({
      id: '',
      date,
      status: 'Leave',
      method: 'Manual',
      checkIn: null,
      checkOut: null,
      workingHours: '00:00',
      remarks: '',
      leaveId: info.leaveId,
      leaveReason: info.leaveReason,
    });
  });

  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
    total: entries.length,
    totalWorkingHours: '00:00',
  };

  let totalMinutes = 0;
  entries.forEach((entry) => {
    const key = entry.status.toLowerCase();
    if (key in summary) summary[key] += 1;

    if (entry.workingHours && entry.workingHours !== '00:00') {
      const [hours, minutes] = entry.workingHours.split(':').map(Number);
      totalMinutes += hours * 60 + minutes;
    }
  });

  summary.totalWorkingHours = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;

  // Today's live check-in / check-out / working hours — real data only.
  const todayRecord = recordByDate.get(today);
  const todayLeave = leaveByDate.get(today);
  const todayInfo = todayRecord
    ? {
        date: today,
        status: todayRecord.status,
        method: todayRecord.method === 'QR' ? 'QR Code' : 'Manual',
        checkIn: formatTime(todayRecord.checkIn),
        checkOut: formatTime(todayRecord.checkOut),
        workingHours: computeWorkingHours(todayRecord.checkIn, todayRecord.checkOut),
        leaveId: null,
        leaveReason: null,
      }
    : todayLeave
      ? {
          date: today,
          status: 'Leave',
          method: 'Manual',
          checkIn: null,
          checkOut: null,
          workingHours: '00:00',
          leaveId: todayLeave.leaveId,
          leaveReason: todayLeave.leaveReason,
        }
      : null;

  return {
    teacher: {
      id: String(teacher._id),
      teacherId: teacher.teacherId || '',
      fullName: teacher.fullName || '',
      academicYear: teacher.academicYear || '',
    },
    academicYear: year,
    summary,
    today: todayInfo,
    records: entries,
  };
};

export default {
  getMyAttendance,
};