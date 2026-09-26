import api from '../../api/axios';

const leaveService = {
  getLeaves: async (filters = {}) => {
    const params = {};
    if (filters.type && filters.type !== 'All') params.type = filters.type;
    if (filters.status && filters.status !== 'All') params.status = filters.status;
    if (filters.academicYear) params.academicYear = filters.academicYear;
    if (filters.search) params.search = filters.search;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;

    const response = await api.get('/leaves', { params });
    return response.data?.data || { leaves: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0 } };
  },

  getLeaveById: async (id) => {
    const response = await api.get(`/leaves/${id}`);
    return response.data?.data?.leave || null;
  },

  createLeave: async (data) => {
    const response = await api.post('/leaves', data);
    return response.data?.data?.leave || null;
  },

  updateLeave: async (id, data) => {
    const response = await api.put(`/leaves/${id}`, data);
    return response.data?.data?.leave || null;
  },

  approveLeave: async (id) => {
    const response = await api.patch(`/leaves/${id}/approve`);
    return response.data?.data?.leave || null;
  },

  rejectLeave: async (id) => {
    const response = await api.patch(`/leaves/${id}/reject`);
    return response.data?.data?.leave || null;
  },

  deleteLeave: async (id) => {
    const response = await api.delete(`/leaves/${id}`);
    return response.data;
  },
};

export default leaveService;