import api from '../../api/axios';

const feeService = {
  createFeeStructure: async (data) => {
    const response = await api.post('/fees/structures', data);
    return response.data;
  },

  getAllFeeStructures: async () => {
    const response = await api.get('/fees/structures');
    return response.data;
  },

  updateFeeStructure: async (id, data) => {
    const response = await api.put(`/fees/structures/${id}`, data);
    return response.data;
  },

  deleteFeeStructure: async (id) => {
    const response = await api.delete(`/fees/structures/${id}`);
    return response.data;
  },

  collectFee: async (data) => {
    const response = await api.post('/fees/collections', data);
    return response.data;
  },

  getStudentPayments: async (params = {}) => {
    const response = await api.get('/fees/collections', { params });
    return response.data;
  },

  getOutstandingDues: async () => {
    const response = await api.get('/fees/outstanding-dues');
    return response.data;
  },

  generateReport: async (params = {}) => {
    const response = await api.get('/fees/reports', { params });
    return response.data;
  },

  searchFeeReportStudents: async (query) => {
    const response = await api.get('/fees/reports/students', { params: { query } });
    return response.data;
  },

  generateVouchers: async (data) => {
    const response = await api.post('/fees/vouchers', data);
    return response.data;
  },

  getVouchers: async (params = {}) => {
    const response = await api.get('/fees/vouchers', { params });
    return response.data;
  },

  getVoucher: async (voucherId) => {
    const response = await api.get(`/fees/vouchers/${voucherId}`);
    return response.data;
  },
};

export default feeService;