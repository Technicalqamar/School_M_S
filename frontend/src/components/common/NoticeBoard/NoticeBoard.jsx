import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  MegaphoneIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import CardSection from '../CardSection/CardSection';
import Modal from '../Modal/Modal';
import { useTranslation } from '../../../hooks/useLocalization';
import {
  formatDateTime,
  getAudienceLabel,
  getStatusStyle,
} from '../../../utils/communicationUtils';

/**
 * Shared notice board for the recipient portals (Student Portal and Teacher
 * Panel).
 *
 * Both portals read the *same* notices the Admin Communication → Notices module
 * manages - there is no second copy of a notice anywhere, and nothing here is
 * ever written into the Notification collection.
 *
 * The only thing the board knows about its caller is which service to call and
 * which subtitle to show. Every scoping decision (audience, publish status,
 * academic year, class) AND the reader's own read/unread state are resolved by
 * the server from the authenticated session, so this component never sends an id
 * of its own and can never mark somebody else's notice as read.
 *
 * Read state lives on the notice document (the same `readBy` list the Notification
 * module uses), keyed on the reader's own profile. Opening a notice calls
 * `markAsRead`, which is idempotent server-side, so re-opening never duplicates
 * state; the sidebar badge then refreshes through the service's pub/sub.
 */
const ITEMS_PER_PAGE = 10;

/** Loading placeholder - mirrors the row geometry so the layout does not jump. */
const SkeletonRow = () => (
  <div className="px-4 md:px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 animate-pulse">
    <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-gray-700" />
    <div className="mt-2.5 h-3 w-full rounded bg-gray-100 dark:bg-gray-700" />
    <div className="mt-2 h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700" />
    <div className="mt-3 h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-700" />
  </div>
);

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-16">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <MegaphoneIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
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

/** Small "New" / "Read" pill that makes unread rows distinguishable at a glance. */
const ReadPill = ({ read, unreadLabel, readLabel }) =>
  read ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
      <CheckBadgeIcon className="h-3 w-3" />
      {readLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
      {unreadLabel}
    </span>
  );

