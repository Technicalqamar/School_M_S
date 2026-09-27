import api from '../../api/axios';

// Salary / Payroll Management API — Salary Structure endpoints.
// Backed by the `payroll` collection (recordType: salary-structure).
const payrollService = {
  getAllSalaryStructures: async (params = {}) => {
    const response = await api.get('/payroll', { params });
    return response.data;
  },

  getSalaryStructureById: async (id) => {
    const response = await api.get(`/payroll/${id}`);
    return response.data;
  },

  createSalaryStructure: async (data) => {
    const response = await api.post('/payroll', data);
    return response.data;
  },

  updateSalaryStructure: async (id, data) => {
    const response = await api.put(`/payroll/${id}`, data);
    return response.data;
  },

  deleteSalaryStructure: async (id) => {
    const response = await api.delete(`/payroll/${id}`);
    return response.data;
  },

  // Payroll record endpoints (recordType: 'payroll'). All calculations and
  // validation remain authoritative in the backend.
  generatePayroll: async (data) => {
    const response = await api.post('/payroll/generate', data);
    return response.data;
  },

  getPayrollRecords: async (params = {}) => {
    const response = await api.get('/payroll/records', { params });
    return response.data;
  },

  getPayrollRecordById: async (id) => {
    const response = await api.get(`/payroll/records/${id}`);
    return response.data;
  },

  deletePayrollRecord: async (id) => {
    const response = await api.delete(`/payroll/records/${id}`);
    return response.data;
  },

  // Salary History / Payment endpoints (recordType: 'payment'). Amount, date,
  // method and status rules remain authoritative in the backend.
  getPayments: async (params = {}) => {
    const response = await api.get('/payroll/payments', { params });
    return response.data;
  },

  getPaymentById: async (id) => {
    const response = await api.get(`/payroll/payments/${id}`);
    return response.data;
  },

  createPayment: async (data) => {
    const response = await api.post('/payroll/payments', data);
    return response.data;
  },

  updatePayment: async (id, data) => {
    const response = await api.put(`/payroll/payments/${id}`, data);
    return response.data;
  },

  deletePayment: async (id) => {
    const response = await api.delete(`/payroll/payments/${id}`);
    return response.data;
  },
};

export default payrollService;