import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../../hooks/useLocalization';

/**
 * Mobile-first primary navigation for the Student Portal and the Teacher Panel.
 *
 * Scope and intent:
 *  - Rendered only below the `md` breakpoint. From `md` up the existing desktop
 *    sidebar is untouched and remains the primary navigation, so desktop and
 *    tablet layouts, module order and behaviour are exactly as before.
 *  - Every item points at a route that already exists in this portal. Nothing is
 *    invented and no destination is added, so role permissions and routing are
 *    unchanged — a Student only ever sees Student routes, a Teacher only Teacher
 *    routes, because each layout passes its own list.
 *  - The bar holds exactly four destinations plus a "More" button. The remaining
 *    modules live in a bottom sheet, so Notices / Notifications never take a
 *    permanent bottom-navigation slot, and SMS is never offered here.
 *  - The Notification Bell is not part of this component. The notification
 *    unread count stays exactly where it was, in the header bell.
 *
 * Badge policy: `unreadNotices` is the unread *notice* count from the portal's
 * own notice service — the same value the desktop sidebar already shows. It is
 * surfaced twice at these widths: on the More button itself, so a newly
 * published notice is discoverable without opening the sheet, and again next to
 * the Notices row inside the sheet. Both read the same number, and the
 * Notification unread count is never added to it, so no count is double-counted
 * and the header bell stays the only place notification counts appear.
 */
const MobileBottomNav = ({ primaryItems = [], moreItems = [], unreadNotices = 0 }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef(null);
  const wasOpenRef = useRef(false);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  // Any navigation closes the sheet. The More-sheet links already close it on
  // click; this catches navigation that bypasses them (browser back/forward, a
  // redirect) so the sheet is never left floating over the new page.
  useEffect(() => {
    if (wasOpenRef.current) setMoreOpen(false);
  }, [pathname]);

  // Escape closes the sheet.
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  // Hand focus back to the More button after it closes, but never steal focus on
  // first mount.
  useEffect(() => {
    if (wasOpenRef.current && !moreOpen) moreButtonRef.current?.focus();
    wasOpenRef.current = moreOpen;
  }, [moreOpen]);

  const tabClass = ({ isActive }) =>
    `flex h-full flex-col items-center justify-center gap-1 px-0.5 py-2 transition-colors ${
      isActive
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
    }`;

  const sheetItemClass = ({ isActive }) =>
    `flex items-center gap-3 w-full rounded-lg px-3 py-3 transition-colors ${
      isActive
        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
    }`;

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeMore}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('mobileMore')}
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 pt-3 pb-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              <div className="flex flex-col">
                <span className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
                <span className="mt-3 text-sm font-semibold text-gray-800 dark:text-white">
                  {t('mobileMore')}
                </span>
              </div>
              <button
                type="button"
                onClick={closeMore}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer flex-shrink-0"
                aria-label={t('close')}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <ul className="px-2 py-2 space-y-1">
              {moreItems.map(({ to, end, labelKey, icon: Icon, showNoticeBadge }) => (
                <li key={to}>
                  <NavLink to={to} end={end} onClick={closeMore} className={sheetItemClass}>
                    <span className="relative flex-shrink-0">
                      <Icon className="h-6 w-6" />
                      {/* Unread notices only, same source as the desktop sidebar
                          badge. Hidden entirely at 0. */}
                      {showNoticeBadge && unreadNotices > 0 && (
                        <span
                          className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800"
                          title={`${unreadNotices} ${t('unread')}`}
                        >
                          {unreadNotices > 9 ? '9+' : unreadNotices}
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-medium truncate">{t(labelKey)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Safe-area padding is applied inline because Tailwind cannot express
          `env(safe-area-inset-bottom)` reliably in an arbitrary value. */}
      <nav
        aria-label={t('mobileMore')}
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-2px_12px_rgba(0,0,0,0.07)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <ul className="flex items-stretch h-16">
          {primaryItems.map(({ to, end, labelKey, icon: Icon }) => (
            <li key={to} className="flex-1 min-w-0">
              <NavLink to={to} end={end} className={tabClass}>
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="w-full text-center text-[10px] leading-tight font-medium truncate">
                  {t(labelKey)}
                </span>
              </NavLink>
            </li>
          ))}

          <li className="flex-1 min-w-0">
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              className={`flex h-full w-full flex-col items-center justify-center gap-1 px-0.5 py-2 transition-colors cursor-pointer ${
                moreOpen
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              aria-label={
                unreadNotices > 0
                  ? `${t('mobileMore')} (${unreadNotices} ${t('notices')})`
                  : t('mobileMore')
              }
              title={unreadNotices > 0 ? `${unreadNotices} ${t('notices')}` : t('mobileMore')}
            >
              <span className="relative flex-shrink-0">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 12h.01M12 12h.01M19 12h.01"
                  />
                </svg>
                {/* More badge = unread NOTICES only. It is the very same value the
                    desktop sidebar and the Notices row inside the sheet show, so
                    an unread notice is discoverable from anywhere on mobile. The
                    Notification unread count is deliberately NOT folded in here —
                    it lives on the header bell alone, so nothing is double
                    counted. Hidden entirely at 0. */}
                {unreadNotices > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800"
                    aria-hidden="true"
                  >
                    {unreadNotices > 9 ? '9+' : unreadNotices}
                  </span>
                )}
              </span>
              <span className="w-full text-center text-[10px] leading-tight font-medium truncate">
                {t('mobileMore')}
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
};

export default MobileBottomNav;
