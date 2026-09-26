import api from '../../api/axios';

const markService = {
  getAllMarks: async (params = {}) => {
    const response = await api.get('/marks', { params });
    return response.data;
  },

  getMarkById: async (id) => {
    const response = await api.get(`/marks/${id}`);
    return response.data;
  },

  createMark: async (data) => {
    const response = await api.post('/marks', data);
    return response.data;
  },

  updateMark: async (id, data) => {
    const response = await api.put(`/marks/${id}`, data);
    return response.data;
  },

  bulkSaveMarks: async (data) => {
    const response = await api.post('/marks/bulk', data);
    return response.data;
  },

  deleteMark: async (id) => {
    const response = await api.delete(`/marks/${id}`);
    return response.data;
  },
};

export default markService;