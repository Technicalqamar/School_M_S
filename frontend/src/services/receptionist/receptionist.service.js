import api from '../../api/axios';

// Admin-side receptionist account management for the standalone Receptionist
// Management module. Every call hits an Admin-only endpoint; the backend
// re-checks authorization and validates all input.
//
// There is deliberately no portal (self-service) object: receptionists open the
// shared Admin pages directly. Passwords are assigned by an Admin at creation
// and - if a receptionist forgets theirs - reset through
// `resetReceptionistPassword` (also Admin-only). The password is never read
// back or displayed anywhere.
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
    const response = await api.patch(`/receptionists/${id}/reset-password`, { newPassword });
    return response.data;
  },

  deleteReceptionist: async (id) => {
    const response = await api.delete(`/receptionists/${id}`);
    return response.data;
  },
};

const receptionistService = { ...admin };

export default receptionistService;