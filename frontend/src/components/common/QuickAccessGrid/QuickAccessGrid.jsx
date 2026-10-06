import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '../../../hooks/useLocalization';

/**
 * Dashboard "Quick Access" grid, shared by the Student Portal and the Teacher
 * Panel so both portals render identically.
 *
 * Every item is a plain link to a route that already exists in that portal, so
 * routing and role permissions are untouched — a Student only ever links to
 * Student routes, a Teacher only to Teacher routes, because each dashboard passes
 * its own list.
 *
 * Layout is mobile-first and does not change any dashboard data or API:
 *   - below `sm` the tiles are compact and stacked — icon above a short label,
 *     two per row, the trailing chevron hidden — so a 320px screen gets full,
 *     touch-sized tiles instead of one-per-row wide bars. Labels may wrap to two
 *     lines and `break-words` guarantees they never overflow the tile.
 *   - `sm` and up keeps the original horizontal tile: icon, label, chevron, with
 *     the same accent palette, border, hover lift and shadow.
 *
 * `badge` is an optional unread count. It is rendered only when greater than 0,
 * capped at `9+`, and sits on the icon exactly like the sidebar / More-sheet
 * badges. Each portal passes its own real per-recipient counts; the Notification
 * count and the Notice count are always kept apart and never combined.
 */
const QuickAccessGrid = ({
  items = [],
  columnsClassName = 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-2',
  className = '',
}) => {
  const { t } = useTranslation();

  return (
    <div className={`grid gap-2 sm:gap-3 ${columnsClassName} ${className}`}>
      {items.map(({ to, label, icon: Icon, accent, badge = 0 }) => (
        <Link
          key={to}
          to={to}
          className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-center transition-all duration-200 hover:shadow-md sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3.5 sm:text-left sm:hover:-translate-y-0.5 ${accent}`}
        >
          <span className="relative flex-shrink-0">
            <Icon className="h-5 w-5" />
            {/* Unread badge only, hidden entirely at 0. */}
            {badge > 0 && (
              <span
                className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800"
                title={`${badge} ${t('unread')}`}
              >
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </span>
          <span className="min-w-0 text-xs sm:text-sm font-semibold leading-tight text-gray-800 dark:text-gray-200 break-words sm:flex-1">
            {label}
          </span>
          <ArrowRightIcon className="hidden sm:block h-4 w-4 text-gray-400 flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
};

export default QuickAccessGrid;