const NoticeDetail = ({ notice, open, onClose, t }) => (
  <Modal isOpen={open} onClose={onClose} title={t('noticeDetails')} maxWidth="max-w-2xl">
    {notice && (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ReadPill read={notice.read} unreadLabel={t('unread')} readLabel={t('read')} />
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusStyle(notice.status)}`}
          >
            {notice.status}
          </span>
        </div>

        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white break-words">
            {notice.title}
          </h3>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line break-words leading-relaxed">
          {notice.content}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1.5">
            <UserGroupIcon className="h-3.5 w-3.5" />
            {getAudienceLabel(t, notice.audience)}
            {notice.classNames.length > 0 && (
              <span className="text-gray-400 dark:text-gray-500">
                ({notice.classNames.join(', ')})
              </span>
            )}
          </span>

          <span className="inline-flex items-center gap-1.5">
            <CalendarDaysIcon className="h-3.5 w-3.5" />
            {t('publishedOn')}: {formatDateTime(notice.publishedOn)}
          </span>

          <span>
            {t('academicYearLabel')}: {notice.academicYear || '—'}
          </span>

          {notice.postedBy && (
            <span>
              {t('createdBy')}: {notice.postedBy}
            </span>
          )}
        </div>
      </div>
    )}
  </Modal>
);

const NoticeBoard = ({ service, subtitleKey }) => {
  const { t } = useTranslation();

  const [notices, setNotices] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  // `t` is rebuilt on every render by useLocalization, so it must not appear in
  // these dependencies - that would re-trigger the effect in a fetch loop.
  // Error/empty copy is resolved during render instead of being stored here.
  const loadNotices = useCallback(async () => {
    setLoadFailed(false);
    try {
      const [result, count] = await Promise.all([
        service.getNotices({
          search,
          unreadOnly,
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        }),
        // The badge number comes from the server, so it always agrees with what
        // the server would allow this reader to see.
        service.getUnreadCount().catch(() => 0),
      ]);
      setNotices(result.notices);
      setPagination(result.pagination);
      setUnreadCount(count);
    } catch {
      setNotices([]);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [service, search, unreadOnly, currentPage]);

  useEffect(() => {
    setIsLoading(true);
    loadNotices().catch(() => {});
  }, [loadNotices]);

  // Keeps the board in step with a mark-as-read performed elsewhere (e.g. the
  // detail modal) and with a notice marked read by the same page's badge.
  useEffect(() => service.subscribe(() => loadNotices().catch(() => {})), [service, loadNotices]);

  const refresh = () => {
    setIsLoading(true);
    setLoadFailed(false);
    loadNotices().catch(() => {});
  };

  const goToPage = (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    setCurrentPage(page);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setCurrentPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setCurrentPage(1);
  };

  /**
   * Opening a notice marks it read. The row is optimistically flipped so the
   * UI reacts instantly; a failed call reloads from the server so the badge and
   * the row never drift from the stored state.
   */
  const openNotice = async (notice) => {
    setSelected(notice);
    if (!notice.read) {
      setNotices((prev) => prev.map((item) => (item.id === notice.id ? { ...item, read: true } : item)));
    }

    try {
      const result = await service.markAsRead(notice.id);
      setSelected((prev) => (prev ? (result?.notice || { ...notice, read: true }) : prev));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      loadNotices().catch(() => {});
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await service.markAllRead();
      setNotices((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
      // If the unread-only filter is on, everything is now read, so the list
      // reloads to show the (now empty) filtered view rather than stale rows.
      if (unreadOnly) await loadNotices();
    } catch {
      toast.error(t('failedToUpdate'));
      loadNotices().catch(() => {});
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('notices')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t(subtitleKey)}</p>
          {!isLoading && !loadFailed && unreadCount > 0 && (
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1.5">
              {unreadCount} {t('unread')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 self-start">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              <CheckBadgeIcon className="h-4 w-4" />
              {t('markAllRead')}
            </button>
          )}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs font-medium cursor-pointer disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </div>
      </div>

      <CardSection title={t('noticesList')} className="mt-6 !p-0">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 md:px-6 py-3 border-b border-gray-100 dark:border-gray-700"
        >
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('searchNotice')}
              aria-label={t('searchNotice')}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setUnreadOnly((prev) => !prev);
                setCurrentPage(1);
              }}
              aria-pressed={unreadOnly}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                unreadOnly
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-transparent'
              }`}
            >
              {t('unread')}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {t('search')}
            </button>
            {(search || unreadOnly) && (
              <button
                type="button"
                onClick={() => {
                  handleClearSearch();
                  setUnreadOnly(false);
                }}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 text-xs font-medium transition-colors cursor-pointer"
              >
                {t('clear')}
              </button>
            )}
          </div>
        </form>

        {isLoading ? (
          <div>
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
        ) : loadFailed ? (
          <ErrorState message={t('noticesLoadError')} retryLabel={t('retry')} onRetry={refresh} />
        ) : notices.length === 0 ? (
          <EmptyState
            title={search || unreadOnly ? t('noNoticesFound') : t('noNoticesForYou')}
            description={search || unreadOnly ? t('tryDifferentSearch') : t('noNoticesForYouDescription')}
          />
        ) : (
          <ul>
            {notices.map((notice) => (
              <li
                key={notice.id}
                // Unread rows are tinted and bolded so they read as different at
                // a glance; the whole row is the "open" affordance.
                className={`px-4 md:px-6 py-4 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 transition-colors cursor-pointer ${
                  notice.read
                    ? 'hover:bg-gray-50 dark:hover:bg-gray-700/20'
                    : 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
                onClick={() => openNotice(notice)}
              >
                <div className="flex items-start gap-3">
                  {!notice.read && (
                    <span
                      className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2"
                      aria-hidden="true"
                    />
                  )}

                  <div
                    className={`p-2.5 rounded-lg flex-shrink-0 ${
                      notice.read
                        ? 'bg-gray-100 dark:bg-gray-700'
                        : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}
                  >
                    <MegaphoneIcon
                      className={`h-5 w-5 ${
                        notice.read
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-blue-600 dark:text-blue-400'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`text-sm break-words ${
                          notice.read
                            ? 'font-semibold text-gray-700 dark:text-gray-300'
                            : 'font-bold text-gray-900 dark:text-white'
                        }`}
                      >
                        {notice.title}
                      </h4>

                      <ReadPill read={notice.read} unreadLabel={t('unread')} readLabel={t('read')} />

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusStyle(notice.status)}`}
                      >
                        {notice.status}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 whitespace-pre-line break-words">
                      {notice.content}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-gray-400 dark:text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <UserGroupIcon className="h-3.5 w-3.5" />
                        {getAudienceLabel(t, notice.audience)}
                        {notice.classNames.length > 0 && (
                          <span className="text-gray-400 dark:text-gray-500">
                            ({notice.classNames.join(', ')})
                          </span>
                        )}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDaysIcon className="h-3.5 w-3.5" />
                        {t('publishedOn')}: {formatDateTime(notice.publishedOn)}
                      </span>

                      <span>
                        {t('academicYearLabel')}: {notice.academicYear || '—'}
                      </span>

                      {notice.postedBy && (
                        <span>
                          {t('createdBy')}: {notice.postedBy}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
                        <EyeIcon className="h-3.5 w-3.5" />
                        {t('viewDetails')}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!isLoading && !loadFailed && notices.length > 0 && pagination.totalPages > 1 && (
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

      <NoticeDetail notice={selected} open={Boolean(selected)} onClose={() => setSelected(null)} t={t} />
    </div>
  );
};

export default NoticeBoard;