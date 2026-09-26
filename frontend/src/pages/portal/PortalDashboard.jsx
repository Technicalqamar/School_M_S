import StudentDashboard from '../student/StudentDashboard';
import { usePortal } from '../../contexts/PortalContext';

const PortalDashboard = () => {
  const portal = usePortal();

  return (
    <StudentDashboard portalContext={{ user: portal?.user, onExit: portal?.onExit }} />
  );
};

export default PortalDashboard;