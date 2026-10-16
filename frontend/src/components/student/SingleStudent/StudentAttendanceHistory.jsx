import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import StatCard from '../../common/StatCard/StatCard';
import Table from '../../common/Table/Table';
import Spinner from '../../common/Spinner/Spinner';
import DateInput from '../../common/DateInput/DateInput';
import SelectInput from '../../common/SelectInput/SelectInput';
import Input from '../../common/Input/Input';
import { useAuth } from '../../../contexts/AuthContext';
import { hasReceptionistActionAccess } from '../../../constants/receptionistPermissions';
import studentAttendanceService from '../../../services/studentAttendance/studentAttendance.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import {
  REPORT_MODES,
  MONTH_NAMES,
  buildStudentAttendancePayload,
  findAttendanceForDate,
  resolveReportRange,
  validateReportRange,
  filterRecordsByRange,
  buildReportPeriodLabel,
  summarizeStatuses,
  getReportYearOptions,
  getMonthRange,
} from '../../../utils/singleStudentActions';

const STATUS_BADGE = {
  Present: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Absent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  Late: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Leave: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
};

const STATUS_OPTIONS = ['Present', 'Absent', 'Late', 'Leave'];

const todayISO = () => new Date().toLocaleDateString('en-CA');

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-CA');
};

const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]
));

