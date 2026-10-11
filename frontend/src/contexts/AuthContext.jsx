import { createContext, useState, useContext, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import authService from '../services/auth/auth.service';
import { isRequestTimeout, isNetworkError } from '../api/axios';
import { t as translate } from '../locales/index';

const AuthContext = createContext();

const DASHBOARD_ROUTES = {
  admin: '/admin',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
};

// localStorage 'user' is written with JSON.stringify at login; parse defensively
// so a malformed cache can never throw during transient-outage recovery.
const parseCachedUser = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

// Log only a sanitized, bounded subset of an error: its HTTP status and a
// truncated message. The full Axios error object can carry the request config
// (including the Authorization header) or the refresh-token request body, so
// credential-bearing data must never reach the console from the auth flows.
// All fields are safe defaults when missing.
const toSafeErrorDetails = (error) => {
  const status = error?.response?.status;
  const message = typeof error?.message === 'string' ? error.message.slice(0, 200) : null;
  return { status: status ?? null, message };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const autoLogout = localStorage.getItem('autoLogout') === 'true';
      if (autoLogout) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        if (mounted) setLoading(false);
        return;
      }

      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const response = await authService.getMe();
        if (!mounted) return;
        setUser(response.user);
        setRole(response.user.role);
      } catch (error) {
        if (!mounted) return;

        // A request timeout or a temporary network failure (slow/unreachable
        // backend) is not an authentication failure. Keep the stored credentials
        // and restore the cached session so a transient outage does not log the
        // user out or redirect to login. The `finally` below still clears
        // `loading` so the UI can recover.
        if (isRequestTimeout(error) || isNetworkError(error)) {
          setUser(parseCachedUser(localStorage.getItem('user')));
          setRole(localStorage.getItem('role') || null);
          toast.error(
            translate(
              isRequestTimeout(error) ? 'requestTimeout' : 'networkUnavailable',
              'English'
            )
          );
          return;
        }

        console.error('Session validation failed:', toSafeErrorDetails(error));
        setUser(null);
        setRole(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('role');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    return () => { mounted = false; };
  }, []);

  const login = (userData, userRole, accessToken, refreshToken) => {
    setUser(userData);
    setRole(userRole);
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('role', userRole);
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout request failed:', toSafeErrorDetails(error));
    } finally {
      setUser(null);
      setRole(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, DASHBOARD_ROUTES }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
