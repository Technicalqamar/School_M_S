import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Sidebar badge hook for the recipient notice boards (Student Portal and Teacher
 * Panel).
 *
 * The count is unread *notices* only. It comes from the notice service's own
 * `/unread-count` endpoint, which is backed by the same audience + Published +
 * academic-year reach filter as the list — so a Draft or Archived notice can
 * never inflate it, and the Notification Bell's count is never mixed in.
 *
 * The count refreshes:
 *   - on mount (so a reload restores the persisted state),
 *   - on route change, because the sidebar is always mounted and a newly
 *     published notice should show up after navigating around the portal,
 *   - whenever the notices page marks something read (service pub/sub), so
 *     opening a notice or "mark all read" updates the badge immediately.
 *
 * Any failure is swallowed to a 0 badge: a badge is a nicety and must never
 * break navigation.
 */
const useNoticeUnreadCount = (service) => {
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

  // The sidebar persists across routes, so refetch on every navigation: a
  // notice published since the last visit must raise the badge without a
  // manual reload. `pathname` (not `location`) is the dependency so this stays
  // a single mount-time subscription.
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  // Marking a notice read on the Notices page emits a change, which keeps the
  // always-visible badge in step without polling.
  useEffect(() => service.subscribe(refresh), [service, refresh]);

  return count;
};

export default useNoticeUnreadCount;