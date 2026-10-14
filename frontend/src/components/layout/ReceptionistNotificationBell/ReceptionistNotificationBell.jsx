import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../../hooks/useLocalization';
import { useAuth } from '../../../contexts/AuthContext';
import { hasReceptionistActionAccess } from '../../../constants/receptionistPermissions';
import receptionistNotificationService from '../../../services/receptionist/receptionistNotification.service';

// Compact permissioned bell for the Receptionist Header.
//
// Unlike the Admin bell it is front-desk-focused by design: no manage/delete
// mode, no deep-links and no "mark all" beyond the mark-read permission. The
// backend derives the visible categories from the caller's stored
// `notification-bell` permissions and enforces `bell-view` / `mark-read`, so an
// item can never leak in and its read status only changes for the caller.
const ReceptionistNotificationBell = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const dropdownRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Mark-as-read controls come from the stored permission, not from the bell
  // state, so the UI never offers an action the backend would reject.
  const canMarkRead = hasReceptionistActionAccess(user, 'notification-bell', 'mark-read');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [listResult, count] = await Promise.all([
        receptionistNotificationService.getNotifications({ page: 1, limit: 10 }),
        receptionistNotificationService.getUnreadCount(),
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
    if (!canMarkRead || busy || unreadCount === 0) return;
    setBusy(true);
    try {
      await receptionistNotificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      toast.error(t('failedToUpdate'));
    } finally {
      setBusy(false);
    }
  };

  const markOneRead = async (notif) => {
    if (!canMarkRead || notif.read || busy) return;
    setBusy(true);
    try {
      await receptionistNotificationService.markAsRead(notif.id);
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // A read failure is not fatal for a compact bell; keep the item unread.
    } finally {
      setBusy(false);
    }
  };

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
        aria-label={t('notifications')}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && !busy && (
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
              {canMarkRead && notifications.length > 0 && (
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
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  onClick={() => markOneRead(notif)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 transition-colors cursor-pointer ${
                    !notif.read
                      ? 'bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:hover:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!notif.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                    <div className="flex-1 min-w-0">
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
                      {notif.category && (
                        <span className="inline-block mt-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded px-1.5 py-0.5">
                          {notif.category}
                        </span>
                      )}
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        {formatTime(notif.time)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionistNotificationBell;