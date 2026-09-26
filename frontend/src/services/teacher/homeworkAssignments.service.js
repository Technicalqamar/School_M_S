import api from '../../api/axios';

/**
 * Homework / Assignments service — wired to the protected teacher endpoints:
 *   GET    /api/v1/teacher/homework        (list, supports search/status/classId/subjectId/page/limit)
 *   POST   /api/v1/teacher/homework        (create)
 *   GET    /api/v1/teacher/homework/:id    (single)
 *   PATCH  /api/v1/teacher/homework/:id    (update)
 *   DELETE /api/v1/teacher/homework/:id    (delete)
 *
 * The server only returns/creates rows owned by the logged-in teacher and only
 * for classes/subjects the teacher is assigned to (403 otherwise).
 */

const normalizeAssignment = (a) => ({
  id: a.id,
  classId: a.classId,
  className: a.className,
  academicYear: a.academicYear,
  subjectId: a.subjectId,
  subject: a.subjectName || '',
  subjectCode: a.subjectCode || '',
  title: a.title,
  description: a.description || '',
  dueDate: a.dueDate,
  status: a.status,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

const getAssignedContext = async () => {
  const response = await api.get('/teacher/my-classes');

  const data = response.data?.data || {};

  const classes = (data.classes || []).map((cls) => ({
    classId: cls.classId,
    className: cls.className,
    subjects: (cls.subjects || []).map((subject) => ({
      id: subject.id,
      subjectName: subject.subjectName,
      subjectCode: subject.subjectCode || '',
    })),
  }));

  return { classes };
};

const getAssignments = async (params = {}) => {
  const response = await api.get('/teacher/homework', { params });

  const data = response.data?.data || {};

  return {
    assignments: (data.assignments || []).map(normalizeAssignment),
    total: data.total || 0,
    page: data.page || 1,
    limit: data.limit || 20,
  };
};

const getAssignment = async (id) => {
  const response = await api.get(`/teacher/homework/${id}`);
  return response.data?.data;
};

const createAssignment = async (payload) => {
  const response = await api.post('/teacher/homework', payload);
  return response.data?.data;
};

const updateAssignment = async (id, payload) => {
  const response = await api.patch(`/teacher/homework/${id}`, payload);
  return response.data?.data;
};

const deleteAssignment = async (id) => {
  const response = await api.delete(`/teacher/homework/${id}`);
  return response.data?.data;
};

const homeworkAssignmentsService = {
  getAssignedContext,
  getAssignments,
  getAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
};

export default homeworkAssignmentsService;