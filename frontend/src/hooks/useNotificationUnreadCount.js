import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Unread *notification* badge hook, for the Student Portal and Teacher Panel
 * dashboards.
 *
 * The count comes from the portal's own notifications service `/unread-count`
 * endpoint — the exact value the existing header Notification Bell shows — so a
 * Quick Access tile and the Bell can never disagree. It is deliberately separate
 * from `useNoticeUnreadCount`: the two counts are unrelated and are never added
 * together or substituted for one another.
 *
 * The count refreshes:
 *   - on mount (so a reload restores the persisted state),
 *   - on route change, so a notification created since the last visit shows up
 *     without a manual reload,
 *   - whenever the notifications service emits a change, which is what the
 *     Notifications page and the Bell both do after a mark-as-read, so the badge
 *     stays in step immediately.
 *
 * Any failure is swallowed to a 0 badge: a badge is a nicety and must never
 * break the dashboard.
 */
const useNotificationUnreadCount = (service) => {
  const [count, setCount] = useState(0);
  const { pathname } = useLocation();

  const refresh = useCallback(async () => {
    try {
      setCount(await service.getUnreadCount());
    } catch {
      setCount(0);
    }
  }, [service]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    refresh();
  }, [refresh]);

  // `pathname` (not `location`) keeps this a single mount-time subscription.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  // Marking a notification read on the Notifications page or in the Bell emits a
  // change, which updates the badge without polling.
  useEffect(() => service.subscribe(refresh), [service, refresh]);

  return count;
};

export default useNotificationUnreadCount;