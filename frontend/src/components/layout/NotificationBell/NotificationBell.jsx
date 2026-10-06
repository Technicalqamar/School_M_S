import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../../hooks/useLocalization';
import useNotificationBellManage from '../../../hooks/useNotificationBellManage';
import { NOTIFICATION_LINK_SCOPES } from '../../../utils/notificationDeepLink';
import notificationService from '../../../services/communication/notification.service';

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
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
        notificationService.getNotifications({ page: 1, limit: 10 }),
        notificationService.getUnreadCount(),
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

  // The Admin Header persists across routes, so the count would otherwise stay
  // stale after mutations elsewhere. Refetch whenever the URL changes too.
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      fetchData();
    }
  }, [location.pathname, fetchData]);

  // Refresh as soon as the Notifications page creates/marks-read/deletes a
  // notification, so the always-visible badge updates without opening the
  // dropdown. subscribe() returns the unsubscribe function used on cleanup.
  useEffect(() => notificationService.subscribe(fetchData), [fetchData]);

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
    const hasUnread = notifications.some((n) => !n.read);
    if (!hasUnread || busy) return;
    setBusy(true);
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      toast.error(t('failedToUpdate'));
    } finally {
      setBusy(false);
    }
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
    service: notificationService,
    scope: NOTIFICATION_LINK_SCOPES.ADMIN,
    notifications,
    setNotifications,
    setUnreadCount,
    closeDropdown: () => setIsOpen(false),
  });

  const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return `${diffMins} ${t('minutesAgo')}`;
    if (diffHours < 24) return `${diffHours}${t('hoursAgo')}`;
    return `${diffDays}${t('daysAgo')}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggle}
        className="relative p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-600 hover:text-blue-600 dark:hover:text-yellow-400 transition-all duration-200 cursor-pointer"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800 px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">{t('notifications')}</h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={manageMode ? exitManageMode : enterManageMode}
                  className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium transition-colors cursor-pointer"
                >
                  {manageMode ? t('done') : t('manageNotifications')}
                </button>
              )}
              {!manageMode && notifications.length > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={busy}
                  className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  {t('markAllRead')}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                aria-label={t('close')}
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BellIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3 animate-pulse" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('loading')}</p>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('failedToLoad')}</p>
                <button
                  onClick={fetchData}
                  className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors cursor-pointer"
                >
                  {t('retry')}
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BellIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('noNotifications')}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('allCaughtUp')}</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const selected = isSelected(notif.id);

                return (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 transition-colors ${
                      manageMode
                        ? selected
                          ? 'bg-blue-50/80 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        : !notif.read
                          ? 'bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {manageMode ? (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelected(notif.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={notif.title}
                          className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      ) : (
                        !notif.read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => openNotification(notif)}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <div className={manageMode ? '' : notif.read ? 'ml-5' : ''}>
                          <p
                            className={`text-sm ${
                              !notif.read
                                ? 'font-semibold text-gray-900 dark:text-white'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {notif.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {notif.message || notif.content}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                            {formatTime(notif.time)}
                          </p>
                        </div>
                      </button>
                      {/* Small X: removes only this notification. */}
                      <button
                        type="button"
                        onClick={() => deleteOne(notif)}
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

          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 text-center">
              {manageMode ? (
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors cursor-pointer"
                  >
                    {allSelected ? t('clearSelection') : t('selectAll')}
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    disabled={selectedCount === 0 || deleting}
                    className="text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('deleteSelected')}
                  </button>
                </div>
              ) : (
                <Link
                  to="/admin/communication/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
                >
                  {t('viewAllNotifications')}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;