import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  BanknotesIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';
import receptionistService from '../../services/receptionist/receptionist.service';
import { useCurrency } from '../../hooks/useLocalization';

const DUE_STATUS_STYLES = {
  Unpaid: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  Partial: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  Paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
};

const ReceptionistFees = () => {
  const { formatCurrency } = useCurrency();
  const [studentId, setStudentId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (e) => {
    e.preventDefault();
    const id = studentId.trim();
    if (!id) {
      setError('Enter a student ID to look up fee dues.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await receptionistService.getFeesByStudent(id);
      setResult(response.data);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'You do not have permission to view fee dues.'
          : err.response?.data?.message || 'Unable to load fee dues. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const student = result?.student;
  const fees = result?.fees;
  const dues = fees?.dues || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Fees &amp; Dues</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Look up a student&apos;s outstanding fee dues by student ID. Read-only.
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
                Academic year: {fees?.academicYear}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Monthly Fee</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">
                {fees?.monthlyFee === null || fees?.monthlyFee === undefined ? '—' : formatCurrency(fees.monthlyFee)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Outstanding</p>
              <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                {fees?.totalOutstanding === null || fees?.totalOutstanding === undefined
                  ? '—'
                  : formatCurrency(fees.totalOutstanding)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Paid This Year</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {fees?.totalPaidThisYear === null || fees?.totalPaidThisYear === undefined
                  ? '—'
                  : formatCurrency(fees.totalPaidThisYear)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400">Dues Count</p>
              <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">
                {fees?.outstandingCount ?? 0}
              </p>
            </div>
          </div>

          {fees?.structureAvailable === false && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              No active fee structure is configured for this student&apos;s class this academic year.
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            {dues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BanknotesIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No outstanding dues for this student.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Fee Type</th>
                      <th className="px-5 py-3 text-left font-medium">Month / Exam</th>
                      <th className="px-5 py-3 text-left font-medium">Amount</th>
                      <th className="px-5 py-3 text-left font-medium">Paid</th>
                      <th className="px-5 py-3 text-left font-medium">Remaining</th>
                      <th className="px-5 py-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {dues.map((due) => (
                      <tr key={due.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{due.feeType || '—'}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{due.exam || due.month || '—'}</td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-200">
                          {due.amount === null || due.amount === undefined ? '—' : formatCurrency(due.amount)}
                        </td>
                        <td className="px-5 py-3 text-gray-700 dark:text-gray-200">
                          {due.totalPaid === null || due.totalPaid === undefined ? '—' : formatCurrency(due.totalPaid)}
                        </td>
                        <td className="px-5 py-3 font-medium text-red-600 dark:text-red-400">
                          {due.remaining === null || due.remaining === undefined ? '—' : formatCurrency(due.remaining)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              DUE_STATUS_STYLES[due.status] || DUE_STATUS_STYLES.Partial
                            }`}
                          >
                            {due.status || 'Unknown'}
                          </span>
                        </td>
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
            Enter a student ID to view their fee dues.
          </p>
        </div>
      )}
    </div>
  );
};

export default ReceptionistFees;