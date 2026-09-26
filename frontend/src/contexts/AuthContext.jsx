import { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/auth/auth.service';

const AuthContext = createContext();

const DASHBOARD_ROUTES = {
  admin: '/admin',
  teacher: '/teacher/dashboard',
  student: '/student/dashboard',
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
        console.error('Session validation failed:', error);
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
      console.error('Logout request failed:', error);
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
