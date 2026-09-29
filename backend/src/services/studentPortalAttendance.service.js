import StudentAttendance from '../models/studentAttendance.model.js';
import Leave from '../models/leave.model.js';
import { ApiError } from '../utils/apiError.js';
import studentSession from './studentSession.service.js';

// Student Portal Attendance — READ-ONLY backend.
//
// A logged-in student sees ONLY their own attendance, sourced in real time
// from the existing `studentattendances` collection (the same records the
// Admin Student Attendance module writes). Nothing here creates, updates or
// deletes any attendance document — a student can never mark, edit or remove
// attendance.
//
//   - The student is always resolved from the authenticated session; any query
//     parameter that could target another student's records is denied.
//   - The day statuses come straight from the real records: Present, Absent,
//     Late, Leave (each with its actual attendance date).
//   - Approved leave is integrated exactly like the Admin daily grid uses the
//     existing Leave logic: an Approved leave covering a date with no marked
//     record shows that date as Leave (real marked records always win).
//   - CHECK-IN time is exposed only; the check-out time is never selected from
//     the database and therefore can never appear in a Student Portal response.
//   - The academic year comes from the student's enrolment with the central/
//     default school-settings source as fallback. Historical years are only
//     presented when real records (attendance or approved leave) exist for
//     that year.

const { resolveStudentForRequest, resolveAcademicYear, assertActiveStudent } = studentSession;

// Identical to the Admin Student Attendance history presentation for check-in
// times ("09:15 AM"). Check-out is deliberately never formatted or selected.
const formatCheckInTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

// UTC ISO date string (same convention as the existing attendance/leave code).
const toIsoDateStr = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Local YYYY-MM-DD from a Date (used for leave-range day iteration math).
const formatLocalDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const mapRecord = (record) => ({
  date: toIsoDateStr(record.date),
  status: record.status,
  checkInTime: record.checkIn ? formatCheckInTime(record.checkIn) : null,
  method: record.method === 'QR' ? 'QR Code' : 'Manual',
  remarks: record.remarks || '',
  leaveId: null,
  leaveReason: null,
});

const getMyAttendance = async (user, context = {}, filters = {}) => {
  // A student can never address another student. Any selector that could target
  // a different student or class is denied outright — only the authenticated
  // session decides whose attendance is returned.
  for (const key of ['studentId', 'student', 'classId', 'class']) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      throw new ApiError(403, `${key} targeting is not allowed. You can only view your own attendance.`);
    }
  }

  const student = await resolveStudentForRequest(user, context);
  assertActiveStudent(student);

  const year = await resolveAcademicYear(filters.academicYear, student.academicYear);

  // Real attendance records for this student + year. `checkOut` is deliberately
  // not selected, so the Student Portal can never expose a check-out time.
  const [records, approvedLeaves] = await Promise.all([
    StudentAttendance.find({ student: student._id, academicYear: year })
      .select('academicYear date status method checkIn remarks')
      .sort({ date: -1 })
      .lean(),
    Leave.find({ type: 'Student', student: student._id, status: 'Approved', academicYear: year })
      .select('fromDate toDate reason')
      .lean(),
  ]);

  // Real marked records take precedence over leave-derived days, exactly like
  // the Admin daily grid ("existing Leave logic").
  const recordByDate = new Map();
  records.forEach((record) => {
    const date = toIsoDateStr(record.date);
    if (date) recordByDate.set(date, record);
  });

  const today = formatLocalDate(new Date());
  const todayMidnight = new Date(`${today}T00:00:00`);
  const leaveByDate = new Map();

  for (const leave of approvedLeaves) {
    const start = new Date(`${leave.fromDate}T00:00:00`);
    const endRaw = new Date(`${leave.toDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(endRaw.getTime())) continue;

    // Leave days are only shown once the actual date arrives (a future approved
    // leave is not attendance history yet).
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
    entries.push(mapRecord(record));
  });

  leaveByDate.forEach((info, date) => {
    entries.push({
      date,
      status: 'Leave',
      checkInTime: null,
      method: 'Manual',
      remarks: '',
      leaveId: info.leaveId,
      leaveReason: info.leaveReason,
    });
  });

  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const summary = { present: 0, absent: 0, late: 0, leave: 0, total: entries.length };
  entries.forEach((entry) => {
    const key = entry.status.toLowerCase();
    if (key in summary) summary[key] += 1;
  });

  return {
    student: {
      id: student._id,
      studentId: student.studentId,
      fullName: student.fullName,
      className: student.class || '',
      academicYear: student.academicYear || '',
    },
    academicYear: year,
    summary,
    records: entries,
  };
};

export default {
  getMyAttendance,
};