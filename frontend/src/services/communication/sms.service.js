import api from '../../api/axios';

const AUDIENCES = ['All', 'Students', 'Teachers', 'Parents', 'Staff'];
const STATUSES = ['Pending', 'Sent', 'Failed'];

const normalizeSms = (sms) => {
  if (!sms) return null;
  return { ...sms, id: sms.id || sms._id };
};

const smsService = {
  getSmsMessages: async (filters = {}) => {
    const params = {};
    if (filters.audience && filters.audience !== 'All') params.audience = filters.audience;
    if (filters.status && filters.status !== 'All') params.status = filters.status;
    if (filters.search) params.search = filters.search;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    const response = await api.get('/communication/sms', { params });
    const data = response.data?.data || {};
    return {
      sms: (data.sms || []).map(normalizeSms),
      pagination: data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 },
    };
  },

  getSmsMessageById: async (id) => {
    const response = await api.get(`/communication/sms/${id}`);
    return normalizeSms(response.data?.data?.sms) || null;
  },

  createSmsMessage: async (data) => {
    const response = await api.post('/communication/sms', data);
    return normalizeSms(response.data?.data?.sms) || null;
  },

  updateSmsMessageStatus: async (id, status) => {
    const response = await api.put(`/communication/sms/${id}`, { status });
    return normalizeSms(response.data?.data?.sms) || null;
  },

  deleteSmsMessage: async (id) => {
    const response = await api.delete(`/communication/sms/${id}`);
    return response.data;
  },

  AUDIENCES,
  STATUSES,
};

export default smsService;