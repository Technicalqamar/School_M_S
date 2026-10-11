import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  IdentificationIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import receptionistService from '../../services/receptionist/receptionist.service';

const STATUS_STYLES = {
  Present: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  Absent: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  Leave: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  Late: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const ReceptionistAttendance = () => {
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (e) => {
    e.preventDefault();
    const id = studentId.trim();
    if (!id) {
      setError('Enter a student ID to look up attendance.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await receptionistService.getAttendanceByStudent(id);
      setResult(response.data);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'You do not have permission to view attendance.'
          : err.response?.data?.message || 'Unable to load attendance. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const student = result?.student;
  const records = result?.attendance || [];

  const counts = records.reduce(
    (acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Student Attendance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Look up a student&apos;s attendance record by student ID. Read-only.
        </p>
      </div>

      <form onSubmit={load} className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Enter student ID, e.g. STD-000001"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          Look up
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {result && !loading && (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white font-bold text-sm flex-shrink-0">
                  {student?.fullName?.charAt(0)?.toUpperCase() || 'S'}
                </div>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{student?.fullName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {student?.studentId} · {student?.class || 'No class'} · {student?.status || 'Unknown'}
                  </p>
                </div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Academic year: {result.academicYear}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Present</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{counts.Present || 0}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Absent</p>
              <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{counts.Absent || 0}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Leave</p>
              <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.Leave || 0}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Late</p>
              <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{counts.Late || 0}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircleIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No attendance records for this academic year.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Date</th>
                      <th className="px-5 py-3 text-left font-medium">Status</th>
                      <th className="px-5 py-3 text-left font-medium">Method</th>
                      <th className="px-5 py-3 text-left font-medium">Check In</th>
                      <th className="px-5 py-3 text-left font-medium">Check Out</th>
                      <th className="px-5 py-3 text-left font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {records.map((record) => (
                      <tr key={record._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="px-5 py-3 whitespace-nowrap text-gray-700 dark:text-gray-200">
                          {formatDate(record.date)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              STATUS_STYLES[record.status] || STATUS_STYLES.Absent
                            }`}
                          >
                            {record.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{record.method || 'Manual'}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{formatTime(record.checkIn)}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{formatTime(record.checkOut)}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{record.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-16 text-center">
          <IdentificationIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter a student ID to view their attendance record.
          </p>
        </div>
      )}

      {result && !loading && (
        <p className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <AcademicCapIcon className="h-4 w-4" />
          Showing {records.length} attendance record{records.length === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
};

export default ReceptionistAttendance;