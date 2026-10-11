import api, { REQUEST_TIMEOUT_MS } from '../../api/axios';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// The portal endpoints use their own Axios instance because they carry the
// short-lived admin-authorized portal token instead of the shared login token.
// It must still be bounded: without a timeout a slow/unreachable backend left
// `/portal/access/context` pending forever, so `PortalAccess` stayed on its
// "validating" loader indefinitely.
const portalApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
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