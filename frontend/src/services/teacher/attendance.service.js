import api from '../../api/axios';

/**
 * Teacher Attendance service — the integration point for the Teacher
 * "Attendance" page.
 *
 * Backed by the existing Attendance / Leave / Timetable / School Settings
 * architecture through the protected `/api/v1/teacher/*` endpoints. The
 * logged-in teacher is ALWAYS derived from the authenticated session on the
 * backend — this service never sends a teacher/class selector.
 *
 *   - My Attendance      → GET /teacher/attendance            (READ-ONLY)
 *   - My Leave Requests  → GET|POST /teacher/leave-requests   (existing Leave system)
 *   - Manual Student Attendance → GET|POST /teacher/student-attendance
 *
 * Manual Student Attendance is gated by the School Settings flag "Teacher
 * Manual Student Attendance" (default OFF). When OFF the backend denies with
 * 403, so the page hides the section. When ON, the responsible class is the
 * one derived from the teacher's FIRST scheduled timetable period — the page
 * never offers a class selector.
 */

const getMyAttendance = async () => {
  const response = await api.get('/teacher/attendance');
  return response.data;
};

const getMyLeaveRequests = async () => {
  const response = await api.get('/teacher/leave-requests');
  return response.data;
};

const requestLeave = async (data) => {
  const response = await api.post('/teacher/leave-requests', data);
  return response.data;
};

const getResponsibleClass = async () => {
  const response = await api.get('/teacher/student-attendance/class');
  return response.data;
};

const getClassStudents = async (params = {}) => {
  const response = await api.get('/teacher/student-attendance/students', { params });
  return response.data;
};

const saveStudentAttendance = async (data) => {
  const response = await api.post('/teacher/student-attendance', data);
  return response.data;
};

const attendanceService = {
  getMyAttendance,
  getMyLeaveRequests,
  requestLeave,
  getResponsibleClass,
  getClassStudents,
  saveStudentAttendance,
};

export default attendanceService;