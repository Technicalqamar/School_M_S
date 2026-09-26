import api from '../../api/axios';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const portalApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const portalService = {
  openPortal: async (studentId) => {
    const response = await api.post(`/students/${studentId}/open-portal`);
    return response.data;
  },

  getPortalContext: async (accessToken) => {
    const response = await portalApi.get('/portal/access/context', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  },

  endPortalAccess: async (accessToken) => {
    const response = await portalApi.post(
      '/portal/access/end',
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
  },
};

export default portalService;