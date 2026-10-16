import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  UserCircleIcon,
  UserGroupIcon,
  CreditCardIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  ArrowRightIcon,
  ExclamationCircleIcon,
  BanknotesIcon,
  ClockIcon,
  BellIcon,
  BellAlertIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { getImageUrl } from '../../utils/imageUrl';
import { useTranslation } from '../../hooks/useLocalization';
import useNoticeUnreadCount from '../../hooks/useNoticeUnreadCount';
import useNotificationUnreadCount from '../../hooks/useNotificationUnreadCount';
import QuickAccessGrid from '../../components/common/QuickAccessGrid/QuickAccessGrid';
import studentDashboardService, { STUDENT_DASHBOARD_EMPTY_DATA } from '../../services/student/studentDashboard.service';
import studentFeesService from '../../services/student/studentFees.service';
import studentNoticesService from '../../services/student/studentNotices.service';
import studentNotificationsService from '../../services/student/studentNotifications.service';

// Fee reminders are ordinary Notification Engine records of type FEE_REMINDER.
// A stable module-level array (never an inline literal) keeps the fetch effect
// from re-running on every render, exactly like the portal Fee Reminders page.
const FEE_REMINDER_TYPES = ['FEE_REMINDER'];
const REMINDER_PREVIEW_LIMIT = 3;

