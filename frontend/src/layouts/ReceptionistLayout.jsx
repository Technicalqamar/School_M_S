import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  HomeIcon,
  UsersIcon,
  CheckCircleIcon,
  BanknotesIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import ReceptionistSidebar from '../components/layout/ReceptionistSidebar/ReceptionistSidebar';
import ReceptionistHeader from '../components/layout/ReceptionistHeader/ReceptionistHeader';
import MobileBottomNav from '../components/layout/MobileBottomNav/MobileBottomNav';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../constants/receptionistPermissions';

/**
 * Shell for the Receptionist portal, following the exact structure of the
 * Teacher/Student layouts:
 *  - fixed header with the shared date/time, theme toggle and profile menu;
 *  - permission-filtered desktop sidebar from `md` up;
 *  - shared MobileBottomNav below `md` (bottom bar plus More sheet);
 *  - scroller region with header + bottom-bar safe-area padding.
 *
 * The sidebar and bottom nav only list modules the signed-in receptionist is
 * actually permitted to open. Every item points at a real, registered route so
 * navigation never falls into a redirect loop.
 */
const ReceptionistLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  // Implemented, permission-gated modules in the agreed order. Unimplemented
  // catalogue modules (admissions, parents, reports) are intentionally absent -
  // they are not grantable and have no working data behind their route.
  const allowedItems = [
    { permission: 'dashboard.view', to: '/receptionist/dashboard', end: true, labelKey: 'Dashboard', icon: HomeIcon },
    { permission: 'students.view', to: '/receptionist/students', end: false, labelKey: 'Student Records', icon: UsersIcon },
    { permission: 'attendance.view', to: '/receptionist/attendance', end: false, labelKey: 'Student Attendance', icon: CheckCircleIcon },
    { permission: 'fees.view', to: '/receptionist/fees', end: false, labelKey: 'Fees & Dues', icon: BanknotesIcon },
    { permission: 'notices.view', to: '/receptionist/notices', end: false, labelKey: 'Notices', icon: MegaphoneIcon },
  ].filter((item) => hasPermission(user, item.permission));

  // Same split as the Teacher/Student layouts: four destinations on the bar,
  // the rest in the More sheet. The `permission` key is intentionally not
  // forwarded - MobileBottomNav only knows nav items.
  const toNavItem = (item) => ({ to: item.to, end: item.end, labelKey: item.labelKey, icon: item.icon });
  const primaryItems = allowedItems.slice(0, 4).map(toNavItem);
  const moreItems = allowedItems.slice(4).map(toNavItem);

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <ReceptionistHeader sidebarOpen={sidebarOpen} />
      <div className="flex h-full">
        <ReceptionistSidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
        {/* Bottom padding clears the fixed mobile bottom bar; `md:pb-6` restores
            the desktop value from `md` up where the bar does not render. */}
        <main className="flex-1 overflow-y-auto pt-16 px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pb-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav primaryItems={primaryItems} moreItems={moreItems} />
    </div>
  );
};

export default ReceptionistLayout;