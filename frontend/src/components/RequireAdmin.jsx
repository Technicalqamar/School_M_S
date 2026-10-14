import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Route-level guard for Admin-only pages inside the shared /admin tree
// (currently the "Receptionist Management" module). Any non-admin - including a
// receptionist who holds every module grant - is sent to the access-denied
// page. The backend enforces the same on every `/receptionists` API call, so
// this is UX mirroring of a server-side rule.
const RequireAdmin = ({ children }) => {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (role !== 'admin') return <Navigate to="/admin/access-denied" replace />;
  return children;
};

export default RequireAdmin;