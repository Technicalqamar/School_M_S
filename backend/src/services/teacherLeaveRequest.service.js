import Leave from '../models/leave.model.js';
import { ApiError } from '../utils/apiError.js';
import teacherSession from './teacherSession.service.js';
import leaveService from './leave.service.js';

// Teacher Portal Leave Requests.
//
// A logged-in teacher can only work with their OWN leave requests, all stored
// in the existing `leaves` collection used by the Admin Leave Management
// module (no new model/collection).
//
//   - `requestLeave` creates a leave that always starts as Pending. The teacher
//     is ALWAYS derived from the authenticated session — the client can never
//     choose another teacher, a status, a class or an academic year. Validation
//     (dates, active profile, academic-year match, overlapping
//     Pending/Approved requests) is fully delegated to the existing leave
//     service so the standard leave rules apply unchanged.
//   - Admin continues approving/rejecting the same requests through the
//     existing Admin "Attendance → Leave" module. Approved leaves then appear
//     automatically as "Leave" in Teacher Attendance via the existing Leave
//     logic (also applied by `teacherAttendancePortal.service`).
//   - `getMyLeaveRequests` lists only the authenticated teacher's requests and
//     their current Pending/Approved/Rejected status.

const { resolveTeacher, resolveAcademicYear, assertActiveTeacher } = teacherSession;

const normalizeDateStr = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

const validateReason = (reason) => {
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new ApiError(400, 'Leave reason is required');
  }
  if (reason.trim().length < 3) {
    throw new ApiError(400, 'Leave reason must be at least 3 characters');
  }
  if (reason.trim().length > 500) {
    throw new ApiError(400, 'Leave reason cannot exceed 500 characters');
  }
  return reason.trim();
};

const requestLeave = async (user, body = {}, userId) => {
  const teacher = await resolveTeacher(user);
  assertActiveTeacher(teacher);

  // A teacher can never self-approve/reject. If a status is sent at all it
  // must be the default Pending — any decision status is rejected outright.
  if (body.status !== undefined && body.status !== null && String(body.status).trim() !== '') {
    const status = String(body.status).trim();
    if (status !== 'Pending') {
      throw new ApiError(
        400,
        'Teachers cannot set a leave status. Leave requests are always submitted as Pending.',
      );
    }
  }

  // Only From Date, To Date and Reason are accepted from the client. Every
  // other leave field is derived from the authenticated session below, so a
  // crafted payload cannot escalate to another teacher/type/status/year.
  const from = normalizeDateStr(body.fromDate);
  const to = normalizeDateStr(body.toDate);

  if (!from || !to) {
    throw new ApiError(400, 'Valid from date and to date are required');
  }
  if (to < from) {
    throw new ApiError(400, 'To date cannot be before from date');
  }

  const reason = validateReason(body.reason);

  // The teacher's own academic year is used (existing central/default source
  // as fallback) and is never taken from the request body.
  const academicYear = teacher.academicYear || await teacherSession.getCurrentAcademicYear();

  const leave = await leaveService.createLeave(
    {
      type: 'Teacher',
      teacherId: teacher.teacherId,
      academicYear,
      fromDate: from,
      toDate: to,
      reason,
    },
    userId,
  );

  return leave;
};

const getMyLeaveRequests = async (user, filters = {}) => {
  // No selector can target another teacher's leave requests.
  for (const key of ['teacherId', 'teacher']) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      throw new ApiError(403, `${key} targeting is not allowed. You can only view your own leave requests.`);
    }
  }

  const teacher = await resolveTeacher(user);
  assertActiveTeacher(teacher);

  const filter = { type: 'Teacher', teacher: teacher._id };

  if (filters.academicYear !== undefined && filters.academicYear !== null && String(filters.academicYear).trim() !== '') {
    filter.academicYear = await resolveAcademicYear(filters.academicYear);
  }

  const leaves = await Leave.find(filter)
    .select('type class academicYear fromDate toDate reason status requestedBy approvedBy approvedAt createdAt updatedAt')
    .populate({ path: 'requestedBy', select: 'fullName' })
    .populate({ path: 'approvedBy', select: 'fullName' })
    .sort({ createdAt: -1 })
    .lean();

  return {
    leaves: leaves.map((leave) => ({
      id: String(leave._id),
      type: leave.type,
      teacherId: teacher.teacherId,
      academicYear: leave.academicYear,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      reason: leave.reason,
      status: leave.status,
      requestedBy: leave.requestedBy?.fullName || '',
      approvedBy: leave.approvedBy?.fullName || '',
      approvedAt: leave.approvedAt || null,
      createdAt: leave.createdAt,
      updatedAt: leave.updatedAt,
    })),
    count: leaves.length,
  };
};

export default {
  requestLeave,
  getMyLeaveRequests,
};