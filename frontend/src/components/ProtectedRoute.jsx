import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import FullPageLoader from './common/FullPageLoader/FullPageLoader';

const LOGIN_ROUTES = {
  admin: '/admin/login',
  teacher: '/teacher/login',
  student: '/student/login',
  receptionist: '/receptionist/login',
};

const ProtectedRoute = ({ allowedRoles, allowPasswordChange = false }) => {
  const { user, role, loading, DASHBOARD_ROUTES, CHANGE_PASSWORD_ROUTES } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!user) {
    const path = location.pathname;
    if (path.startsWith('/admin')) return <Navigate to={LOGIN_ROUTES.admin} replace />;
    if (path.startsWith('/teacher')) return <Navigate to={LOGIN_ROUTES.teacher} replace />;
    if (path.startsWith('/student')) return <Navigate to={LOGIN_ROUTES.student} replace />;
    if (path.startsWith('/receptionist')) return <Navigate to={LOGIN_ROUTES.receptionist} replace />;
    return <Navigate to={LOGIN_ROUTES.admin} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // A signed-in first-login account that reaches the *other* portal's route is
    // sent to its own change-password screen rather than the dashboard, which
    // would immediately fire blocked requests.
    if (user.mustChangePassword === true && CHANGE_PASSWORD_ROUTES[role]) {
      return <Navigate to={CHANGE_PASSWORD_ROUTES[role]} replace />;
    }
    const redirectPath = LOGIN_ROUTES[role] || DASHBOARD_ROUTES[role] || '/admin/login';
    return <Navigate to={redirectPath} replace />;
  }

  // First-login enforcement: while the temporary password is pending, no
  // protected portal route (dashboard, classes, fees, timetable, ...) may render.
  // The dedicated change-password screen opts out with `allowPasswordChange`.
  if (
    !allowPasswordChange &&
    user.mustChangePassword === true &&
    CHANGE_PASSWORD_ROUTES[role]
  ) {
    return <Navigate to={CHANGE_PASSWORD_ROUTES[role]} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
