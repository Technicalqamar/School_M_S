import api from '../../api/axios';

const studentService = {
  createStudent: async (formData) => {
    const response = await api.post('/students', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getAllStudents: async (params = {}) => {
    const response = await api.get('/students', { params });
    return response.data;
  },

  getStudentById: async (studentId) => {
    const response = await api.get(`/students/${studentId}`);
    return response.data;
  },

  updateStudent: async (studentId, formData) => {
    const response = await api.put(`/students/${studentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteStudent: async (studentId) => {
    const response = await api.delete(`/students/${studentId}`);
    return response.data;
  },

  filterStudentsForPromotion: async (params = {}) => {
    const response = await api.get('/students/promotion/filter', { params });
    return response.data;
  },

  promoteStudents: async (data) => {
    const response = await api.post('/students/promote', data);
    return response.data;
  },

  getPromotionHistory: async (params = {}) => {
    const response = await api.get('/students/promotion-history', { params });
    return response.data;
  },

  getStudentPromotions: async (params = {}) => {
    const response = await api.get('/students/promotions', { params });
    return response.data;
  },

  deleteStudentPromotion: async (id) => {
    const response = await api.delete(`/students/promotions/${id}`);
    return response.data;
  },

  reverseStudentPromotion: async (id) => {
    const response = await api.post(`/students/promotions/${id}/reverse`);
    return response.data;
  },
};

export default studentService;
