import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BellIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckBadgeIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import teacherNotificationsService, {
  NOTIFICATION_TYPE_LABEL_KEYS,
  NOTIFICATION_TYPE_STYLES,
  NOTIFICATION_TYPE_DEFAULT_STYLE,
} from '../../services/teacher/teacherNotifications.service';
import { useTranslation } from '../../hooks/useLocalization';

const ITEMS_PER_PAGE = 10;

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Loading placeholder - mirrors the row geometry so the layout does not jump. */
const SkeletonRow = () => (
  <div className="flex items-start gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700/50 animate-pulse">
    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="h-3.5 w-1/3 rounded bg-gray-100 dark:bg-gray-700" />
      <div className="h-3 w-full rounded bg-gray-100 dark:bg-gray-700" />
      <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700" />
    </div>
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-16">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <BellIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

const ErrorState = ({ message, retryLabel, onRetry }) => (
  <div className="flex flex-col items-center justify-center gap-3 text-center px-4 py-16">
    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
      <ExclamationTriangleIcon className="h-7 w-7 text-red-500 dark:text-red-400" />
    </div>
    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{message}</p>
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors cursor-pointer"
    >
      <ArrowPathIcon className="h-3.5 w-3.5" />
      {retryLabel}
    </button>
  </div>
);

const TeacherNotifications = () => {
  const { t } = useTranslation();

  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  // Tracked separately from `pagination.totalItems`, because that value counts
  // the *filtered* result set and would show 0 while "Unread only" is active.
  const [totalCount, setTotalCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  // `t` is a fresh function on every render (useTranslation builds it inline), so
  // it must NOT appear in these dependencies: doing so would rebuild this
  // callback on every render and re-trigger the effect in an endless fetch loop.
  // Error text is resolved during render instead of being stored here.
  //
  // The request and the state update are kept apart on purpose: an effect must
  // never perform a synchronous setState, and splitting them is also what makes
  // the `cancelled` guard below possible, so a response that arrives after the
  // page changed is discarded instead of overwriting the newer result.
  const fetchNotifications = useCallback(async () => {
    const [listResult, count, overallResult] = await Promise.all([
      teacherNotificationsService.getNotifications({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        unreadOnly,
      }),
      teacherNotificationsService.getUnreadCount(),
      // Only needed while filtering, to keep the "Total" stat truthful. Skipped
      // entirely on the normal path so the common case stays at one request.
      unreadOnly
        ? teacherNotificationsService.getNotifications({ page: 1, limit: 1 })
        : Promise.resolve(null),
    ]);
    return { listResult, count, overallResult };
  }, [currentPage, unreadOnly]);

  const applyResult = useCallback((result) => {
    setNotifications(result.listResult.notifications);
    setPagination(result.listResult.pagination);
    setUnreadCount(result.count);
    setTotalCount((result.overallResult || result.listResult).pagination.totalItems);
    setLoadFailed(false);
  }, []);

  const applyFailure = useCallback(() => {
    setNotifications([]);
    setLoadFailed(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchNotifications()
      .then((result) => {
        if (!cancelled) applyResult(result);
      })
      .catch(() => {
        if (!cancelled) applyFailure();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchNotifications, applyResult, applyFailure]);

  // The header bell is mounted on every Teacher Panel page. subscribe() lets it
  // refresh when this page marks something as read, so the badge never lags. This
  // one is silent: the data is replaced without flashing the skeleton.
  useEffect(
    () =>
      teacherNotificationsService.subscribe(() => {
        setLoadFailed(false);
        fetchNotifications().then(applyResult, applyFailure);
      }),
    [fetchNotifications, applyResult, applyFailure],
  );

  const retry = () => {
    setLoadFailed(false);
    setIsLoading(true);
    fetchNotifications().then(applyResult, applyFailure).finally(() => setIsLoading(false));
  };

  const handleUnreadOnlyChange = () => {
    setUnreadOnly((prev) => !prev);
    setCurrentPage(1);
  };

  const handleMarkAsRead = async (notification) => {
    if (notification.read || busyId) return;
    setBusyId(notification.id);
    try {
      await teacherNotificationsService.markAsRead(notification.id);
      // Update locally instead of refetching so the row never flickers, and so a
      // read notification can never bounce back to unread.
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error(t('markNotificationReadError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      const updatedCount = await teacherNotificationsService.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount((prev) => Math.max(0, prev - (updatedCount || prev.length)));
      toast.success(t('allNotificationsMarkedRead'));
    } catch {
      toast.error(t('markNotificationReadError'));
    } finally {
      setMarkingAll(false);
    }
  };

  const goToPage = (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    setCurrentPage(page);
  };

  const typeBadge = useMemo(
    () => (type) => {
      if (!type) return null;
      const labelKey = NOTIFICATION_TYPE_LABEL_KEYS[type];
      return {
        label: labelKey ? t(labelKey) : t('notificationTypeGeneral'),
        style: NOTIFICATION_TYPE_STYLES[type] || NOTIFICATION_TYPE_DEFAULT_STYLE,
      };
    },
    [t],
  );

  return (
    <div className="pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('notifications')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('teacherNotificationsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={retry}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckBadgeIcon className="h-4 w-4" />
              {t('markAllRead')}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20">
            <BellAlertIcon className="h-6 w-6 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('unreadNotifications')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{unreadCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <CheckCircleIcon className="h-6 w-6 text-blue-500 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('totalNotifications')}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
          </div>
        </div>
      </div>

      <CardSection title={t('notificationsList')} className="mt-4 !p-0">
        <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={handleUnreadOnlyChange}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              unreadOnly
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <FunnelIcon className="h-3.5 w-3.5" />
            {t('unreadOnly')}
          </button>
          {unreadOnly && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('showingUnreadResults')}
            </span>
          )}
        </div>

        {isLoading ? (
          <div>
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : loadFailed ? (
          <ErrorState message={t('notificationsLoadError')} retryLabel={t('retry')} onRetry={retry} />
        ) : notifications.length === 0 ? (
          unreadOnly ? (
            <EmptyState
              title={t('noUnreadNotifications')}
              description={t('noUnreadNotificationsDescription')}
            />
          ) : (
            <EmptyState title={t('noNotifications')} description={t('allCaughtUp')} />
          )
        ) : (
          <ul>
            {notifications.map((notification) => {
              const badge = typeBadge(notification.type);

              return (
                <li
                  key={notification.id}
                  className={`px-4 md:px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 transition-colors ${
                    notification.read
                      ? 'bg-white dark:bg-gray-800'
                      : 'bg-blue-50/50 dark:bg-blue-900/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!notification.read && (
                      <span
                        className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2"
                        aria-label={t('unread')}
                      />
                    )}

                    <div className={`flex-1 min-w-0 ${notification.read ? 'ml-5' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4
                          className={`text-sm ${
                            notification.read
                              ? 'font-medium text-gray-600 dark:text-gray-300'
                              : 'font-bold text-gray-900 dark:text-white'
                          }`}
                        >
                          {notification.title}
                        </h4>

                        {badge && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.style}`}
                          >
                            {badge.label}
                          </span>
                        )}

                        {notification.source === 'automatic' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            {t('automatic')}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-line">
                        {notification.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDateTime(notification.time)}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            notification.read
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                              : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {notification.read ? t('read') : t('unread')}
                        </span>

                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification)}
                            disabled={busyId === notification.id}
                            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {busyId === notification.id ? t('loading') : t('markAsRead')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!isLoading && !loadFailed && notifications.length > 0 && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3">
            <button
              onClick={() => goToPage(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('previous')}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('page')} {pagination.currentPage} {t('of')} {pagination.totalPages}
            </span>
            <button
              onClick={() => goToPage(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('next')}
            </button>
          </div>
        )}
      </CardSection>
    </div>
  );
};

export default TeacherNotifications;
