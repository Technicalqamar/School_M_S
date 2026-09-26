import { useState, useEffect } from 'react';
import {
  UsersIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import StatCard from '../../components/common/StatCard/StatCard';
import teacherDashboardService, { TEACHER_DASHBOARD_EMPTY_DATA } from '../../services/dashboard/teacherDashboard.service';
import { useAuth } from '../../contexts/AuthContext';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';
import { useTranslation } from '../../hooks/useLocalization';

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
  const myClasses = data.myClasses || [];
  const todayClasses = data.todayClasses || [];
  const upcomingHomework = data.upcomingHomework || [];

  const statCards = [
    { label: 'My Classes', value: formatCount(statistics.myClasses), icon: BookOpenIcon, color: 'blue' },
    { label: 'My Students', value: formatCount(statistics.myStudents), icon: UsersIcon, color: 'green' },
    { label: "Today's Classes", value: formatCount(statistics.todayClasses), icon: CalendarDaysIcon, color: 'yellow' },
    { label: 'Pending Homework', value: formatCount(statistics.pendingHomework), icon: PencilSquareIcon, color: 'red' },
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} color={card.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CardSection title="My Classes Overview" className="lg:col-span-2">
          {myClasses.length > 0 ? (
            <div>
              <div className="grid grid-cols-3 gap-4 pb-3 border-b border-gray-100 dark:border-gray-700 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <span>Class</span>
                <span>Subject</span>
                <span className="text-right">Students</span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {myClasses.map((item) => (
                  <li key={`${item.className}-${item.subject}`} className="grid grid-cols-3 gap-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-white">{item.className}</span>
                    <span>{item.subject}</span>
                    <span className="text-right">{formatCount(item.totalStudents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              icon={BookOpenIcon}
              title="No classes assigned yet"
              description="Your assigned classes with their subjects and student counts will appear here."
            />
          )}
        </CardSection>

        <CardSection title="Today's Classes">
          {todayClasses.length > 0 ? (
            <ul className="space-y-3">
              {todayClasses.map((item) => (
                <li
                  key={`${item.time}-${item.className}-${item.subject}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5"
                >
                  <div className="flex-shrink-0 w-16 text-xs font-semibold text-blue-600 dark:text-blue-400">{item.time}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.className}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.subject}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={CalendarDaysIcon}
              title="No classes scheduled today"
              description="Today's class schedule will appear here."
            />
          )}
        </CardSection>
      </div>

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