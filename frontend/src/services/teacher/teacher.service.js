import api from '../../api/axios';

const teacherService = {
  createTeacher: async (formData) => {
    const response = await api.post('/teachers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getAllTeachers: async (params = {}) => {
    const response = await api.get('/teachers', { params });
    return response.data;
  },

  getTeacherById: async (teacherId) => {
    const response = await api.get(`/teachers/${teacherId}`);
    return response.data;
  },

  updateTeacher: async (teacherId, formData) => {
    const response = await api.put(`/teachers/${teacherId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteTeacher: async (teacherId) => {
    const response = await api.delete(`/teachers/${teacherId}`);
    return response.data;
  },
};

export default teacherService;
