import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  BellIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import StudentSidebar from '../components/layout/StudentSidebar/StudentSidebar';
import StudentHeader from '../components/layout/StudentHeader/StudentHeader';
import MobileBottomNav from '../components/layout/MobileBottomNav/MobileBottomNav';
import useNoticeUnreadCount from '../hooks/useNoticeUnreadCount';
import studentNoticesService from '../services/student/studentNotices.service';
import { usePortal } from '../contexts/PortalContext';

/**
 * Shell for the Student Portal (and the parent-linked `/portal/access` variant,
 * which renders the same modules).
 *
 * Desktop/tablet (`md` and up) is unchanged: the existing sidebar is the primary
 * navigation and keeps its module order, collapse behaviour and Notices badge.
 *
 * Below `md` the sidebar is no longer the primary navigation — the bottom bar is.
 * The sidebar is therefore always parked off-canvas at those widths, and its
 * mobile drawer affordance has been removed (every module it reached is reachable
 * from the bottom bar or its More sheet), so the header stays uncluttered and the
 * existing Notification Bell keeps its place there.
 */
const StudentLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);
  const portal = usePortal();
  const base = portal?.isPortalAccess ? '/portal/access' : '/student/dashboard';

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Single source of truth for the unread *notice* badge, shared by the desktop
  // sidebar and the mobile More sheet. Notification counts are never mixed in.
  const unreadNotices = useNoticeUnreadCount(studentNoticesService);

  // Exactly four destinations plus More, in the agreed mobile order:
  // Dashboard, Homework / Assignments, Fees, Attendance, More.
  // These are existing Student Portal routes only — no new destinations, so the
  // existing role permissions are unchanged.
  const primaryItems = [
    { to: base, end: true, labelKey: 'dashboard', icon: HomeIcon },
    { to: `${base}/homework`, end: false, labelKey: 'homeworkTab', icon: ClipboardDocumentListIcon },
    { to: `${base}/fees`, end: false, labelKey: 'fees', icon: BanknotesIcon },
    { to: `${base}/attendance`, end: false, labelKey: 'attendance', icon: CheckCircleIcon },
  ];

  // The More sheet holds exactly three destinations: Examination, Notices,
  // Notifications. Examination moved here from the bottom bar on purpose.
  // Class Schedule is left out: it is not a sidebar module today (it is reached
  // from the dashboard Quick Access), and adding it here would change the module
  // list rather than mirror it.
  const moreItems = [
    { to: `${base}/examination`, end: false, labelKey: 'examination', icon: AcademicCapIcon },
    { to: `${base}/notices`, end: false, labelKey: 'notices', icon: MegaphoneIcon, showNoticeBadge: true },
    { to: `${base}/notifications`, end: false, labelKey: 'notifications', icon: BellIcon },
  ];

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <StudentHeader sidebarOpen={sidebarOpen} />
      <div className="flex h-full">
        <StudentSidebar
          isOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          unreadNotices={unreadNotices}
        />
        {/* Extra bottom padding below `md` so the fixed bottom bar never covers
            the end of the page content; `md:pb-6` restores the original value
            from `md` up, where the bar does not render. */}
        <main className="flex-1 overflow-y-auto pt-16 px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pb-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          {children ?? <Outlet />}
        </main>
      </div>
      <MobileBottomNav
        primaryItems={primaryItems}
        moreItems={moreItems}
        unreadNotices={unreadNotices}
      />
    </div>
  );
};

export default StudentLayout;
