import api from '../../api/axios';

const classService = {
  createClass: async (data) => {
    const response = await api.post('/classes', data);
    return response.data;
  },

  getAllClasses: async () => {
    const response = await api.get('/classes');
    return response.data;
  },

  updateClass: async (id, data) => {
    const response = await api.put(`/classes/${id}`, data);
    return response.data;
  },

  deleteClass: async (id) => {
    const response = await api.delete(`/classes/${id}`);
    return response.data;
  },

  getClassDetails: async (id) => {
    const response = await api.get(`/classes/${id}/details`);
    return response.data;
  },

  getClassTeacherAssignments: async (id) => {
    const response = await api.get(`/classes/${id}/teacher-assignments`);
    return response.data;
  },

  assignTeacherSubject: async (id, data) => {
    const response = await api.post(`/classes/${id}/teacher-assignments`, data);
    return response.data;
  },

  removeTeacherSubject: async (id, teacherId, subjectId) => {
    const response = await api.delete(`/classes/${id}/teacher-assignments/${teacherId}/${subjectId}`);
    return response.data;
  },
};

export default classService;
