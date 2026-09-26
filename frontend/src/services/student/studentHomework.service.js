import api from '../../api/axios';

/**
 * Student Homework / Assignments service.
 *
 * Backed by the protected student endpoints:
 *   GET /api/v1/student/homework (list, supports search/status/subject/page/limit)
 *   GET /api/v1/student/homework/:id (single)
 *
 * The server only ever returns assignments for the logged-in student's class;
 * the student's identity always comes from the authenticated session. No
 * create/edit/delete capabilities exist for students at the API level, so this
 * service exposes reads only.
 */

export const STUDENT_ASSIGNMENT_STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'];

const normalizeAssignment = (a) => ({
  id: a.id || a._id,
  classId: a.classId,
  className: a.className,
  academicYear: a.academicYear,
  subjectId: a.subjectId,
  subject: a.subject || a.subjectName || '',
  subjectCode: a.subjectCode || '',
  teacherName: a.teacherName || '',
  teacherCode: a.teacherCode || '',
  title: a.title,
  description: a.description || '',
  dueDate: a.dueDate,
  status: a.status,
  assignedDate: a.assignedDate || a.createdAt,
  updatedAt: a.updatedAt,
});

/**
 * Fetches the logged-in student's assignments (own class only).
 * @param {{ search?: string, subject?: string, status?: string, page?: number, limit?: number }} [params]
 */
const getAssignments = async (params = {}) => {
  const response = await api.get('/student/homework', { params });
  const data = response.data?.data || {};

  return {
    assignments: (data.assignments || []).map(normalizeAssignment),
    total: data.total ?? (data.assignments || []).length,
    subjects: data.subjects || [],
    page: data.page,
    limit: data.limit,
  };
};

/**
 * Fetches a single assignment by id. Throws on missing/foreign-class/invalid id.
 */
const getAssignment = async (id) => {
  const response = await api.get(`/student/homework/${id}`);
  const data = response.data?.data;
  return data ? normalizeAssignment(data) : null;
};

const studentHomeworkService = {
  getAssignments,
  getAssignment,
};

export default studentHomeworkService;