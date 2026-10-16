import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RECEPTIONIST_BASE_PATH } from '../constants/receptionistPermissions';

// Route-level guard for Admin-only pages inside the shared /admin tree
// (currently the "Receptionist Management" module). Any non-admin - including a
// receptionist who holds every module grant - is sent to the access-denied
// page. The backend enforces the same on every `/receptionists` API call, so
// this is UX mirroring of a server-side rule.
const RequireAdmin = ({ children }) => {
  const { user, role, loading } = useAuth();
  const { pathname } = useLocation();
  // Stay inside the namespace the user is already in (Admin vs Receptionist).
  const base = pathname.startsWith(RECEPTIONIST_BASE_PATH) ? RECEPTIONIST_BASE_PATH : '/admin';

  if (loading) return null;
  if (!user) return <Navigate to={`${base}/login`} replace />;
  if (role !== 'admin') return <Navigate to={`${base}/access-denied`} replace />;
  return children;
};

export default RequireAdmin;