import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import FullPageLoader from './common/FullPageLoader/FullPageLoader';

const LOGIN_ROUTES = {
  admin: '/admin/login',
  teacher: '/teacher/login',
  student: '/student/login',
};

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, role, loading, DASHBOARD_ROUTES } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!user) {
    const path = location.pathname;
    if (path.startsWith('/admin')) return <Navigate to={LOGIN_ROUTES.admin} replace />;
    if (path.startsWith('/teacher')) return <Navigate to={LOGIN_ROUTES.teacher} replace />;
    if (path.startsWith('/student')) return <Navigate to={LOGIN_ROUTES.student} replace />;
    return <Navigate to={LOGIN_ROUTES.admin} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const redirectPath = LOGIN_ROUTES[role] || DASHBOARD_ROUTES[role] || '/admin/login';
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