const StudentDashboard = ({ portalContext }) => {
  const { user: authUser } = useAuth();
  const { t } = useTranslation();

  const isAdminPortalAccess = !!portalContext;
  const displayUser = isAdminPortalAccess ? portalContext.user : authUser;

  const [data, setData] = useState(STUDENT_DASHBOARD_EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Fee Status is sourced from the real Student Fee API (GET /student/fees/overview)
  // in its own request, so it never degrades to N/A because the aggregate
  // dashboard request failed. Loading / empty / error states handled here.
  const [feeOverview, setFeeOverview] = useState(null);
  const [feeLoading, setFeeLoading] = useState(true);
  const [feeLoadFailed, setFeeLoadFailed] = useState(false);

  // Fee Reminders — the same recipient-scoped Notification Engine records the
  // Notifications page and the header Bell already show, narrowed to the
  // FEE_REMINDER type. Read straight from the existing endpoints: no second inbox,
  // no second reminder and no fabricated data, so read/unread state and the unread
  // count stay identical to the rest of the portal.
  const [reminders, setReminders] = useState([]);
  const [reminderUnread, setReminderUnread] = useState(0);
  const [remindersLoading, setRemindersLoading] = useState(true);
  const [remindersFailed, setRemindersFailed] = useState(false);

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

  const fetchFeeOverview = () =>
    studentFeesService
      .getFeeOverview()
      .then((overview) => {
        setFeeOverview(overview);
      })
      .catch(() => {
        setFeeLoadFailed(true);
        toast.error(t('feeStatusLoadError') || 'Failed to load fee status');
      })
      .finally(() => {
        setFeeLoading(false);
      });

  // No synchronous setState here: the effect and the retry handler both call it
  // and every state update happens in the promise callbacks.
  const fetchReminders = () =>
    Promise.all([
      studentNotificationsService.getNotifications({
        page: 1,
        limit: REMINDER_PREVIEW_LIMIT,
        types: FEE_REMINDER_TYPES,
      }),
      studentNotificationsService.getUnreadCount({ types: FEE_REMINDER_TYPES }),
    ])
      .then(([list, count]) => {
        setReminders(list.notifications);
        setReminderUnread(count);
        setRemindersFailed(false);
      })
      .catch(() => {
        setRemindersFailed(true);
      })
      .finally(() => {
        setRemindersLoading(false);
      });

  useEffect(() => {
    fetchDashboard();
    fetchFeeOverview();
    fetchReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the section in step with the Bell and the Notifications page: both
  // emit a change after a mark-as-read (and a realtime push does too), so the
  // dashboard re-reads its own slice of the same inbox rather than caching.
  useEffect(() => {
    const unsubscribe = studentNotificationsService.subscribe(() => {
      fetchReminders();
    });
    return unsubscribe;
  }, []);

  const retry = () => {
    setLoadFailed(false);
    setIsLoading(true);
    setData(STUDENT_DASHBOARD_EMPTY_DATA);
    fetchDashboard();
  };

  const retryFee = () => {
    setFeeLoadFailed(false);
    setFeeLoading(true);
    setFeeOverview(null);
    fetchFeeOverview();
  };

  const retryReminders = () => {
    setRemindersFailed(false);
    setRemindersLoading(true);
    fetchReminders();
  };

  // Marks one reminder read through the ordinary endpoint, then updates this
  // card locally for instant feedback. The endpoint also emits a change, so the
  // Bell, the Notifications page and this card all settle on the same state.
  const handleReminderRead = (reminder) => {
    if (!reminder || reminder.read) return;
    studentNotificationsService
      .markAsRead(reminder.id)
      .then(() => {
        setReminders((prev) =>
          prev.map((item) => (item.id === reminder.id ? { ...item, read: true } : item)),
        );
        setReminderUnread((prev) => Math.max(0, prev - 1));
      })
      .catch(() => {
        toast.error(t('feeRemindersLoadError') || 'Failed to update reminder');
      });
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
  const fatherName = studentDoc?.fatherName || '';

  const formatDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value) =>
    value === null || value === undefined ? '—' : `Rs. ${Number(value).toLocaleString()}`;

  const placeholderText = t('notAvailable');

  const portalLink = (path) => (isAdminPortalAccess ? `/portal/access${path}` : `/student/dashboard${path}`);

  const currentMonth = feeOverview?.currentMonth || null;
  const currentMonthStatus = feeOverview?.paymentStatus || null;
  const fullyPaid =
    feeOverview === null || feeOverview === undefined
      ? null
      : feeOverview.outstandingAmount <= 0;
  const outstandingAmount = feeOverview ? feeOverview.outstandingAmount : null;
  const monthlyFeeAmount = feeOverview ? feeOverview.currentFeeAmount : null;
  const totalPaidThisYear = feeOverview ? feeOverview.totalPaidThisYear : 0;
  const feeStructureAvailable = feeOverview !== null && feeOverview !== undefined;

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

  // Real, recipient-scoped unread counts for the two communication shortcuts.
  // Each badge is hidden at 0 and capped at 9+, and the two are never combined —
  // this is the same Notification count the header Bell shows and the same
  // Notice count the sidebar shows. No SMS tile exists because the Student Portal
  // has no SMS route (SMS is an Admin-only module), and no count is invented for
  // it.
  const unreadNotifications = useNotificationUnreadCount(studentNotificationsService);
  const unreadNotices = useNoticeUnreadCount(studentNoticesService);

  const quickAccessItems = [
    {
      to: portalLink('/fees'),
      label: t('viewFees'),
      icon: BanknotesIcon,
      accent: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    },
    {
      to: portalLink('/homework'),
      label: t('viewHomework'),
      icon: ClipboardDocumentListIcon,
      accent: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    },
    {
      to: portalLink('/examination'),
      label: t('viewExaminations'),
      icon: AcademicCapIcon,
      accent: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800',
    },
    {
      to: portalLink('/class-schedule'),
      label: t('viewClassSchedule'),
      icon: CalendarDaysIcon,
      accent: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    },
    {
      to: portalLink('/notifications'),
      label: t('notifications'),
      icon: BellIcon,
      accent: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
      badge: unreadNotifications,
    },
    {
      to: portalLink('/notices'),
      label: t('notices'),
      icon: MegaphoneIcon,
      accent: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
      badge: unreadNotices,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Profile section — photo, name, ID, class, father name, academic year */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="relative h-24 md:h-28 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800">
          <div className="absolute -top-6 right-10 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 right-24 w-24 h-24 rounded-full bg-white/5" />
        </div>
        {/* Photo on the left, details on the right at every breakpoint — the
            row only ever switches from bottom-aligned (sm+) to top-aligned
            (mobile) so the photo keeps overlapping the banner. */}
        <div className="px-4 pb-6 sm:px-6 -mt-14 relative">
          <div className="flex flex-row gap-3 sm:gap-4 items-start sm:items-end">
            <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 ring-4 ring-white dark:ring-gray-800 flex items-center justify-center text-white font-bold text-3xl shadow-lg overflow-hidden flex-shrink-0">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2 justify-start mb-1 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white break-words">
                  {fullName || t('studentPortal')}
                </h1>
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
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('studentDashboardTitle')}</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-start">
                {studentId && (
                  <Chip icon={<UserCircleIcon className="h-3.5 w-3.5" />}>
                    {t('studentIdLabel')}: {studentId}
                  </Chip>
                )}
                {className && (
                  <Chip icon={<AcademicCapIcon className="h-3.5 w-3.5" />}>
                    {t('class')}: {className}
                  </Chip>
                )}
                {fatherName && (
                  <Chip icon={<UserGroupIcon className="h-3.5 w-3.5" />}>
                    {t('fatherName')}: {fatherName}
                  </Chip>
                )}
                {academicYear && (
                  <Chip icon={<CalendarDaysIcon className="h-3.5 w-3.5" />}>
                    {t('academicYear')}: {academicYear}
                  </Chip>
                )}
              </div>
              {!isAdminPortalAccess && (
                <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 justify-start">
                  <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
                  {t('readOnlyProfileNote')}
                </p>
              )}
            </div>
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

      {/* Quick access — full width at every breakpoint. Inside the old 1/3
          desktop column the horizontal tiles were squeezed until their labels
          collapsed to zero width, which stretched this card to almost 1000px and
          left the Fee card below with a huge empty area. Full width keeps the
          labels readable from 1024px up, and it is exactly the layout tablet and
          mobile already had (the old grid was single-column below `lg`, so this
          section already spanned the full width there). */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-6">
        <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider mb-4">
          {t('quickAccess')}
        </h2>
        <QuickAccessGrid
          items={quickAccessItems}
          columnsClassName="grid-cols-2 sm:grid-cols-2 lg:grid-cols-3"
        />
      </section>

      {/* Fee status */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
              <CreditCardIcon className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider">
              {t('feeStatus')}
            </h2>
          </div>

          {feeLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-500" />
              {t('loadingData')}
            </div>
          )}

          {!feeLoading && feeLoadFailed && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-300">{t('feeStatusLoadError')}</p>
              <button
                type="button"
                onClick={retryFee}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                {t('tryAgain')}
              </button>
            </div>
          )}

          {!feeLoading && !feeLoadFailed && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat
                  label={t('currentMonthFeeStatus')}
                  value={
                    currentMonth
                      ? `${currentMonth} • ${feeStatusLabel(currentMonthStatus)}`
                      : placeholderText
                  }
                />
                <Stat label={t('fullyPaid')} value={fullyPaid === null ? placeholderText : fullyPaid ? t('yes') : t('no')} />
                <Stat label={t('outstandingDueAmount')} value={formatCurrency(outstandingAmount)} />
              </div>
              {feeStructureAvailable ? (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex justify-between gap-4">
                    <span>{t('monthlyFee')}</span>
                    <span className="font-semibold">{formatCurrency(monthlyFeeAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{t('paidThisYear')}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(totalPaidThisYear)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-dashed border-gray-200 dark:border-gray-600 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                  {isAdminPortalAccess ? t('noFeeInfo') : t('noFeeStructureInfo')}
                </div>
              )}
            </>
          )}
      </section>

      {/* Fee reminders — the recipient-scoped FEE_REMINDER notifications already
          visible in the Notifications page and the header Bell, surfaced on the
          account home too. Same records, same read/unread state, no duplicate. */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400">
            <BellAlertIcon className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider min-w-0">
            {t('feeReminders')}
          </h2>
          {reminderUnread > 0 && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
              {reminderUnread}
            </span>
          )}
          <Link
            to={portalLink('/fee-reminders')}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('view')} <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>

        {remindersLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-orange-500" />
            {t('loadingData')}
          </div>
        )}

        {!remindersLoading && remindersFailed && (
          <SectionError message={t('feeRemindersLoadError')} onRetry={retryReminders} />
        )}

        {!remindersLoading && !remindersFailed && reminders.length === 0 && (
          <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-dashed border-gray-200 dark:border-gray-600 px-4 py-6 text-center">
            <BellAlertIcon className="h-7 w-7 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('noFeeReminders')}</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t('feeRemindersSubtitle')}</p>
          </div>
        )}

        {!remindersLoading && !remindersFailed && reminders.length > 0 && (
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 min-w-0 break-words">
                    {reminder.title || t('feeReminders')}
                  </p>
                  {!reminder.read && (
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500"
                      title={t('unread')}
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {reminder.message}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {formatDateTime(reminder.time)}
                  </p>
                  {!reminder.read && (
                    <button
                      type="button"
                      onClick={() => handleReminderRead(reminder)}
                      className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t('markAsRead')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Homework + Examinations summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <ClipboardDocumentListIcon className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider min-w-0">
              {t('homeworkAssignments')}
            </h2>
            <Link
              to={portalLink('/homework')}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('view')} <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loadFailed && !isLoading ? (
            <SectionError message={t('dashboardLoadError')} onRetry={retry} />
          ) : homework.assignments.length > 0 ? (
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
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 min-w-0 break-words">{item.title}</p>
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

        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
              <CalendarDaysIcon className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wider min-w-0">
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
          {loadFailed && !isLoading ? (
            <SectionError message={t('dashboardLoadError')} onRetry={retry} />
          ) : examinations.list.length > 0 ? (
            <div className="space-y-3">
              {examinations.list.slice(0, 3).map((exam) => (
                <div
                  key={exam.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3"
                >
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">{exam.name}</p>
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

const Chip = ({ icon, children }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 max-w-full">
    <span className="shrink-0">{icon}</span>
    {/* Wrap instead of truncating: the ID / class labels must stay fully
        readable in the narrower mobile info column. */}
    <span className="min-w-0 break-words">{children}</span>
  </span>
);

const SectionError = ({ message, onRetry }) => {
  // `t` is module scope here, not the dashboard's: without its own hook the
  // fallback would throw while rendering and take the whole card down.
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-6 text-center">
      <ExclamationCircleIcon className="h-7 w-7 mx-auto text-red-400 dark:text-red-500 mb-2" />
      <p className="text-sm text-red-700 dark:text-red-300 mb-3">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
      >
        {t('tryAgain')}
      </button>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2.5 border border-gray-100 dark:border-gray-600 min-w-0">
    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 break-words">{label}</p>
    <p className="text-base font-bold text-gray-800 dark:text-gray-200 break-words">{value}</p>
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

export default StudentDashboard;