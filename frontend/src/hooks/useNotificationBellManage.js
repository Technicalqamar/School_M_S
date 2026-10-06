import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from './useLocalization';
import { resolveNotificationLink } from '../utils/notificationDeepLink';

/**
 * Shared Notification Bell interaction behaviour.
 *
 * Only the *interaction* lives here, so the Admin, Student and Teacher bells stay
 * in step without duplicating logic:
 *   - the Manage / Select mode (checkbox per row, Select All, Delete Selected),
 *   - the small X that removes a single notification,
 *   - the deep link a notification click resolves to.
 *
 * Nothing about how a notification is produced is touched: every delete goes
 * through the existing authorized Notification Engine endpoint, which resolves
 * the id against the signed-in user's own inbox server-side. That is what stops
 * one user from deleting another user's notification. The Notification page keeps
 * reading the same records, so a Bell delete is the same delete the page
 * already performs - there is no second store to drift out of sync.
 */
const useNotificationBellManage = ({
  service,
  scope,
  notifications,
  setNotifications,
  setUnreadCount,
  closeDropdown,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const exitManageMode = useCallback(() => {
    setManageMode(false);
    setSelectedIds([]);
  }, []);

  const enterManageMode = useCallback(() => {
    setManageMode(true);
    setSelectedIds([]);
  }, []);

  const toggleSelected = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }, []);

  const visibleIds = notifications.map((item) => item.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const everySelected = visibleIds.length > 0 && visibleIds.every((id) => prev.includes(id));
      if (everySelected) return prev.filter((id) => !visibleIds.includes(id));
      // Keep ids the reader already ticked, then add everything currently listed.
      return [...new Set([...prev, ...visibleIds])];
    });
  }, [visibleIds]);

  // Drops deleted rows locally so the dropdown never shows a record the server
  // has already removed. The service also emits a change event, which makes the
  // bell (and the unread badge) refetch, so this is only about not flickering.
  const removeLocally = useCallback(
    (ids) => {
      const removed = new Set(ids);
      const removedUnread = notifications.filter(
        (item) => removed.has(item.id) && !item.read,
      ).length;

      setNotifications((prev) => prev.filter((item) => !removed.has(item.id)));
      if (removedUnread > 0) {
        setUnreadCount((prev) => Math.max(0, prev - removedUnread));
      }
    },
    [notifications, setNotifications, setUnreadCount],
  );

  const deleteOne = useCallback(
    async (notification) => {
      if (!notification?.id || deleting) return false;
      setDeleting(true);
      try {
        await service.deleteNotification(notification.id);
        removeLocally([notification.id]);
        toast.success(t('notificationDeleted'));
        return true;
      } catch (err) {
        toast.error(err?.response?.data?.message || t('failedToDelete'));
        return false;
      } finally {
        setDeleting(false);
      }
    },
    [service, deleting, removeLocally, t],
  );

  const deleteSelected = useCallback(async () => {
    if (!selectedIds.length || deleting) return;
    setDeleting(true);
    const ids = [...selectedIds];
    try {
      await service.deleteSelected(ids);
      removeLocally(ids);
      setSelectedIds([]);
      toast.success(t('notificationsDeleted'));
    } catch (err) {
      toast.error(err?.response?.data?.message || t('failedToDelete'));
    } finally {
      setDeleting(false);
    }
  }, [service, selectedIds, deleting, removeLocally, t]);

  /**
   * A notification click: keep the existing "mark as read" behaviour, then take
   * the reader to the existing page that owns the event.
   */
  const openNotification = useCallback(
    async (notification) => {
      if (!notification) return;
      // In Manage mode a row click is a selection, not a navigation.
      if (manageMode) {
        toggleSelected(notification.id);
        return;
      }

      if (!notification.read) {
        try {
          await service.markAsRead(notification.id);
        } catch {
          // Reading is best effort: a failed read must not block the deep link.
        }
      }

      closeDropdown?.();
      navigate(resolveNotificationLink(notification, scope));
    },
    [manageMode, service, navigate, scope, toggleSelected, closeDropdown],
  );

  return {
    manageMode,
    enterManageMode,
    exitManageMode,
    selectedIds,
    selectedCount: selectedIds.length,
    isSelected: (id) => selectedIds.includes(id),
    toggleSelected,
    allSelected,
    toggleSelectAll,
    deleteOne,
    deleteSelected,
    openNotification,
    deleting,
  };
};

export default useNotificationBellManage;