import api from '../../api/axios';

// Admin-side receptionist account management. Every call hits an Admin-only
// endpoint; the backend re-checks authorization and validates all input.
const admin = {
  createReceptionist: async (data) => {
    const response = await api.post('/receptionists', data);
    return response.data;
  },

  getReceptionists: async (params = {}) => {
    const response = await api.get('/receptionists', { params });
    return response.data;
  },

  getReceptionistById: async (id) => {
    const response = await api.get(`/receptionists/${id}`);
    return response.data;
  },

  updateReceptionist: async (id, data) => {
    const response = await api.put(`/receptionists/${id}`, data);
    return response.data;
  },

  updateReceptionistStatus: async (id, isActive) => {
    const response = await api.patch(`/receptionists/${id}/status`, { isActive });
    return response.data;
  },

  updateReceptionistPermissions: async (id, permissions) => {
    const response = await api.patch(`/receptionists/${id}/permissions`, { permissions });
    return response.data;
  },

  resetReceptionistPassword: async (id, newPassword) => {
    const response = await api.patch(`/receptionists/${id}/password`, { newPassword });
    return response.data;
  },

  deleteReceptionist: async (id) => {
    const response = await api.delete(`/receptionists/${id}`);
    return response.data;
  },
};

// Receptionist portal (self) endpoints. Each is independently permission-gated
// on the server, so the UI must handle a 403 gracefully.
const portal = {
  getDashboard: async () => {
    const response = await api.get('/receptionist/dashboard');
    return response.data;
  },

  getStudents: async (params = {}) => {
    const response = await api.get('/receptionist/students', { params });
    return response.data;
  },

  getStudentByStudentId: async (studentId) => {
    const response = await api.get(`/receptionist/students/${studentId}`);
    return response.data;
  },
};

const receptionistService = { ...admin, ...portal };

export default receptionistService;
