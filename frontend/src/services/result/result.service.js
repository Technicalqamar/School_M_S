import api from '../../api/axios';

const resultService = {
  getResults: async (params = {}) => {
    const response = await api.get('/results', { params });
    return response.data;
  },
};

export default resultService;