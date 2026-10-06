import { useState, useEffect } from 'react';
import {
  UsersIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
  ClipboardDocumentCheckIcon,
  BellIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import StatCard from '../../components/common/StatCard/StatCard';
import QuickAccessGrid from '../../components/common/QuickAccessGrid/QuickAccessGrid';
import teacherDashboardService, { TEACHER_DASHBOARD_EMPTY_DATA } from '../../services/dashboard/teacherDashboard.service';
import { useAuth } from '../../contexts/AuthContext';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';
import { useTranslation } from '../../hooks/useLocalization';
import useNoticeUnreadCount from '../../hooks/useNoticeUnreadCount';
import useNotificationUnreadCount from '../../hooks/useNotificationUnreadCount';
import teacherNoticesService from '../../services/teacher/teacherNotices.service';
import teacherNotificationsService from '../../services/teacher/teacherNotifications.service';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatCount = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString());

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-10">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

const TeacherDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { academic, schoolInfo } = useSchoolConfig();

  const [data, setData] = useState(TEACHER_DASHBOARD_EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    teacherDashboardService
      .getTeacherDashboardData()
      .then((result) => {
        if (mounted) setData(result);
      })
      .catch(() => {
        if (mounted) {
          toast.error('Failed to load teacher dashboard data');
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const currentMonthIndex = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthName = MONTHS[currentMonthIndex];

  const displayName = user?.fullName?.trim() || 'Teacher';
  const teacherId = user?.teacherId;

  const statistics = data.statistics || TEACHER_DASHBOARD_EMPTY_DATA.statistics;
  const todayClasses = data.todayClasses || [];
  const upcomingHomework = data.upcomingHomework || [];

  // "Pending Homework" is intentionally not shown as a stat card: the Teacher
  // Panel has no homework backend module, so the dashboard endpoint always
  // returns a hard-coded 0 — a permanent zero adds no real information and is
  // already conveyed by the Upcoming Homework section below. Only stats backed
  // by real, usable data are surfaced.
  const statCards = [
    { label: 'My Classes', value: formatCount(statistics.myClasses), icon: BookOpenIcon, color: 'blue' },
    { label: 'My Students', value: formatCount(statistics.myStudents), icon: UsersIcon, color: 'green' },
    { label: "Today's Classes", value: formatCount(statistics.todayClasses), icon: CalendarDaysIcon, color: 'yellow' },
  ];

  // Real, recipient-scoped unread counts for the two communication shortcuts.
  // Each badge is hidden at 0 and capped at 9+, and the two are never combined —
  // this is the same Notification count the header Bell shows and the same
  // Notice count the sidebar shows. No SMS tile exists because the Teacher Panel
  // has no SMS route (SMS is an Admin-only module), and no count is invented for
  // it.
  const unreadNotifications = useNotificationUnreadCount(teacherNotificationsService);
  const unreadNotices = useNoticeUnreadCount(teacherNoticesService);

  const quickAccessItems = [
    {
      to: '/teacher/dashboard/class-schedule',
      label: 'Class Schedule',
      icon: CalendarDaysIcon,
      accent: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    },
    {
      to: '/teacher/dashboard/my-classes',
      label: 'My Classes',
      icon: BookOpenIcon,
      accent: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    },
    {
      to: '/teacher/dashboard/homework',
      label: 'Homework Assignments',
      icon: PencilSquareIcon,
      accent: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800',
    },
    {
      to: '/teacher/dashboard/my-results',
      label: 'My Results',
      icon: ClipboardDocumentCheckIcon,
      accent: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    },
    {
      to: '/teacher/dashboard/notifications',
      label: 'Notifications',
      icon: BellIcon,
      accent: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
      badge: unreadNotifications,
    },
    {
      to: '/teacher/dashboard/notices',
      label: 'Notices',
      icon: MegaphoneIcon,
      accent: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
      badge: unreadNotices,
    },
  ];

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          Loading dashboard data...
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Welcome back, <span className="font-medium text-gray-700 dark:text-gray-200">{displayName}</span>
            {teacherId ? (
              <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                {teacherId}
              </span>
            ) : null}
            {schoolInfo?.name ? ` — ${schoolInfo.name}` : ''}
          </p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {currentMonthName} {currentYear} · Academic Year {academic?.currentYear || '—'}
        </p>
      </div>

      {/* Quick access — Class Schedule, communication shortcuts and other
          frequent pages. Only the presentation is shared with the Student
          dashboard; the Teacher Panel's own routes, data and sections are
          untouched. */}
      <CardSection title="Quick Access">
        <QuickAccessGrid items={quickAccessItems} columnsClassName="grid-cols-2 sm:grid-cols-2 lg:grid-cols-4" />
      </CardSection>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} color={card.color} />
        ))}
      </div>

      <CardSection title="Today's Classes">
        {todayClasses.length > 0 ? (
          <ul className="space-y-3">
            {todayClasses.map((item) => (
              <li
                key={`${item.period}-${item.className}-${item.subject}-${item.startTime}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5"
              >
                {/* Below `sm` the period takes its own full-width line so the
                    class/subject column keeps enough room to stay readable —
                    the fixed `w-24` plus the nowrap time otherwise squeezed it
                    down to ~16px on a 320px screen. */}
                <div className="flex-shrink-0 w-full sm:w-24 min-w-0 text-xs font-semibold text-blue-600 dark:text-blue-400 truncate">
                  {item.period || '—'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.className || '—'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.subject || '—'}</p>
                </div>
                <div className="flex-shrink-0 text-right text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {item.startTime && item.endTime ? `${item.startTime} – ${item.endTime}` : '—'}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={CalendarDaysIcon}
            title="No classes scheduled"
            description="The timetable periods assigned to you will appear here."
          />
        )}
      </CardSection>

      <CardSection title="Upcoming Homework">
        {upcomingHomework.length > 0 ? (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {upcomingHomework.map((item) => (
              <li key={`${item.title}-${item.className}`} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {item.className} · {item.subject}
                  </p>
                </div>
                {item.dueDate && (
                  <span className="flex-shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Due {item.dueDate}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={PencilSquareIcon}
            title="No homework yet"
            description="Homework you create for your classes will appear here."
          />
        )}
      </CardSection>
    </div>
  );
};

export default TeacherDashboard;