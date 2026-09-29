import api from '../../api/axios';

/**
 * Student Attendance service.
 *
 * Backed by the protected student endpoints built in Step 4:
 *   GET  /api/v1/student/attendance        → own real attendance (read-only)
 *   GET  /api/v1/student/leave-requests    → own leave requests
 *   POST /api/v1/student/leave-requests    → submit a leave request (Pending)
 *
 * The server derives the student from the authenticated session, so there are
 * no student/class selectors here and no create/edit/delete for attendance.
 * Check-out data is NOT part of the API contract (the backend never selects
 * or returns it) and this service never references it.
 */

const mapRecord = (r) => ({
  date: r.date || '',
  status: r.status || '',
  // Actual check-in time ("09:15 AM"), null for days without a check-in
  // (Absent/Leave). There is deliberately no check-out field anywhere.
  checkInTime: r.checkInTime || null,
  method: r.method || '',
  remarks: r.remarks || '',
  leaveId: r.leaveId || null,
  leaveReason: r.leaveReason || '',
});

const mapLeave = (l) => ({
  id: l.id,
  fromDate: l.fromDate || '',
  toDate: l.toDate || '',
  reason: l.reason || '',
  status: l.status || 'Pending',
  class: l.class || '',
  academicYear: l.academicYear || '',
  requestedBy: l.requestedBy || '',
  approvedBy: l.approvedBy || '',
  approvedAt: l.approvedAt || null,
  createdAt: l.createdAt || null,
  updatedAt: l.updatedAt || null,
});

/**
 * Fetches the logged-in student's own attendance for the current academic year
 * (the academic year always comes from the existing central/default source on
 * the server). Historical years are only returned when real records exist.
 */
const getAttendance = async (params = {}) => {
  const response = await api.get('/student/attendance', { params });
  const data = response.data?.data || {};

  return {
    student: data.student || null,
    academicYear: data.academicYear || '',
    summary: data.summary || { present: 0, absent: 0, late: 0, leave: 0, total: 0 },
    records: (data.records || []).map(mapRecord),
  };
};

/** Fetches the logged-in student's own leave requests with their status. */
const getLeaveRequests = async (params = {}) => {
  const response = await api.get('/student/leave-requests', { params });
  const data = response.data?.data || {};

  return {
    leaves: (data.leaves || []).map(mapLeave),
    count: data.count || 0,
  };
};

/**
 * Submits a leave request (From Date, To Date, Reason). The request starts as
 * Pending and is reviewed (Approved/Rejected) by the school administration
 * through the existing Admin Leave Management module.
 */
const requestLeave = async ({ fromDate, toDate, reason }) => {
  const response = await api.post('/student/leave-requests', { fromDate, toDate, reason });
  return mapLeave(response.data?.data?.leave || {});
};

export default { getAttendance, getLeaveRequests, requestLeave };