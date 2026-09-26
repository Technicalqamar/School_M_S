import api from '../../api/axios';

const subjectService = {
  createSubject: async (data) => {
    const response = await api.post('/subjects', data);
    return response.data;
  },

  getAllSubjects: async () => {
    const response = await api.get('/subjects');
    return response.data;
  },

  getSubjectById: async (id) => {
    const response = await api.get(`/subjects/${id}`);
    return response.data;
  },

  updateSubject: async (id, data) => {
    const response = await api.put(`/subjects/${id}`, data);
    return response.data;
  },

  deleteSubject: async (id) => {
    const response = await api.delete(`/subjects/${id}`);
    return response.data;
  },

  assignSubjectsToClass: async (className, academicYear, subjectIds) => {
    const response = await api.post('/subjects/assign-class', { className, academicYear, subjectIds });
    return response.data;
  },

  getClassAssignments: async (className, academicYear) => {
    const response = await api.get('/subjects/assign-class', { params: { className, academicYear } });
    return response.data;
  },

  getClassAssignmentYears: async () => {
    const response = await api.get('/subjects/assign-class/years');
    return response.data;
  },
};

export default subjectService;
