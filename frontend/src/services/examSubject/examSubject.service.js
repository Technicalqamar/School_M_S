import api from '../../api/axios';

const examSubjectService = {
  getAllExamSubjects: async (params = {}) => {
    const response = await api.get('/exam-subjects', { params });
    return response.data;
  },

  getExamSubjectById: async (id) => {
    const response = await api.get(`/exam-subjects/${id}`);
    return response.data;
  },

  createExamSubject: async (data) => {
    const response = await api.post('/exam-subjects', data);
    return response.data;
  },

  updateExamSubject: async (id, data) => {
    const response = await api.put(`/exam-subjects/${id}`, data);
    return response.data;
  },

  deleteExamSubject: async (id) => {
    const response = await api.delete(`/exam-subjects/${id}`);
    return response.data;
  },
};

export default examSubjectService;