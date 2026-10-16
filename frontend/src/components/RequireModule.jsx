import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  hasModuleAccess,
  hasAnyReceptionistModuleAccess,
  RECEPTIONIST_BASE_PATH,
} from '../constants/receptionistPermissions';

// Route-level guard for the shared Admin pages.
//
// Admins pass unconditionally. A receptionist is allowed only when their stored
// permission set - attached by the backend at login and re-derived via /auth/me
// on every refresh - matches the guard:
//   * with a `page` prop: the whole-module grant or the exact page grant
//     (hasModuleAccess);
//   * without a `page` prop: any grant inside the module (module key, any page
//     key or any action key - hasAnyReceptionistModuleAccess).
// Denied users are redirected to an honest "access denied" page instead of the
// dashboard.
//
// This is UX, not the security boundary: every admin API route is re-checked
// server-side with `requireModuleAccess` / `requireActionAccess`, so a direct
// URL or API call can never bypass the permission model.
const RequireModule = ({ module, page, children }) => {
  const { user, role, loading } = useAuth();
  const { pathname } = useLocation();
  // Keep redirects inside the namespace the user is already in: a receptionist
  // stays under `/receptionist`, everyone else under `/admin`.
  const base = pathname.startsWith(RECEPTIONIST_BASE_PATH) ? RECEPTIONIST_BASE_PATH : '/admin';

  if (loading) return null;
  if (!user) return <Navigate to={`${base}/login`} replace />;
  if (role === 'admin') return children;

  const allowed = page
    ? hasModuleAccess(user, module, page)
    : hasAnyReceptionistModuleAccess(user, module);

  if (!allowed) {
    return <Navigate to={`${base}/access-denied`} replace />;
  }
  return children;
};

export default RequireModule;