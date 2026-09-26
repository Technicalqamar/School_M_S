import api from '../../api/axios';

/**
 * Class Students service — fetches the logged-in teacher's own assigned class
 * students from the protected GET /teacher/my-classes/:classId endpoint.
 * Server verifies the teacher is actually assigned to the class (403 otherwise).
 */

const getClassStudents = async (classId, { search } = {}) => {
  const params = search ? { search } : {};
  const response = await api.get(`/teacher/my-classes/${classId}`, { params });

  const data = response.data?.data || {};

  return {
    classId: data.classId,
    className: data.className || '',
    academicYear: data.academicYear || '',
    students: data.students || [],
  };
};

const classStudentsService = {
  getClassStudents,
};

export default classStudentsService;