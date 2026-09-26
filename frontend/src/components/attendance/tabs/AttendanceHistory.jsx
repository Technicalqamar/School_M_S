import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../../hooks/useLocalization';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import {
  CheckCircleIcon, XCircleIcon, ClockIcon, CalendarDaysIcon,
  UserGroupIcon, ArrowPathIcon,
  PrinterIcon, EyeIcon, MagnifyingGlassIcon, ChevronDownIcon, XMarkIcon, DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import SearchInput from '../../common/SearchInput/SearchInput';
import { CLASS_NAMES, ACADEMIC_YEARS, DEPARTMENTS } from '../../../utils/classNames';
import attendanceHistoryService from '../../../services/attendanceHistory/attendanceHistory.service';

const STATUS_OPTIONS = ['All', 'Present', 'Absent', 'Leave', 'Late'];
const PAGE_SIZE = 10;
const TYPE_OPTIONS = ['All', 'Student', 'Teacher'];

const STATUS_STYLES = {
  Present: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  Absent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  Leave: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  Late: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
};

function getInitials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '—';
  return timeStr;
}

/**
 * Working Hours from the real DB check-in/check-out display times
 * (format: "H:MM(:SS)? AM/PM"). Returns "--" when either is missing.
 */
function calcWorkingHours(checkInStr, checkOutStr) {
  if (!checkInStr || !checkOutStr) return '--';
  const toSeconds = (s) => {
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = m[3] ? parseInt(m[3], 10) : 0;
    if (/PM/i.test(m[4]) && h < 12) h += 12;
    if (/AM/i.test(m[4]) && h === 12) h = 0;
    return h * 3600 + min * 60 + sec;
  };
  const a = toSeconds(checkInStr);
  const b = toSeconds(checkOutStr);
  if (a === null || b === null) return '--';
  const diff = b - a;
  if (diff < 0) return '--';
  const hh = Math.floor(diff / 3600);
  const mm = Math.floor((diff % 3600) / 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
}

/* Shared professional school print layout (project convention: no print library needed). */
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .school-header { display: flex; align-items: center; gap: 16px; border-bottom: 3px double #1e40af; padding-bottom: 10px; }
  .school-logo { width: 72px; height: 72px; object-fit: contain; flex-shrink: 0; }
  .school-logo-placeholder { width: 72px; height: 72px; border-radius: 50%; background: #1e3a5f; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; letter-spacing: 1px; flex-shrink: 0; }
  .school-name { font-size: 22px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.6px; line-height: 1.2; }
  .school-subtitle { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .school-address { font-size: 11px; color: #374151; margin-top: 4px; }
  .school-contact { font-size: 10px; color: #6b7280; margin-top: 3px; }
  .school-reg { font-size: 10px; color: #6b7280; margin-top: 3px; }
  .report-title { text-align: center; font-size: 16px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 1.2px; margin: 12px 0 2px; }
  .report-meta { text-align: center; font-size: 10px; color: #4b5563; margin-top: 4px; }
  .person-info { display: flex; flex-wrap: wrap; gap: 18px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; padding: 8px 12px; margin: 8px 0 12px; font-size: 11px; }
  .person-info b { color: #1e3a5f; }
  /* Report table: the school header + column headers live inside <thead>, so the browser
     repeats them on every printed page (table-header-group is the default behaviour). */
  table.report { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.report thead { display: table-header-group; }
  table.report th, table.report td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  table.report tr.head-row th { background: #1e40af; color: #ffffff; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
  table.report tbody tr:nth-child(even) td { background: #f8fafc; }
  table.report td.head-cell { border: none; background: #ffffff; padding: 0 0 4px; }
  table.report td.summary-cell { border: none; background: #ffffff; padding: 14px 0 0; }
  .mono { font-family: 'Consolas', monospace; }
  .summary { display: flex; flex-wrap: wrap; gap: 10px; }
  .summary-box { flex: 1; min-width: 90px; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; text-align: center; }
  .summary-box .num { font-size: 17px; font-weight: 800; color: #1e3a5f; display: block; }
  .summary-box .lbl { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { display: flex; justify-content: space-between; gap: 10px; margin-top: 16px; padding-top: 6px; border-top: 1px solid #d1d5db; font-size: 9px; color: #9ca3af; }
  .card { max-width: 640px; margin: 0 auto; }
  .row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .row .label { color: #6b7280; }
  .row .value { font-weight: 600; color: #1f2937; }
  .record-title { text-align: center; font-size: 14px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 1px; margin: 6px 0 10px; }
`;

const AttendanceHistory = () => {
  const { t } = useTranslation();
  const { schoolInfo } = useSchoolConfig();
  const [allRecords, setAllRecords] = useState([]);
  const [type, setType] = useState('All');
  const [academicYear, setAcademicYear] = useState('');
  const [className, setClassName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const loadRecords = async () => {
      try {
        const records = await attendanceHistoryService.getRecords();
        if (!cancelled) setAllRecords(records);
      } catch {
        if (!cancelled) setAllRecords([]);
      }
    };
    loadRecords();
    return () => { cancelled = true; };
  }, []);

  // Records returned by the backend — already filtered server-side by type/class/dates/search/status.
  const filteredRecords = allRecords;

  const dashboardStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      totalRecords: filteredRecords.length,
      todayRecords: filteredRecords.filter((r) => r.date === today).length,
      studentRecords: filteredRecords.filter((r) => r.type === 'Student').length,
      teacherRecords: filteredRecords.filter((r) => r.type === 'Teacher').length,
    };
  }, [filteredRecords]);

  const deptOptions = useMemo(() => {
    if (type === 'Teacher') return DEPARTMENTS;
    if (type === 'All') return [...CLASS_NAMES, ...DEPARTMENTS];
    return CLASS_NAMES;
  }, [type]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  const paginatedRecords = useMemo(
    () => filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredRecords, currentPage]
  );

  useEffect(() => {
    const id = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(id);
  }, [filteredRecords]);

  const handleSearch = async () => {
    try {
      const records = await attendanceHistoryService.getRecords({
        type: type === 'All' ? undefined : type,
        academicYear: academicYear || undefined,
        className: className || undefined,
        status: status !== 'All' ? status : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        search: search || undefined,
      });
      setAllRecords(records);
    } catch {
      setAllRecords([]);
    }
  };

  const handleReset = async () => {
    setType('All');
    setAcademicYear('');
    setClassName('');
    setFromDate('');
    setToDate('');
    setStatus('All');
    setSearch('');
    try {
      const records = await attendanceHistoryService.getRecords();
      setAllRecords(records);
    } catch {
      setAllRecords([]);
    }
  };

  /* ---- Professional school print layout ---- */

  const buildSchoolHeaderHtml = () => {
    const name = schoolInfo?.name || t('schoolName');
    const initials = name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'S';
    const address = [schoolInfo?.address, [schoolInfo?.city, schoolInfo?.province].filter(Boolean).join(', '), schoolInfo?.country]
      .filter(Boolean).join(', ');
    const contact = [schoolInfo?.contact, schoolInfo?.email, schoolInfo?.website].filter(Boolean).join(' &nbsp;|&nbsp; ');
    const reg = schoolInfo?.registrationNumber ? `${t('registrationNumber')}: ${schoolInfo.registrationNumber}` : '';
    return `
      <div class="school-header">
        ${schoolInfo?.logo
          ? `<img class="school-logo" src="${schoolInfo.logo}" alt="school logo" />`
          : `<div class="school-logo-placeholder">${initials}</div>`}
        <div style="flex:1;">
          <h1 class="school-name">${name}</h1>
          ${address ? `<div class="school-address">${address}</div>` : ''}
          ${contact ? `<div class="school-contact">${contact}</div>` : ''}
          ${reg ? `<div class="school-reg">${reg}</div>` : ''}
        </div>
      </div>`;
  };

  const openPrintWindow = (title, bodyHtml) => {
    const pw = window.open('', '_blank');
    if (!pw) return false;
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>${PRINT_CSS}</style></head>
<body>${bodyHtml}</body></html>`;
    pw.document.open();
    pw.document.write(html);
    pw.document.close();
    pw.focus();
    setTimeout(() => pw.print(), 400);
    return true;
  };

  const buildRecordRowsHtml = (rec) => `
    <div class="row"><span class="label">${t('nameColumn')}</span><span class="value">${rec.name}</span></div>
    <div class="row"><span class="label">${t('idColumn')}</span><span class="value">${rec.personId}</span></div>
    <div class="row"><span class="label">${t('type')}</span><span class="value">${rec.type}</span></div>
    <div class="row"><span class="label">${t('classDept')}</span><span class="value">${rec.classOrDept}</span></div>
    <div class="row"><span class="label">${t('academicYearLabel')}</span><span class="value">${rec.academicYear}</span></div>
    <div class="row"><span class="label">${t('dateLabel')}</span><span class="value">${formatDateDisplay(rec.date)}</span></div>
    <div class="row"><span class="label">${t('checkIn')}</span><span class="value">${formatTimeDisplay(rec.checkIn)}</span></div>
    <div class="row"><span class="label">${t('checkOut')}</span><span class="value">${formatTimeDisplay(rec.checkOut)}</span></div>
    <div class="row"><span class="label">${t('workingHours')}</span><span class="value">${calcWorkingHours(rec.checkIn, rec.checkOut)}</span></div>
    <div class="row"><span class="label">${t('status')}</span><span class="value">${rec.status}</span></div>
    <div class="row"><span class="label">${t('mode')}</span><span class="value">${rec.mode || 'Manual'}</span></div>
    <div class="row"><span class="label">${t('generatedOn')}</span><span class="value">${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>`;

  const buildReportHtml = () => {
    const records = allRecords;
    const schoolName = schoolInfo?.name || t('schoolName');
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const typeLabel = type === 'All' ? `${t('students')} / ${t('teachers')}` : type === 'Student' ? t('students') : t('teachers');

    const meta = [];
    if (academicYear) meta.push(`${t('academicYearLabel')}: ${academicYear}`);
    if (className) meta.push(`${(type === 'Teacher' ? t('classDept') : t('classLabel'))}: ${className}`);
    if (fromDate) meta.push(`${t('fromDate')}: ${formatDateDisplay(fromDate)}`);
    if (toDate) meta.push(`${t('toDate')}: ${formatDateDisplay(toDate)}`);
    if (status !== 'All') meta.push(`${t('statusLabel')}: ${status}`);
    if (search) meta.push(`${t('searchNameOrId')}: ${search}`);

    // Selected person info when a single specific student/teacher was selected via search
    const first = records[0];
    const singlePerson = records.length > 0 && records.every((r) => r.personId === first.personId);
    const personInfo = singlePerson ? `
      <div class="person-info">
        <span><b>${t('type')}:</b> ${first.type}</span>
        <span><b>${t('nameColumn')}:</b> ${first.name}</span>
        <span><b>${t('idColumn')}:</b> ${first.personId}</span>
        <span><b>${t('classDept')}:</b> ${first.classOrDept}</span>
        <span><b>${t('academicYearLabel')}:</b> ${first.academicYear || '—'}</span>
      </div>` : '';

    const rows = records.length
      ? records.map((r, i) => `
        <tr>
          <td style="color:#6b7280;">${i + 1}</td>
          <td style="white-space:nowrap;">${formatDateDisplay(r.date)}</td>
          <td style="font-weight:600;">${r.name}</td>
          <td class="mono">${r.personId}</td>
          <td>${r.classOrDept}</td>
          <td class="mono">${formatTimeDisplay(r.checkIn)}</td>
          <td class="mono">${formatTimeDisplay(r.checkOut)}</td>
          <td class="mono">${calcWorkingHours(r.checkIn, r.checkOut)}</td>
          <td><b>${r.status}</b></td>
          <td>${r.mode || 'Manual'}</td>
        </tr>`).join('')
      : `<tr><td colspan="10" style="padding:24px;text-align:center;color:#9ca3af;">${t('noRecordsFound')}</td></tr>`;

    const stats = attendanceHistoryService.getStats(records);
    const summary = records.length ? `
      <tr><td class="summary-cell" colspan="10">
        <div class="summary">
          <div class="summary-box"><span class="num">${stats.total}</span><span class="lbl">${t('totalRecords')}</span></div>
          <div class="summary-box"><span class="num">${stats.present}</span><span class="lbl">${t('present')}</span></div>
          <div class="summary-box"><span class="num">${stats.absent}</span><span class="lbl">${t('absent')}</span></div>
          <div class="summary-box"><span class="num">${stats.leave}</span><span class="lbl">${t('leave')}</span></div>
          <div class="summary-box"><span class="num">${stats.late}</span><span class="lbl">${t('late')}</span></div>
        </div>
      </td></tr>` : '';

    return `
      <table class="report">
        <thead>
          <tr><td class="head-cell" colspan="10">
            ${buildSchoolHeaderHtml()}
            <div class="report-title">${t('attendanceHistoryTitle')}</div>
            <div class="report-meta">${t('type')}: ${typeLabel}${meta.length ? ` &nbsp;|&nbsp; ${meta.join(' &nbsp;|&nbsp; ')}` : ''}</div>
            ${personInfo}
          </td></tr>
          <tr class="head-row">
            <th>#</th><th>${t('dateLabel')}</th><th>${t('nameColumn')}</th><th>${t('idColumn')}</th><th>${t('classDept')}</th>
            <th>${t('checkIn')}</th><th>${t('checkOut')}</th><th>${t('workingHours')}</th><th>${t('status')}</th><th>${t('mode')}</th>
          </tr>
        </thead>
        <tbody>${rows}${summary}</tbody>
      </table>
      <div class="footer">
        <span>${schoolName} &mdash; ${t('attendanceHistoryTitle')}</span>
        <span>${t('generatedOn')} ${today}</span>
      </div>`;
  };

  const handlePrintReport = () => {
    openPrintWindow(t('attendanceHistoryTitle'), buildReportHtml());
  };

  // Prints ALL currently filtered records in a single print job, using the same
  // professional school template as the normal Print (browser paginates naturally).
  const handlePrintAll = () => {
    if (!allRecords.length) return;
    openPrintWindow(t('attendanceHistoryTitle'), buildReportHtml());
  };

  const handleExportPdf = async () => {
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const el = document.createElement('div');
      el.innerHTML = buildReportHtml();
      document.body.appendChild(el);
      await html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: `Attendance-History-${type === 'All' ? 'All' : type}-${fromDate || 'all'}-to-${toDate || 'all'}.pdf`.replace(/\s+/g, '-'),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(el).save();
      document.body.removeChild(el);
    } catch {
      // PDF generation failed silently — print fallback is still available
    }
  };

  const renderPhoto = (record) => (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs ring-1 flex-shrink-0 ${
      record.type === 'Teacher'
        ? 'bg-gradient-to-br from-purple-500 to-purple-700 ring-purple-400/50'
        : 'bg-gradient-to-br from-blue-500 to-blue-700 ring-yellow-400/50'
    }`}>
      {getInitials(record.name)}
    </div>
  );

  const renderStatusBadge = (status) => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.Present;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style}`}>
        {status === 'Present' && <CheckCircleIcon className="h-3 w-3" />}
        {status === 'Absent' && <XCircleIcon className="h-3 w-3" />}
        {status === 'Leave' && <ClockIcon className="h-3 w-3" />}
        {status === 'Late' && <CalendarDaysIcon className="h-3 w-3" />}
        {status}
      </span>
    );
  };

  const renderModeBadge = (mode) => {
    const colors = {
      Manual: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600',
      'QR Code': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
      'Hardware (Coming Soon)': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
    };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${colors[mode] || colors.Manual}`}>
        {mode}
      </span>
    );
  };

  const renderPagination = () => {
    if (filteredRecords.length === 0) return null;
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) { start = 2; end = Math.min(4, totalPages - 1); }
      if (currentPage >= totalPages - 2) { start = Math.max(2, totalPages - 3); end = totalPages - 1; }
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} &mdash; {t('page')} {currentPage} {t('of')} {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {t('previous')}
          </button>
          {pages.map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-gray-400 dark:text-gray-500">...</span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`min-w-[28px] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  currentPage === page
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('attendanceHistoryTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('attendanceHistorySubtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={UserGroupIcon} label={t('totalRecords')} value={dashboardStats.totalRecords} color="blue" />
        <StatCard icon={CalendarDaysIcon} label={t('todaysRecords')} value={dashboardStats.todayRecords} color="green" />
        <StatCard icon={UserGroupIcon} label={t('studentRecords')} value={dashboardStats.studentRecords} color="yellow" />
        <StatCard icon={UserGroupIcon} label={t('teacherRecords')} value={dashboardStats.teacherRecords} color="purple" />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('attendanceType')}</label>
            <div className="relative">
              <select value={type} onChange={(e) => { setType(e.target.value); setClassName(''); }}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                {TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o === 'All' ? t('all') : o === 'Student' ? t('students') : t('teachers')}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('academicYearLabel')}</label>
            <div className="relative">
              <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                <option value="">{t('allYears')}</option>
                {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {type === 'Teacher' ? t('classDept') : t('classLabel')}
            </label>
            <div className="relative">
              <select value={className} onChange={(e) => setClassName(e.target.value)}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                <option value="">{type === 'Teacher' ? t('allDepartments') : t('allClasses')}</option>
                {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('fromDate')}</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('toDate')}</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('statusLabel')}</label>
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'All' ? t('all') : t(s.toLowerCase())}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleSearch}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer">
            <MagnifyingGlassIcon className="h-4 w-4" />
            {t('searchButton')}
          </button>
          <button onClick={handleReset}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer">
            <ArrowPathIcon className="h-4 w-4" />
            {t('reset')}
          </button>
          <button onClick={handlePrintReport}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer">
            <PrinterIcon className="h-4 w-4" />
            {t('print')}
          </button>
          <button onClick={handlePrintAll}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer">
            <PrinterIcon className="h-4 w-4" />
            {t('printAll')}
          </button>
          <button onClick={handleExportPdf}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer">
            <DocumentArrowDownIcon className="h-4 w-4" />
            {t('exportPdf')}
          </button>
          <div className="ml-auto">
            <SearchInput placeholder={t('searchNameOrId')} value={search} onChange={setSearch} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('photo')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('nameColumn')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('idColumn')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('type')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('classDept')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('dateLabel')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('checkIn')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('checkOut')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('workingHours')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('status')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('mode')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider no-print">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <UserGroupIcon className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm">{t('noRecordsFound')}</p>
                    <p className="text-xs">{t('adjustFilters')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record) => (
                <tr key={record.id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-3 py-3">{renderPhoto(record)}</td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">{record.name}</td>
                  <td className="px-3 py-3 text-xs font-mono font-medium text-gray-700 dark:text-gray-300">{record.personId}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                      record.type === 'Teacher'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                    }`}>
                      {record.type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{record.classOrDept}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateDisplay(record.date)}</td>
                  <td className="px-3 py-3 text-xs font-mono text-gray-600 dark:text-gray-400">{formatTimeDisplay(record.checkIn)}</td>
                  <td className="px-3 py-3 text-xs font-mono text-gray-600 dark:text-gray-400">{formatTimeDisplay(record.checkOut)}</td>
                  <td className="px-3 py-3 text-xs font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">{calcWorkingHours(record.checkIn, record.checkOut)}</td>
                  <td className="px-3 py-3">{renderStatusBadge(record.status)}</td>
                  <td className="px-3 py-3">{renderModeBadge(record.mode)}</td>
                  <td className="px-3 py-3 no-print">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedRecord(record)}
                        className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer" title={t('viewDetails')}>
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => {
                        openPrintWindow(t('attendanceRecord'), `
                          <div class="card">
                            ${buildSchoolHeaderHtml()}
                            <h2 class="record-title">${t('attendanceRecord')}</h2>
                            ${buildRecordRowsHtml(record)}
                          </div>
                        `);
                      }} className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer" title={t('printRecord')}>
                        <PrinterIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {renderPagination()}
      </div>

      {/* Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRecord(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('attendanceRecordDetails')}</h2>
              <button onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ring-2 ${
                  selectedRecord.type === 'Teacher'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700 ring-purple-400/50'
                    : 'bg-gradient-to-br from-blue-500 to-blue-700 ring-yellow-400/50'
                }`}>
                  {getInitials(selectedRecord.name)}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{selectedRecord.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedRecord.personId}</p>
                </div>
                <div className="ml-auto">
                  {renderStatusBadge(selectedRecord.status)}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  [t('type'), selectedRecord.type],
                  [t('classDept'), selectedRecord.classOrDept],
                  [t('academicYearLabel'), selectedRecord.academicYear],
                  [t('dateLabel'), formatDateDisplay(selectedRecord.date)],
                  [t('checkInTime'), formatTimeDisplay(selectedRecord.checkIn)],
                  [t('attendanceMode'), selectedRecord.mode],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer">
                  {t('close')}
                </button>
                <button
                  onClick={() => {
                    openPrintWindow(t('attendanceRecord'), `
                      <div class="card">
                        ${buildSchoolHeaderHtml()}
                        <h2 class="record-title">${t('attendanceRecord')}</h2>
                        ${buildRecordRowsHtml(selectedRecord)}
                      </div>
                    `);
                  }}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5">
                  <PrinterIcon className="h-3.5 w-3.5" /> {t('printRecord')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;