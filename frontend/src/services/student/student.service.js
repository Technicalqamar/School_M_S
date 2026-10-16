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

  // Sends one in-app notice/reminder to this single student's portal inbox. The
  // recipient is resolved server-side from the student id; the body only carries
  // the message details. The `notices` route is the canonical single-recipient
  // endpoint (the older `/notice` route is kept as an alias).
  sendStudentNotice: async (studentId, data) => {
    const response = await api.post(`/students/${studentId}/notices`, data);
    return response.data;
  },

  // Resolves, server-side, who would actually receive a single-student notice:
  // the student's own active portal account (there is no parent portal), plus
  // the guardian contact on file for display only. The frontend must gate the
  // send button on this value rather than on guardian contact alone.
  getNoticeRecipient: async (studentId) => {
    const response = await api.get(`/students/${studentId}/notice-recipient`);
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
