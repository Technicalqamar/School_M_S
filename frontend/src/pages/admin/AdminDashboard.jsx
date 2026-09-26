import { useState, useEffect } from 'react';
import {
  UsersIcon,
  AcademicCapIcon,
  BookOpenIcon,
  BanknotesIcon,
  ClockIcon,
  UserPlusIcon,
  ChartPieIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import toast from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import StatCard from '../../components/common/StatCard/StatCard';
import dashboardService, { DASHBOARD_EMPTY_DATA } from '../../services/dashboard/dashboard.service';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../hooks/useLocalization';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatCount = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString());

const formatCurrency = (value) => (value === null || value === undefined ? '—' : `Rs. ${Number(value).toLocaleString()}`);

const ChartEmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex h-56 flex-col items-center justify-center gap-3 text-center">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <Icon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md">{description}</p>
  </div>
);

const FeeMetricTile = ({ label, value, color }) => {
  const badgeColors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 min-w-0">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 break-words leading-snug">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap flex-shrink-0 ${badgeColors[color]}`}>
          {color === 'blue' ? 'Expected' : color === 'green' ? 'Collected' : 'Outstanding'}
        </span>
        <p className="text-xl font-bold text-gray-900 dark:text-white break-words min-w-0">{value}</p>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { academic, schoolInfo } = useSchoolConfig();

  const [data, setData] = useState(DASHBOARD_EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    dashboardService
      .getDashboardData()
      .then((result) => {
        if (mounted) setData(result);
      })
      .catch((error) => {
        if (mounted) {
          setData(DASHBOARD_EMPTY_DATA);
          toast.error(error?.response?.data?.message || 'Dashboard data failed to load');
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

  const displayName = user?.fullName?.trim() || 'Admin';

  const statistics = data.statistics || DASHBOARD_EMPTY_DATA.statistics;
  const studentOverview = data.studentOverview || DASHBOARD_EMPTY_DATA.studentOverview;
  const feeOverview = data.feeOverview || DASHBOARD_EMPTY_DATA.feeOverview;
  const studentsByClass = data.studentsByClass || [];
  const monthlyCollection = data.monthlyCollection || [];
  const feeMonthLabel = feeOverview.month || currentMonthName;
  const feeYearLabel = feeOverview.year || academic?.currentYear || String(currentYear);

  const statCards = [
    { label: 'Total Students', value: formatCount(statistics.totalStudents), icon: UsersIcon, color: 'blue' },
    { label: 'Total Teachers', value: formatCount(statistics.totalTeachers), icon: AcademicCapIcon, color: 'green' },
    { label: 'Total Classes', value: formatCount(statistics.totalClasses), icon: BookOpenIcon, color: 'yellow' },
    { label: 'Total Fee Collected', value: formatCurrency(statistics.totalFeeCollected), icon: BanknotesIcon, color: 'green' },
    { label: 'Outstanding Dues', value: formatCurrency(statistics.outstandingDues), icon: ClockIcon, color: 'red' },
    { label: 'New Admissions', value: formatCount(statistics.newAdmissions), icon: UserPlusIcon, color: 'blue' },
  ];

  const activeCount = Number(studentOverview.active);
  const inactiveCount = Number(studentOverview.inactive);
  const hasStudentData = activeCount + inactiveCount > 0;

  const donutData = hasStudentData
    ? [
      { name: 'Active Students', value: activeCount, color: '#22c55e' },
      { name: 'Inactive Students', value: inactiveCount, color: '#ef4444' },
    ]
    : [];

  const axisTickProps = { fill: '#6b7280', fontSize: 12 };
  const chartMargin = { top: 5, right: 8, left: -18, bottom: 0 };

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
            {schoolInfo?.name ? ` — ${schoolInfo.name}` : ''}
          </p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {currentMonthName} {currentYear} · Academic Year {academic?.currentYear || '—'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} color={card.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSection title="Student Overview">
          {hasStudentData ? (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={88}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#22c55e' }} />
                  Active Students
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCount(studentOverview.active)}</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#ef4444' }} />
                  Inactive Students
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCount(studentOverview.inactive)}</span>
                </span>
              </div>
            </>
          ) : (
            <ChartEmptyState
              icon={ChartPieIcon}
              title="Student distribution isn't available yet"
              description="Active and inactive student counts will appear here once students are added."
            />
          )}
        </CardSection>

        <CardSection title="Fee Overview">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FeeMetricTile label={`Expected · ${feeMonthLabel} ${feeYearLabel}`} value={formatCurrency(feeOverview.expected)} color="blue" />
            <FeeMetricTile label={`Collected · ${feeMonthLabel} ${feeYearLabel}`} value={formatCurrency(feeOverview.collected)} color="green" />
            <FeeMetricTile label={`Outstanding · ${feeMonthLabel} ${feeYearLabel}`} value={formatCurrency(feeOverview.outstanding)} color="red" />
          </div>
          <div className="mt-4">
            <ChartEmptyState
              icon={BanknotesIcon}
              title="Fee figures aren't available yet"
              description="Expected, collected and outstanding amounts for the current month will appear here once fee records exist."
            />
          </div>
        </CardSection>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSection title="Students by Class">
          {studentsByClass.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentsByClass} margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="className" tick={axisTickProps} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={axisTickProps} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="totalStudents" name="Students" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState
              icon={ChartBarIcon}
              title="Class distribution isn't available yet"
              description="Students per class will render dynamically from the class architecture once classes are created."
            />
          )}
        </CardSection>

        <CardSection title="Monthly Fee Collection">
          {monthlyCollection.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyCollection} margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={axisTickProps} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={axisTickProps} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="expected" name="Expected" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="collected" name="Collected" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState
              icon={ArrowTrendingUpIcon}
              title="Monthly collection trend isn't available yet"
              description="Expected vs collected fee for each month of the academic year will appear here once fee records exist."
            />
          )}
        </CardSection>
      </div>
    </div>
  );
};

export default AdminDashboard;