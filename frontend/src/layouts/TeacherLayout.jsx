import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import {
  HomeIcon,
  ClipboardDocumentListIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  BellIcon,
  MegaphoneIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import TeacherSidebar from '../components/layout/TeacherSidebar/TeacherSidebar';
import TeacherHeader from '../components/layout/TeacherHeader/TeacherHeader';
import MobileBottomNav from '../components/layout/MobileBottomNav/MobileBottomNav';
import useNoticeUnreadCount from '../hooks/useNoticeUnreadCount';
import teacherNoticesService from '../services/teacher/teacherNotices.service';

/**
 * Shell for the Teacher Panel.
 *
 * Desktop/tablet (`md` and up) is unchanged: the existing sidebar is the primary
 * navigation and keeps its module order, collapsible Examination group, collapse
 * behaviour and Notices badge.
 *
 * Below `md` the sidebar is no longer the primary navigation — the bottom bar is.
 * The sidebar is therefore always parked off-canvas at those widths, and its
 * mobile drawer affordance has been removed (every module it reached is reachable
 * from the bottom bar or its More sheet), so the header stays uncluttered and the
 * existing Notification Bell keeps its place there.
 */
const TeacherLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Single source of truth for the unread *notice* badge, shared by the desktop
  // sidebar and the mobile More sheet. Notification counts are never mixed in.
  const unreadNotices = useNoticeUnreadCount(teacherNoticesService);

  // Exactly four destinations plus More, in the agreed mobile order:
  // Dashboard, Homework / Assignments, My Classes, Attendance, More.
  // These are existing Teacher Panel routes only — no new destinations, so the
  // existing role permissions are unchanged. The panel has no Fees module, which
  // is why "My Classes" takes that slot, and Examination moved out to the More
  // sheet (it opens on Mark Entry, the first page of the sidebar's Examination
  // group).
  const primaryItems = [
    { to: '/teacher/dashboard', end: true, labelKey: 'dashboard', icon: HomeIcon },
    {
      to: '/teacher/dashboard/homework',
      end: false,
      labelKey: 'homeworkTab',
      icon: ClipboardDocumentListIcon,
    },
    { to: '/teacher/dashboard/my-classes', end: false, labelKey: 'myClasses', icon: UserGroupIcon },
    { to: '/teacher/dashboard/attendance', end: false, labelKey: 'attendance', icon: CheckCircleIcon },
  ];

  // The More sheet holds exactly three destinations: Examination, Notices,
  // Notifications. Class Schedule is left out on purpose: it is not a sidebar
  // module today (it is reached from the dashboard Quick Access, as is My
  // Results), and adding either here would change the module list rather than
  // mirror it.
  const moreItems = [
    {
      to: '/teacher/dashboard/marks-entry',
      end: false,
      labelKey: 'examination',
      icon: AcademicCapIcon,
    },
    {
      to: '/teacher/dashboard/notices',
      end: false,
      labelKey: 'notices',
      icon: MegaphoneIcon,
      showNoticeBadge: true,
    },
    { to: '/teacher/dashboard/notifications', end: false, labelKey: 'notifications', icon: BellIcon },
  ];

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <TeacherHeader sidebarOpen={sidebarOpen} />
      <div className="flex h-full">
        <TeacherSidebar
          isOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          unreadNotices={unreadNotices}
        />
        {/* Extra bottom padding below `md` so the fixed bottom bar never covers
            the end of the page content; `md:pb-6` restores the original value
            from `md` up, where the bar does not render. */}
        <main className="flex-1 overflow-y-auto pt-16 px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:px-6 md:pb-6 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <Outlet />
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

export default TeacherLayout;
