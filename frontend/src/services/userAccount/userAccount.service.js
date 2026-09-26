import api from '../../api/axios';

const userAccountService = {
  createAccount: async (data) => {
    const response = await api.post('/user-accounts', data);
    return response.data;
  },

  getAllAccounts: async (params = {}) => {
    const response = await api.get('/user-accounts', { params });
    return response.data;
  },

  getAccountById: async (id) => {
    const response = await api.get(`/user-accounts/${id}`);
    return response.data;
  },

  updateAccount: async (id, data) => {
    const response = await api.put(`/user-accounts/${id}`, data);
    return response.data;
  },

  updateAccountStatus: async (id, isActive) => {
    const response = await api.patch(`/user-accounts/${id}/status`, { isActive });
    return response.data;
  },

  updatePassword: async (id, newPassword) => {
    const response = await api.patch(`/user-accounts/${id}/password`, { newPassword });
    return response.data;
  },

  deleteAccount: async (id) => {
    const response = await api.delete(`/user-accounts/${id}`);
    return response.data;
  },

  getAvailableProfiles: async (role, search = '') => {
    const response = await api.get(`/user-accounts/available/${role}`, { params: { search } });
    return response.data;
  },
};

export default userAccountService;