// Per-student attendance for the Single Student Management workspace.
//
// Viewing reuses the existing, permission-guarded
// `GET /student-attendance/student/:studentId` endpoint and the marking form
// reuses the very same `POST /student-attendance` workflow the Attendance
// module uses - this page adds no parallel business rules. The student, class
// and academic year are pre-filled from the selected student, the backend still
// re-validates membership, active status, weekends/holidays/events and the
// before/after school time rules, and every status transition (including
// "Present" -> "Late") is decided there, never here.
const StudentAttendanceHistory = () => {
  const { student } = useOutletContext();
  const { user } = useAuth();
  const { schoolInfo } = useSchoolConfig();

  const canView = hasReceptionistActionAccess(user, 'attendance-management', 'student-attendance-view');
  const canMark = hasReceptionistActionAccess(user, 'attendance-management', 'student-attendance-mark');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Marking form. Nothing is written on open: the user must pick a date, a
  // status and explicitly press Save.
  const [markDate, setMarkDate] = useState(todayISO());
  const [markStatus, setMarkStatus] = useState('Present');
  const [markRemarks, setMarkRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Report period. It only selects *which* of the already-loaded records the
  // report shows - it never touches the marking form or writes anything. It
  // defaults to the current month, as required, and can be switched to a custom
  // inclusive date range.
  const now = new Date();
  const [reportMode, setReportMode] = useState(REPORT_MODES.MONTH);
  const [reportMonth, setReportMonth] = useState(String(now.getMonth()));
  const [reportYear, setReportYear] = useState(String(now.getFullYear()));
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');

  useEffect(() => {
    if (!student?._id || !canView) return undefined;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await studentAttendanceService.getAttendanceByStudent(student._id, {
          academicYear: student.academicYear,
        });
        if (cancelled) return;
        const list = response?.data?.records;
        setRecords(Array.isArray(list) ? list : []);
      } catch (err) {
        if (cancelled) return;
        setRecords([]);
        setError(err?.response?.data?.message || 'Failed to load attendance history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [student?._id, student?.academicYear, canView, reloadKey]);

  // The report period in effect. An invalid custom range resolves to no records
  // (never a silent fallback to "everything"), with an inline explanation.
  const reportRange = useMemo(
    () => resolveReportRange(reportMode, {
      year: reportYear,
      monthIndex: Number(reportMonth),
      from: reportFrom,
      to: reportTo,
    }),
    [reportMode, reportYear, reportMonth, reportFrom, reportTo],
  );

  const rangeError = reportMode === REPORT_MODES.CUSTOM
    ? validateReportRange(reportFrom, reportTo)
    : '';

  // The records the report (table, totals, print, PDF) actually shows. This is
  // derived from the same raw records the marking form uses, so marking stays
  // completely independent of the report filter.
  const reportRecords = useMemo(
    () => (rangeError ? [] : filterRecordsByRange(records, reportRange)),
    [records, reportRange, rangeError],
  );

  const stats = useMemo(() => summarizeStatuses(reportRecords), [reportRecords]);

  const periodLabel = buildReportPeriodLabel(reportMode, {
    year: reportYear,
    monthIndex: Number(reportMonth),
    from: reportFrom,
    to: reportTo,
  });

  const yearOptions = useMemo(
    () => getReportYearOptions(records, {
      academicYear: student?.academicYear,
      currentYear: String(new Date().getFullYear()),
    }),
    [records, student?.academicYear],
  );

  const selectReportMode = (mode) => {
    setReportMode(mode);
    if (mode === REPORT_MODES.CUSTOM && (!reportFrom || !reportTo)) {
      // Seed the custom range from the current month so the picker opens on a
      // valid, non-empty period.
      const range = getMonthRange(Number(reportYear), Number(reportMonth));
      setReportFrom(range?.from || todayISO());
      setReportTo(todayISO());
    }
  };

  // The record (if any) already stored for the date the user has chosen. Shown
  // so the same student/date is never silently recorded twice; saving simply
  // updates it, exactly like the Attendance module.
  const existingForDate = useMemo(
    () => findAttendanceForDate(records, markDate),
    [records, markDate],
  );

  const handleMarkAttendance = async () => {
    if (submitting) return;

    const payload = buildStudentAttendancePayload(student, {
      date: markDate,
      status: markStatus,
      remarks: markRemarks,
    });
    if (!payload) return;

    setSubmitting(true);
    try {
      const response = await studentAttendanceService.saveAttendance(payload);

      const savedStatus = response?.data?.attendanceMap?.[student._id]?.status || markStatus;
      toast.success(`Attendance saved as ${savedStatus} for ${formatDate(markDate)}`);
      setMarkRemarks('');
      setReloadKey((key) => key + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSubmitting(false);
    }
  };

  // Print-friendly attendance report for this one student, built from the
  // records the report period currently selects (so print/PDF match the
  // on-screen filtered report) and opened in its own window.
  const buildReportBodyHtml = () => {
    const rows = reportRecords
      .map((record) => `
        <tr>
          <td>${escapeHtml(formatDate(record.date))}</td>
          <td>${escapeHtml(record.status || '—')}</td>
          <td>${escapeHtml(formatTime(record.checkIn))}</td>
          <td>${escapeHtml(record.method || '—')}</td>
          <td>${escapeHtml(record.class || student?.class || '—')}</td>
        </tr>`)
      .join('');

    return `
      <h1>${escapeHtml(schoolInfo?.name || 'School')}</h1>
      <p class="muted">Student Attendance Report</p>
      <div class="grid">
        <div><span class="label">Student Name:</span> ${escapeHtml(student?.fullName)}</div>
        <div><span class="label">Student ID:</span> ${escapeHtml(student?.studentId)}</div>
        <div><span class="label">Class:</span> ${escapeHtml(student?.class)}</div>
        <div><span class="label">Academic Year:</span> ${escapeHtml(student?.academicYear)}</div>
        <div><span class="label">Report Period:</span> ${escapeHtml(periodLabel || '—')}</div>
        <div><span class="label">Records:</span> ${reportRecords.length}</div>
      </div>
      <div class="stats">
        <div class="stat"><div class="n">${stats.Present}</div><div class="muted">Present</div></div>
        <div class="stat"><div class="n">${stats.Absent}</div><div class="muted">Absent</div></div>
        <div class="stat"><div class="n">${stats.Late}</div><div class="muted">Late</div></div>
        <div class="stat"><div class="n">${stats.Leave}</div><div class="muted">Leave</div></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Status</th><th>Check In</th><th>Method</th><th>Class</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="muted">No attendance records in this period.</td></tr>'}</tbody>
      </table>`;
  };

  const REPORT_CSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 2px; }
    .muted { color: #6b7280; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 12px; margin-top: 14px; }
    .grid .label { color: #6b7280; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 16px; }
    .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; }
    .stat .n { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #374151; }
    @media print { body { padding: 0; } }`;

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked. Allow pop-ups to print the report.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Attendance Report - ${escapeHtml(student?.fullName || '')}</title>
        <style>${REPORT_CSS}</style>
      </head>
      <body>${buildReportBodyHtml()}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  // Downloads the same filtered report as a PDF, reusing the project's existing
  // html2pdf dependency (no new reporting system).
  const handleDownloadPdf = async () => {
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const el = document.createElement('div');
      el.innerHTML = `<style>${REPORT_CSS}</style>${buildReportBodyHtml()}`;
      document.body.appendChild(el);
      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: `Attendance-${student?.studentId || 'student'}-${periodLabel || 'report'}.pdf`.replace(/\s+/g, '-'),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(el).save();
      document.body.removeChild(el);
    } catch {
      toast.error('Could not generate the PDF. Use Print Report instead.');
    }
  };

  if (!canView) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <CalendarDaysIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Attendance access required
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          You do not have permission to view student attendance. Ask an administrator to grant the
          Attendance Management module.
        </p>
      </div>
    );
  }

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status' },
    { key: 'checkIn', label: 'Check In' },
    { key: 'method', label: 'Method' },
    { key: 'class', label: 'Class' },
  ];

  const renderRow = (record) => (
    <>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
        {formatDate(record.date)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            STATUS_BADGE[record.status] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'
          }`}
        >
          {record.status || '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatTime(record.checkIn)}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{record.method || '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{record.class || student?.class || '—'}</td>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Attendance history for {student?.fullName} ({student?.studentId}) · {student?.class}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={handlePrintReport}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
          >
            <PrinterIcon className="h-4 w-4" />
            Print Report
          </button>
          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Report period. Selecting a period only re-filters the records already
          loaded for this student; it never writes attendance. */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDaysIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
            Report Period
          </h3>
        </div>

        <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-0.5 mb-4">
          <button
            type="button"
            onClick={() => selectReportMode(REPORT_MODES.MONTH)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              reportMode === REPORT_MODES.MONTH
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => selectReportMode(REPORT_MODES.CUSTOM)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              reportMode === REPORT_MODES.CUSTOM
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Custom Range
          </button>
        </div>

        {reportMode === REPORT_MODES.MONTH ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label htmlFor="reportMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Month
              </label>
              <select
                id="reportMonth"
                name="reportMonth"
                value={reportMonth}
                onChange={(e) => setReportMonth(e.target.value)}
                className="appearance-none w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={String(index)}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="reportYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Year
              </label>
              <select
                id="reportYear"
                name="reportYear"
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value)}
                className="appearance-none w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <DateInput
              label="Start Date"
              name="reportFrom"
              value={reportFrom}
              onChange={(e) => setReportFrom(e.target.value)}
            />
            <DateInput
              label="End Date"
              name="reportTo"
              value={reportTo}
              onChange={(e) => setReportTo(e.target.value)}
            />
          </div>
        )}

        {rangeError ? (
          <p className="text-xs text-red-600 dark:text-red-400 mt-3">{rangeError}</p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Showing <span className="font-semibold text-gray-700 dark:text-gray-200">{reportRecords.length}</span>
            {' '}record{reportRecords.length === 1 ? '' : 's'}
            {periodLabel ? <> · <span className="font-medium">{periodLabel}</span></> : null}
          </p>
        )}
      </div>

      {canMark && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDaysIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Mark Attendance
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <DateInput
              label="Date"
              name="attendanceDate"
              value={markDate}
              onChange={(e) => setMarkDate(e.target.value)}
              max={todayISO()}
              required
            />
            <SelectInput
              label="Status"
              name="attendanceStatus"
              value={markStatus}
              onChange={(e) => setMarkStatus(e.target.value)}
              options={STATUS_OPTIONS}
              required
            />
            <Input
              label="Remarks (optional)"
              name="attendanceRemarks"
              value={markRemarks}
              onChange={(e) => setMarkRemarks(e.target.value)}
              placeholder="Optional note"
            />
          </div>

          {existingForDate && (
            <p className="text-xs text-amber-600 dark:text-amber-500 -mt-1 mb-3">
              Already recorded as <span className="font-semibold">{existingForDate.status}</span> on{' '}
              {formatDate(existingForDate.date)}. Saving updates the existing record.
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAttendance}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Spinner size="sm" className="text-white" />}
              {existingForDate ? 'Update Attendance' : 'Save Attendance'}
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Rules such as weekends, holidays, events and the school attendance window are enforced
              by the server.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={CheckCircleIcon} label="Present" value={stats.Present} color="green" />
        <StatCard icon={XCircleIcon} label="Absent" value={stats.Absent} color="red" />
        <StatCard icon={ClockIcon} label="Late" value={stats.Late} color="blue" />
        <StatCard icon={CalendarDaysIcon} label="Leave" value={stats.Leave} color="yellow" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" className="text-blue-600" />
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <ArrowPathIcon className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Could not load attendance history
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{error}</p>
          <button
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : reportRecords.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <CalendarDaysIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {records.length === 0 ? 'No attendance records yet' : 'No attendance records in this period'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {records.length === 0
              ? 'Daily attendance for this student will appear here once it is recorded.'
              : 'Choose a different month or date range to see this student\'s attendance.'}
          </p>
        </div>
      ) : (
        <Table columns={columns} data={reportRecords} renderRow={renderRow} />
      )}
    </div>
  );
};

export default StudentAttendanceHistory;
