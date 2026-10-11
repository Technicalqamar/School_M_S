import { useEffect, useState, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import receptionistService from '../../services/receptionist/receptionist.service';

const STATUS_STYLES = {
  Active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  Inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  Graduated: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
};

const StudentRecords = () => {
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ totalStudents: 0, totalPages: 1, currentPage: 1 });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (searchTerm, pageNumber) => {
    setLoading(true);
    setError('');
    try {
      const response = await receptionistService.getStudents({
        search: searchTerm || undefined,
        page: pageNumber,
        limit: 10,
      });
      const data = response.data || {};
      setStudents(data.students || []);
      setPagination({
        totalStudents: data.totalStudents || 0,
        totalPages: data.totalPages || 1,
        currentPage: data.currentPage || pageNumber,
      });
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'You do not have permission to view student records.'
          : err.response?.data?.message || 'Unable to load students. Please try again.',
      );
      setStudents([]);
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
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Student Records</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Search and view student profiles. Read-only access.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, student ID or father's name"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600"
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

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UsersIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No students found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Student ID</th>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Class</th>
                  <th className="px-5 py-3 text-left font-medium">Father Name</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {students.map((student) => (
                  <tr key={student._id || student.studentId} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">
                      {student.studentId}
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{student.fullName}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{student.class || '—'}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{student.fatherName || '—'}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLES[student.status] || STATUS_STYLES.Inactive
                        }`}
                      >
                        {student.status || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {pagination.currentPage} of {pagination.totalPages} — {pagination.totalStudents} students
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

export default StudentRecords;
