import api from '../../api/axios';

const admitCardService = {
  getAdmitCard: async (params = {}) => {
    const response = await api.get('/admit-cards', { params });
    return response.data;
  },
};

export default admitCardService;