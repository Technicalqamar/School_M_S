import { useCallback, useEffect, useState } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  MegaphoneIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import receptionistService from '../../services/receptionist/receptionist.service';

const AUDIENCE_STYLES = {
  All: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  Staff: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  Students: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400',
  Teachers: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ReceptionistNotices = () => {
  const [notices, setNotices] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (searchTerm, pageNumber) => {
    setLoading(true);
    setError('');
    try {
      const response = await receptionistService.getNotices({
        search: searchTerm || undefined,
        page: pageNumber,
        limit: 10,
      });
      const data = response.data || {};
      setNotices(data.notices || []);
      setPagination({
        currentPage: data.pagination?.currentPage || pageNumber,
        totalPages: data.pagination?.totalPages || 1,
        totalItems: data.pagination?.totalItems || 0,
      });
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'You do not have permission to view notices.'
          : err.response?.data?.message || 'Unable to load notices. Please try again.',
      );
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(search, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(search, 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Notices</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Published school announcements. Read-only.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notices by title or message"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setPage(1);
            load('', 1);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Reset
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 text-center">
          <MegaphoneIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No published notices found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <div
              key={notice._id || notice.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-800 dark:text-white">{notice.title}</h2>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                    AUDIENCE_STYLES[notice.audience] || AUDIENCE_STYLES.All
                  }`}
                >
                  {notice.audience || 'All'}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                {notice.content || notice.message || ''}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarDaysIcon className="h-4 w-4" />
                  {formatDate(notice.publishedAt || notice.createdAt || notice.publishedOn)}
                </span>
                {notice.createdBy?.fullName && <span>By {notice.createdBy.fullName}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {pagination.currentPage} of {pagination.totalPages} — {pagination.totalItems} notices
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.currentPage <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceptionistNotices;