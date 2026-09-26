import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  UserCircleIcon,
  CreditCardIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  ArrowRightIcon,
  SparklesIcon,
  ExclamationCircleIcon,
  BanknotesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl } from '../../utils/imageUrl';
import { useTranslation } from '../../hooks/useLocalization';
import studentDashboardService, { STUDENT_DASHBOARD_EMPTY_DATA } from '../../services/student/studentDashboard.service';

const StudentDashboard = ({ portalContext }) => {
  const { user: authUser } = useAuth();
  const { t } = useTranslation();

  const isAdminPortalAccess = !!portalContext;
  const displayUser = isAdminPortalAccess ? portalContext.user : authUser;

  const [data, setData] = useState(STUDENT_DASHBOARD_EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const fetchDashboard = () =>
    studentDashboardService
      .getStudentDashboardData()
      .then((result) => {
        setData(result);
      })
      .catch(() => {
        setLoadFailed(true);
        toast.error(t('dashboardLoadError') || 'Failed to load dashboard data');
      })
      .finally(() => {
        setIsLoading(false);
      });

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    setLoadFailed(false);
    setIsLoading(true);
    fetchDashboard();
  };

  const liveData = data;

  const studentDoc = isAdminPortalAccess
    ? displayUser?.student || displayUser?.profile || null
    : authUser?.student ||
      authUser?.profile ||
      (data.student?.studentId
        ? {
            studentId: data.student.studentId,
            fullName: data.student.fullName,
            fatherName: data.student.fatherName,
            gender: data.student.gender,
            dateOfBirth: data.student.dateOfBirth,
            class: data.student.className,
            academicYear: data.student.academicYear,
            studentImage: data.student.image,
            status: data.student.status,
          }
        : null);

  const fullName = displayUser?.fullName || data.student?.fullName || '';
  const studentId = displayUser?.studentId || studentDoc?.studentId || '';
  const className = isAdminPortalAccess
    ? studentDoc?.class || ''
    : data.class?.className || studentDoc?.class || '';
  const academicYear = isAdminPortalAccess
    ? studentDoc?.academicYear || ''
    : data.academicYear || studentDoc?.academicYear || '';
  const imageUrl = (studentDoc?.studentImage || data.student?.image)
    ? getImageUrl(studentDoc?.studentImage || data.student?.image)
    : null;
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'ST';

  const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (value) =>
    value === null || value === undefined ? '—' : `Rs. ${Number(value).toLocaleString()}`;

  const placeholderText = t('notAvailable');

  const portalLink = (path) => (isAdminPortalAccess ? `/portal/access${path}` : `/student/dashboard${path}`);

  const fee = liveData.fee;
  const currentMonth = fee.currentMonth;
  const fullyPaid =
    fee.totalOutstanding === null || fee.totalOutstanding === undefined
      ? null
      : fee.totalOutstanding <= 0;

  const feeStatusLabel = (status) => {
    if (!status) return placeholderText;
    const map = {
      Paid: t('feeStatusPaid'),
      Unpaid: t('feeStatusUnpaid'),
      Partial: t('feeStatusPartial'),
      'Not Applicable': t('feeStatusNotApplicable'),
    };
    return map[status] || status;
  };

  const homework = liveData.homework;
  const examinations = liveData.examinations;

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white p-6 md:p-8 shadow-lg">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 right-24 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-2 text-blue-100 text-sm font-medium mb-2">
            <SparklesIcon className="h-4 w-4" />
            <span>{t('welcomeBack')}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight">{fullName || t('studentPortal')}</h1>
          <p className="text-blue-100 mt-1 text-sm md:text-base">{t('studentDashboardTitle')}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {studentId && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium border border-white/20">
                <UserCircleIcon className="h-4 w-4" />
                {t('studentIdLabel')}: {studentId}
              </span>
            )}
            {className && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium border border-white/20">
                <AcademicCapIcon className="h-4 w-4" />
                {t('class')}: {className}
              </span>
            )}
            {academicYear && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium border border-white/20">
                <CalendarDaysIcon className="h-4 w-4" />
                {t('academicYear')}: {academicYear}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Loading / error states */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          {t('loadingData')}
        </div>
      )}
      {loadFailed && !isLoading && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4">
          <p className="text-sm text-red-700 dark:text-red-300">{t('dashboardLoadError')}</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
          >
            {t('tryAgain')}
          </button>
        </div>
      )}

      {/* Profile summary + Fee status + Quick access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile / Student summary card */}
        <section className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider">
              {t('profile')}
            </h2>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                studentDoc?.status === 'Inactive'
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${studentDoc?.status === 'Inactive' ? 'bg-red-500' : 'bg-green-500'}`} />
              {studentDoc?.status === 'Inactive' ? t('inactive') : t('active')}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-3xl ring-2 ring-yellow-400/50 shadow-lg overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <Field label={t('fullName')} value={fullName || placeholderText} />
              <Field label={t('studentIdLabel')} value={studentId || placeholderText} />
              <Field label={t('class')} value={className || placeholderText} />
              <Field label={t('academicYear')} value={academicYear || placeholderText} />
              <Field label={t('fatherName')} value={studentDoc?.fatherName || placeholderText} />
              <Field label={t('gender')} value={studentDoc?.gender || placeholderText} />
              <Field label={t('dateOfBirth')} value={formatDate(studentDoc?.dateOfBirth) || placeholderText} />
              <Field label={t('admissionNumber')} value={studentDoc?.admissionNumber || placeholderText} />
            </div>
          </div>
          {!isAdminPortalAccess && (
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
              {t('readOnlyProfileNote')}
            </p>
          )}
        </section>

        {/* Quick access */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider mb-4">
            {t('quickAccess')}
          </h2>
          <div className="flex flex-col gap-3">
            <QuickAccessLink
              to={portalLink('/homework')}
              label={t('viewHomework')}
              icon={<ClipboardDocumentListIcon className="h-5 w-5" />}
              accent="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
            />
            <QuickAccessLink
              to={portalLink('/fees')}
              label={t('viewFees')}
              icon={<BanknotesIcon className="h-5 w-5" />}
              accent="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
            />
            <QuickAccessLink
              to={portalLink('/examination')}
              label={t('viewExaminations')}
              icon={<AcademicCapIcon className="h-5 w-5" />}
              accent="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800"
            />
          </div>
        </section>
      </div>

      {/* Fee status + Homework + Examinations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fee status summary */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
              <CreditCardIcon className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider">
              {t('feeStatus')}
            </h2>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
              {t('academicYear')}: {data.academicYear || academicYear}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat
              label={t('currentMonthFeeStatus')}
              value={
                currentMonth
                  ? `${currentMonth.month} • ${feeStatusLabel(currentMonth.status)}`
                  : placeholderText
              }
            />
            <Stat label={t('fullyPaid')} value={fullyPaid === null ? placeholderText : fullyPaid ? t('yes') : t('no')} />
            <Stat label={t('outstandingDueAmount')} value={formatCurrency(fee.totalOutstanding)} />
          </div>
          {fee.structureAvailable ? (
            <div className="mt-4 space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>{t('monthlyFee')}</span>
                <span className="font-semibold">{formatCurrency(fee.monthlyFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('paidThisYear')}</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(fee.totalPaidThisYear)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('monthlyFeeStatus')}</span>
                <span className="font-semibold">{feeStatusLabel(currentMonth?.status)}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-dashed border-gray-200 dark:border-gray-600 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              {isAdminPortalAccess ? t('noFeeInfo') : t('noFeeStructureInfo')}
            </div>
          )}
        </section>

        {/* Homework / Assignments summary */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <ClipboardDocumentListIcon className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider">
              {t('homeworkAssignments')}
            </h2>
            <Link
              to={portalLink('/homework')}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('view')} <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          {homework.assignments.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {homework.total} {t('assignments')}
              </p>
              {homework.assignments.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.subjectName && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.subjectName}</p>
                  )}
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {t('dueOn')}: {formatDate(item.dueDate)}
                  </p>
                </div>
              ))}
              {homework.total > 3 && (
                <p className="text-xs text-center text-blue-600 dark:text-blue-400">
                  +{homework.total - 3} more
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-dashed border-gray-200 dark:border-gray-600 px-4 py-6 text-center">
              <ClipboardDocumentListIcon className="h-7 w-7 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noHomeworkInfo')}</p>
            </div>
          )}
        </section>

        {/* Upcoming examinations summary */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
              <CalendarDaysIcon className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider">
              {t('upcomingExaminations')}
            </h2>
            <Link
              to={portalLink('/examination')}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('view')} <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          {examinations.scheduledPapers > 0 && (
            <p className="mb-3 inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-900/20 px-2.5 py-0.5 text-[11px] font-medium text-violet-600 dark:text-violet-400">
              {examinations.scheduledPapers} {t('scheduledPapers')}
            </p>
          )}
          {examinations.list.length > 0 ? (
            <div className="space-y-3">
              {examinations.list.slice(0, 3).map((exam) => (
                <div
                  key={exam.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3"
                >
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{exam.name}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(exam.startDate)} — {formatDate(exam.endDate)}
                  </p>
                </div>
              ))}
              {examinations.list.length > 3 && (
                <p className="text-xs text-center text-violet-600 dark:text-violet-400">
                  +{examinations.list.length - 3} more
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-dashed border-gray-200 dark:border-gray-600 px-4 py-6 text-center">
              <CalendarDaysIcon className="h-7 w-7 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noExamInfo')}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Field = ({ label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2.5 border border-gray-100 dark:border-gray-600">
    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{value}</p>
  </div>
);

const Stat = ({ label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2.5 border border-gray-100 dark:border-gray-600">
    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-base font-bold text-gray-800 dark:text-gray-200">{value}</p>
  </div>
);

const StatusBadge = ({ status }) => {
  const palette = {
    Pending: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    'In Progress': 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    Completed: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    Overdue: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${palette[status] || palette.Pending}`}>
      {status}
    </span>
  );
};

const QuickAccessLink = ({ to, label, icon, accent }) => (
  <Link
    to={to}
    className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${accent}`}
  >
    {icon}
    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">{label}</span>
    <ArrowRightIcon className="h-4 w-4 text-gray-400" />
  </Link>
);

export default StudentDashboard;