import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDaysIcon,
  XCircleIcon,
  ClockIcon,
  AcademicCapIcon,
  UserCircleIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import Spinner from '../../components/common/Spinner/Spinner';
import studentAttendanceService from '../../services/student/studentAttendance.service';
import { useTranslation } from '../../hooks/useLocalization';

const EMPTY_DASH = '—';

// ─── Formatting helpers ────────────────────────────────────────────────────
// 'YYYY-MM-DD' → Date parsed as LOCAL time (avoids UTC day shifts).
const parseDateOnly = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatDate = (value) => {
  const d = parseDateOnly(value);
  if (!d) return EMPTY_DASH;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCreatedOn = (value) => {
  if (!value) return EMPTY_DASH;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY_DASH;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Status palettes ───────────────────────────────────────────────────────
const ATTENDANCE_BADGE = {
  Present: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  Absent: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  Late: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  Leave: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800',
};

const ATTENDANCE_DOT = {
  Present: 'bg-emerald-500',
  Absent: 'bg-rose-500',
  Late: 'bg-amber-500',
  Leave: 'bg-violet-500',
};

const LEAVE_BADGE = {
  Pending: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  Approved: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  Rejected: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
};

const Badge = ({ palette, children }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${palette}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {children}
  </span>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-12">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <Icon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

/**
 * Student Attendance — READ-ONLY attendance + leave requests.
 *
 * The logged-in student only ever sees their OWN real attendance (from the
 * existing `studentattendances` records) and their own leave requests (from
 * the existing Leave Management `leaves` collection). There are no attendance
 * marking or QR scanning controls here, and check-out time is never part of
 * the API or the page. Approved leave automatically appears as "Leave" days in
 * the attendance history through the existing Leave logic on the server.
 */
const StudentAttendance = () => {
  const { t } = useTranslation();

  // Attendance
  const [attendance, setAttendance] = useState({
    student: null,
    academicYear: '',
    summary: { present: 0, absent: 0, late: 0, leave: 0, total: 0 },
    records: [],
  });
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');

  // Leave requests
  const [leaves, setLeaves] = useState({ leaves: [], count: 0 });
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [leavesError, setLeavesError] = useState('');

  // Leave form
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const result = await studentAttendanceService.getAttendance();
      setAttendance(result);
    } catch (err) {
      const message = err?.response?.data?.message || t('attendanceLoadError');
      setAttendanceError(message);
      toast.error(message);
      if (import.meta.env.DEV) {
        console.error('Attendance load failed', { status: err?.response?.status, detail: err?.response?.data, error: err });
      }
    } finally {
      setAttendanceLoading(false);
    }
  }, [t]);

  const loadLeaves = useCallback(async () => {
    setLeavesLoading(true);
    setLeavesError('');
    try {
      const result = await studentAttendanceService.getLeaveRequests();
      setLeaves(result);
    } catch (err) {
      const message = err?.response?.data?.message || t('leaveRequestsLoadError');
      setLeavesError(message);
      toast.error(message);
      if (import.meta.env.DEV) {
        console.error('Leave requests load failed', { status: err?.response?.status, detail: err?.response?.data, error: err });
      }
    } finally {
      setLeavesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAttendance();
    loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    loadAttendance();
    loadLeaves();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.fromDate || !form.toDate) {
      setFormError(t('dateRangeRequired'));
      return;
    }
    if (form.toDate < form.fromDate) {
      setFormError(t('dateRangeInvalid'));
      return;
    }
    if (!form.reason.trim()) {
      setFormError(t('reasonRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await studentAttendanceService.requestLeave({
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason.trim(),
      });
      toast.success(t('leaveRequestSubmitted'));
      setForm({ fromDate: '', toDate: '', reason: '' });
      setFormError('');
      await loadLeaves();
    } catch (err) {
      const message = err?.response?.data?.message || t('leaveRequestSubmitFailed');
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const student = attendance.student;
  const records = attendance.records;
  const summary = attendance.summary || { present: 0, absent: 0, late: 0, leave: 0, total: 0 };

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{t('attendance')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('attendanceSubtitle')}</p>
      </div>

      {/* Student + Academic Year + Refresh */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 max-w-full">
            <UserCircleIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate min-w-0">{student?.studentId || EMPTY_DASH}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 max-w-full">
            <AcademicCapIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate min-w-0">
              {t('class')}: {student?.className || EMPTY_DASH}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 max-w-full">
            <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate min-w-0">
              {t('academicYear')}: {attendance.academicYear || EMPTY_DASH}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={attendanceLoading || leavesLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors disabled:opacity-60 sm:ml-auto"
        >
          <ArrowPathIcon className={`h-4 w-4 ${attendanceLoading || leavesLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {/* ── Attendance Summary ─────────────────────────────────────────────── */}
      <section aria-label={t('summary')}>
        {attendanceLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-gray-500 dark:text-gray-400">
            <Spinner size="lg" className="text-blue-600" />
            <p className="text-sm">{t('loadingData')}</p>
          </div>
        ) : attendanceError ? (
          <CardSection>
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <EmptyState icon={XCircleIcon} title={t('somethingWentWrong')} description={attendanceError} />
              <button
                type="button"
                onClick={loadAttendance}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                {t('tryAgain')}
              </button>
            </div>
          </CardSection>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <SummaryCard label={t('present')} value={summary.present} dot="bg-emerald-500" />
            <SummaryCard label={t('absent')} value={summary.absent} dot="bg-rose-500" />
            <SummaryCard label={t('late')} value={summary.late} dot="bg-amber-500" />
            <SummaryCard label={t('leave')} value={summary.leave} dot="bg-violet-500" />
            <SummaryCard label={t('total')} value={summary.total} dot="bg-blue-500" />
          </div>
        )}
      </section>

      {/* ── Attendance History ─────────────────────────────────────────────── */}
      <CardSection title={t('attendanceHistory')}>
        {attendanceLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500 dark:text-gray-400">
            <Spinner size="md" className="text-blue-600" />
            <p className="text-sm">{t('loadingData')}</p>
          </div>
        ) : attendanceError ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <EmptyState icon={XCircleIcon} title={t('somethingWentWrong')} description={attendanceError} />
            <button
              type="button"
              onClick={loadAttendance}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              {t('tryAgain')}
            </button>
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title={t('noAttendanceTitle')}
            description={t('noAttendanceDescription')}
          />
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/40">
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('dateLabel')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('status')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('checkIn')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('methodLabel')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('remarks')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {records.map((row) => (
                    <tr key={row.date} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge palette={ATTENDANCE_BADGE[row.status] || ATTENDANCE_BADGE.Absent}>{t(row.status.toLowerCase())}</Badge>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {row.checkInTime ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                            <ClockIcon className="h-4 w-4 text-gray-400" />
                            {row.checkInTime}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500">{EMPTY_DASH}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300">{row.method || EMPTY_DASH}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">
                        {row.leaveReason || row.remarks || EMPTY_DASH}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {records.map((row) => (
                <div
                  key={row.date}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{formatDate(row.date)}</p>
                    <Badge palette={ATTENDANCE_BADGE[row.status] || ATTENDANCE_BADGE.Absent}>{t(row.status.toLowerCase())}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {t('checkIn')}: {row.checkInTime || EMPTY_DASH}
                    </span>
                    <span>{row.method || EMPTY_DASH}</span>
                  </div>
                  {(row.leaveReason || row.remarks) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{row.leaveReason || row.remarks}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardSection>

      {/* ── Leave Request ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submit form */}
        <CardSection title={t('myLeaveRequests')} className="lg:col-span-1">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{t('leaveRequestSubtitle')}</p>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="leaveFromDate" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                {t('fromDate')}
              </label>
              <input
                id="leaveFromDate"
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="leaveToDate" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                {t('toDate')}
              </label>
              <input
                id="leaveToDate"
                type="date"
                value={form.toDate}
                onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="leaveReason" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                {t('reason')}
              </label>
              <textarea
                id="leaveReason"
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={t('reasonPlaceholder')}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {formError && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <XCircleIcon className="h-4 w-4 shrink-0" />
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  {t('submittingLeaveRequest')}
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {t('submitLeaveRequest')}
                </>
              )}
            </button>
          </form>
        </CardSection>

        {/* Submitted requests */}
        <CardSection title={`${t('myLeaveRequests')} (${leaves.count})`} className="lg:col-span-2">
          {leavesLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500 dark:text-gray-400">
              <Spinner size="md" className="text-blue-600" />
              <p className="text-sm">{t('loadingData')}</p>
            </div>
          ) : leavesError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <EmptyState icon={XCircleIcon} title={t('somethingWentWrong')} description={leavesError} />
              <button
                type="button"
                onClick={loadLeaves}
                className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                {t('tryAgain')}
              </button>
            </div>
          ) : leaves.leaves.length === 0 ? (
            <EmptyState
              icon={ClipboardDocumentListIcon}
              title={t('noLeaveRequestsTitle')}
              description={t('noLeaveRequestsDescription')}
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/40">
                      <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {t('leaveDates')}
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {t('reason')}
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {t('status')}
                      </th>
                      <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {t('requestedOn')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {leaves.leaves.map((leave) => (
                      <tr key={leave.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-100">
                          {formatDate(leave.fromDate)} — {formatDate(leave.toDate)}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300 break-words min-w-0">{leave.reason}</td>
                        <td className="px-5 py-3.5">
                          <Badge palette={LEAVE_BADGE[leave.status] || LEAVE_BADGE.Pending}>{t(leave.status.toLowerCase())}</Badge>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatCreatedOn(leave.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked cards */}
              <div className="md:hidden space-y-3">
                {leaves.leaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {formatDate(leave.fromDate)} — {formatDate(leave.toDate)}
                      </p>
                      <Badge palette={LEAVE_BADGE[leave.status] || LEAVE_BADGE.Pending}>{t(leave.status.toLowerCase())}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{leave.reason}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardSection>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, dot }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
    <div className="flex items-center gap-2 mb-2">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">{label}</p>
    </div>
    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
  </div>
);

export default StudentAttendance;