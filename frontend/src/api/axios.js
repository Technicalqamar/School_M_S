import axios from 'axios';
import { getPortalAccessToken } from './portalSession';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Token + Handle FormData
api.interceptors.request.use(
  (config) => {
    const accessToken = getPortalAccessToken() || localStorage.getItem('accessToken');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    if (config.data instanceof FormData) {
      config.headers.delete('Content-Type');
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Token Expiration
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh logic for login requests (public endpoints) and for Admin
    // Portal Access sessions (the portal token has no refresh token, and the
    // shared admin credentials in localStorage must not be rotated from here).
    const isLoginRequest = originalRequest?.url?.includes('/login');
    const isPortalSession = Boolean(getPortalAccessToken());
    if (error.response?.status === 401 && !originalRequest._retry && !isLoginRequest && !isPortalSession) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Deduplicate concurrent refresh calls. On app reload several
        // authenticated requests (e.g. /auth/me, school settings, notification
        // unread count) fire at the same time. If the access token is expired
        // they all receive 401 and would each try to refresh with the same
        // refresh token. The backend rotates/revokes the refresh token after
        // the first successful refresh, so every other concurrent attempt
        // fails and a valid session gets wiped. Sharing one refresh promise
        // ensures a single refresh is sent and all requests retry with the
        // same new access token.
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken })
            .then((response) => {
              const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
              localStorage.setItem('accessToken', newAccessToken);
              if (newRefreshToken) {
                localStorage.setItem('refreshToken', newRefreshToken);
              }
              return newAccessToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        const userRole = localStorage.getItem('role');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        const loginRoutes = { admin: '/admin/login', teacher: '/teacher/login', student: '/student/login' };
        window.location.replace(loginRoutes[userRole] || '/admin/login');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
