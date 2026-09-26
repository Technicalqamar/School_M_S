import api from '../../api/axios';

export const EXAM_TYPES = ['Mid Term', 'Final Term'];

export const EXAM_STATUSES = ['Active', 'Inactive'];

const examService = {
  getAllExams: async (params = {}) => {
    const response = await api.get('/exams', { params });
    return response.data;
  },

  getExamById: async (id) => {
    const response = await api.get(`/exams/${id}`);
    return response.data;
  },

  createExam: async (data) => {
    const response = await api.post('/exams', data);
    return response.data;
  },

  updateExam: async (id, data) => {
    const response = await api.put(`/exams/${id}`, data);
    return response.data;
  },

  deleteExam: async (id) => {
    const response = await api.delete(`/exams/${id}`);
    return response.data;
  },
};

export default examService;