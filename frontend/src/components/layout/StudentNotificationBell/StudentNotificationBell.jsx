import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { BellIcon, BellAlertIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../../hooks/useLocalization';
import useNotificationBellManage from '../../../hooks/useNotificationBellManage';
import { NOTIFICATION_LINK_SCOPES } from '../../../utils/notificationDeepLink';
import { usePortal } from '../../../contexts/PortalContext';
import studentNotificationsService, {
  NOTIFICATION_TYPE_LABEL_KEYS,
} from '../../../services/student/studentNotifications.service';

const PREVIEW_LIMIT = 5;

const formatPreviewTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Student Portal notification bell.
 *
 * Reads the same recipient-scoped Notification API as the Notifications page, so
 * the badge can only ever show the logged-in student's own unread count - or the
 * selected student's, when an Administrator opened the Portal Access tab. The
 * Admin bell is left untouched.
 */
const StudentNotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const portal = usePortal();
  const isPortalAccess = Boolean(portal?.isPortalAccess);
  const notificationsPath = isPortalAccess
    ? '/portal/access/notifications'
    : '/student/dashboard/notifications';
  const dropdownRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [listResult, count] = await Promise.all([
        studentNotificationsService.getNotifications({ page: 1, limit: PREVIEW_LIMIT }),
        studentNotificationsService.getUnreadCount(),
      ]);
      setNotifications(listResult.notifications);
      setUnreadCount(count);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // The Student Header persists across portal routes, so the count would go
  // stale after a mark-as-read elsewhere. Refetch whenever the URL changes.
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      fetchData();
    }
  }, [location.pathname, fetchData]);

  // Keep in step with the Notifications page, which calls emitChange().
  useEffect(() => studentNotificationsService.subscribe(fetchData), [fetchData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) fetchData();
  };

  const markAllRead = async () => {
    // unreadCount is the server's total, not just the visible preview, so the
    // action stays available when every unread item is beyond the first page.
    if (unreadCount === 0 || busy) return;
    setBusy(true);
    try {
      await studentNotificationsService.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch {
      toast.error(t('markNotificationReadError'));
    } finally {
      setBusy(false);
    }
  };

  const typeLabel = (type) => {
    if (!type) return null;
    const labelKey = NOTIFICATION_TYPE_LABEL_KEYS[type];
    return labelKey ? t(labelKey) : t('notificationTypeGeneral');
  };

  const {
    manageMode,
    enterManageMode,
    exitManageMode,
    selectedCount,
    isSelected,
    toggleSelected,
    allSelected,
    toggleSelectAll,
    deleteOne,
    deleteSelected,
    openNotification,
    deleting,
  } = useNotificationBellManage({
    service: studentNotificationsService,
    scope: isPortalAccess ? NOTIFICATION_LINK_SCOPES.PORTAL_ACCESS : NOTIFICATION_LINK_SCOPES.STUDENT,
    notifications,
    setNotifications,
    setUnreadCount,
    closeDropdown: () => setIsOpen(false),
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggle}
        aria-label={t('notifications')}
        className="relative p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-600 hover:text-blue-600 dark:hover:text-yellow-400 transition-all duration-200 cursor-pointer"
      >
        <BellIcon className="h-5 w-5" />
        {/* Badge is hidden entirely when there is nothing unread. */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800 px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Below `md` the bell opens as a top-anchored drawer: it starts
              directly under the fixed header (`top-16` = `h-16`) and runs to
              the bottom edge of the viewport, so it is always fully visible on
              a small screen and never slides up from the bottom. It spans
              exactly the viewport width, so it cannot overflow horizontally or
              trigger background scrolling, and it sits above the `z-40` bottom
              navigation. `md` is also the breakpoint at which the mobile bottom
              navigation disappears and the original anchored dropdown is
              restored (no animation there), so the two never apply at once. */}
          <div
            className="fixed inset-0 z-40 bg-black/50 animate-[bellBackdropIn_0.18s_ease-out] md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 top-16 bottom-0 z-50 flex flex-col overflow-hidden border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 animate-[bellDrawerIn_0.18s_ease-out] md:absolute md:top-full md:bottom-auto md:left-auto md:right-0 md:mt-2 md:w-80 md:rounded-xl md:border md:shadow-xl md:animate-none">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-gray-200 px-4 pt-3 pb-3 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              {t('notifications')}
            </h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={manageMode ? exitManageMode : enterManageMode}
                  className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium transition-colors cursor-pointer py-1 md:py-0"
                >
                  {manageMode ? t('done') : t('manageNotifications')}
                </button>
              )}
              {!manageMode && unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={busy}
                  className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium transition-colors cursor-pointer disabled:opacity-50 py-1 md:py-0"
                >
                  {t('markAllRead')}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t('close')}
                className="p-2 md:p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:max-h-80 md:flex-none">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <BellIcon className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2 animate-pulse" />
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('loading')}
                </p>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <BellAlertIcon className="h-8 w-8 text-red-400 mb-2" />
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('notificationsLoadError')}
                </p>
                <button
                  onClick={fetchData}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
                >
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                  {t('retry')}
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <BellIcon className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t('noNotifications')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {t('allCaughtUp')}
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const label = typeLabel(notification.type);
                const selected = isSelected(notification.id);

                return (
                  <div
                    key={notification.id}
                    className={`border-b border-gray-100 dark:border-gray-700/50 transition-colors ${
                      manageMode
                        ? selected
                          ? 'bg-blue-50/80 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        : notification.read
                          ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          : 'bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    <div className="flex items-start gap-2 px-4 py-3">
                      {manageMode ? (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelected(notification.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={notification.title}
                          className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      ) : (
                        !notification.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <div className={manageMode ? '' : notification.read ? 'ml-4' : ''}>
                          <p
                            className={`text-sm ${
                              notification.read
                                ? 'font-medium text-gray-700 dark:text-gray-300'
                                : 'font-semibold text-gray-900 dark:text-white'
                            }`}
                          >
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {label && (
                              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                {label}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {formatPreviewTime(notification.time)}
                            </span>
                          </div>
                        </div>
                      </button>
                      {/* Small X: removes only this notification. */}
                      <button
                        type="button"
                        onClick={() => deleteOne(notification)}
                        disabled={deleting}
                        aria-label={t('deleteNotification')}
                        className="flex-shrink-0 p-1 -mr-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div
            className="shrink-0 border-t border-gray-200 px-4 pt-2.5 text-center dark:border-gray-700"
            style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {manageMode ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors cursor-pointer py-1 md:py-0"
                >
                  {allSelected ? t('clearSelection') : t('selectAll')}
                </button>
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={selectedCount === 0 || deleting}
                  className="text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed py-1 md:py-0"
                >
                  {t('deleteSelected')}
                </button>
              </div>
            ) : (
              <Link
                to={notificationsPath}
                onClick={() => setIsOpen(false)}
                className="inline-block py-1 md:py-0 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                {t('viewAllNotifications')}
              </Link>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StudentNotificationBell;
