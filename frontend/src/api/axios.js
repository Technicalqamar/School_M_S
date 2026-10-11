import axios from 'axios';
import {
  getPortalAccessToken,
  isPortalSessionExpired,
  expirePortalAccessToken,
} from './portalSession';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// Bound every shared request so a slow/cold backend settles into a visible
// timeout instead of leaving a loading spinner running indefinitely.
export const REQUEST_TIMEOUT_MS = 20000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// A client-side timeout is NOT an authentication failure: Axios reports it with
// no `response`, so it must never run through the 401 refresh/logout flow.
// Detects the codes Axios uses (ECONNABORTED / ETIMEDOUT) plus a defensive
// message check, and honours the flag set in the response interceptor below.
export const isRequestTimeout = (error) => {
  if (!error || error.response) return false;
  return (
    error.isRequestTimeout === true ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    (typeof error.message === 'string' && /timeout/i.test(error.message))
  );
};

// A temporary network failure (server unreachable, connection refused/dropped,
// DNS failure) is also NOT an authentication failure. Like a timeout, Axios
// reports it with no `response`, so it must never run through the 401
// refresh/logout flow. Only errors with NO HTTP response are treated as network
// failures: a real `401`/`403` carries `error.response` and is still handled by
// the authentication flow below. Timeouts stay handled separately, above.
export const isNetworkError = (error) => {
  if (!error || error.response) return false;
  if (error.isRequestTimeout === true || isRequestTimeout(error)) return false;
  return (
    error.isNetworkError === true ||
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ECONNRESET' ||
    error.code === 'ENOTFOUND' ||
    error.code === 'EAI_AGAIN' ||
    error.code === 'EHOSTUNREACH' ||
    error.code === 'ENETUNREACH' ||
    (typeof error.message === 'string' && /network error/i.test(error.message))
  );
};

// Error used when a portal request is attempted after the portal session ended.
const createPortalExpiredError = () => {
  const error = new Error('Portal access expired');
  error.isPortalSessionExpired = true;
  return error;
};

// Request Interceptor: Attach Token + Handle FormData
api.interceptors.request.use(
  (config) => {
    const portalToken = getPortalAccessToken();
    if (portalToken) {
      config.headers.Authorization = `Bearer ${portalToken}`;
    } else if (isPortalSessionExpired()) {
      // The admin-authorized portal session already ended (401). Block the call
      // instead of silently falling back to the Admin/Teacher/Student token that
      // shares this browser's localStorage, and avoid repeated failing requests.
      return Promise.reject(createPortalExpiredError());
    } else {
      const accessToken = localStorage.getItem('accessToken');
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
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

    // Handle a request timeout separately from authentication errors. A timeout
    // has no HTTP response; surface it untouched so callers can recover the UI
    // without clearing tokens, logging out, or redirecting to a login page.
    if (isRequestTimeout(error)) {
      error.isRequestTimeout = true;
      return Promise.reject(error);
    }

    // A temporary network failure (no HTTP response) is likewise surfaced
    // untouched so callers can recover the UI without clearing tokens, logging
    // out, or redirecting to a login page. Genuine `401`/`403` responses carry
    // `error.response` and fall through to the authentication flow below.
    if (isNetworkError(error)) {
      error.isNetworkError = true;
      return Promise.reject(error);
    }

    // Skip refresh logic for login requests (public endpoints) and for Admin
    // Portal Access sessions (the portal token has no refresh token, and the
    // shared admin credentials in localStorage must not be rotated from here).
    const isLoginRequest = originalRequest?.url?.includes('/login');
    // A portal session is one that currently carries a portal token OR one that
    // already ended (token cleared, flagged) in this tab.
    const isPortalSession = Boolean(getPortalAccessToken()) || isPortalSessionExpired();

    // Admin-authorized Student Portal sessions have no refresh token. A 401
    // means the short-lived portal token expired: clear only the portal token
    // and let the portal route render its existing "expired" state. Never run
    // the refresh flow here and never touch the login tokens in localStorage.
    if (error.response?.status === 401 && isPortalSession && !originalRequest?._retry) {
      if (originalRequest) originalRequest._retry = true;
      expirePortalAccessToken();
      return Promise.reject(error);
    }

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
            .post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken }, { timeout: REQUEST_TIMEOUT_MS })
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
        // A slow/timed-out refresh is a transient network problem, not a
        // rejected session: keep the stored credentials so the user is not
        // force-logged-out or redirected to a login page.
        if (isRequestTimeout(refreshError)) {
          refreshError.isRequestTimeout = true;
          return Promise.reject(refreshError);
        }

        // A temporary network failure during refresh is also transient: keep the
        // access token, refresh token and cached user so a later user action can
        // retry naturally. The original request is rejected (no infinite retry
        // loop) and the session is never cleared for an unreachable server.
        if (isNetworkError(refreshError)) {
          refreshError.isNetworkError = true;
          return Promise.reject(refreshError);
        }

        // Only a genuine invalid/expired/revoked refresh token reaches here and
        // follows the existing security logout/redirect flow.
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
