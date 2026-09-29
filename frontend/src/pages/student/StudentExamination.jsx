import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AcademicCapIcon,
  CalendarDaysIcon,
  ClockIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  XCircleIcon,
  UserCircleIcon,
  XMarkIcon,
  IdentificationIcon,
  DocumentTextIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import Spinner from '../../components/common/Spinner/Spinner';
import studentExamService from '../../services/student/studentExam.service';
import { useTranslation, useFormatTime } from '../../hooks/useLocalization';
import useSchoolBranding from '../../hooks/useSchoolBranding';
import { getImageUrl } from '../../utils/imageUrl';

const EMPTY_DASH = '—';

// ─── Date/time helpers ─────────────────────────────────────────────────────
// 'YYYY-MM-DD ...' string → Date parsed as LOCAL time (avoids UTC day shifts).
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

const LOCALE_BY_LANG = { English: 'en-GB', Urdu: 'ur-PK', Arabic: 'ar-EG', French: 'fr-FR' };

const getDayName = (value, language) => {
  const d = parseDateOnly(value);
  if (!d) return EMPTY_DASH;
  return d.toLocaleDateString(LOCALE_BY_LANG[language] || 'en-GB', { weekday: 'long' });
};

/** 'HH:MM' (24h) → localized display respecting the configured time format. */
const scheduleTime = (hhmm, formatTimePref) => {
  if (!hhmm) return EMPTY_DASH;
  const parts = String(hhmm).split(':').map(Number);
  if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return String(hhmm);
  return formatTimePref(new Date(2000, 0, 1, parts[0], parts[1], 0));
};

// ─── Palettes / small UI helpers ───────────────────────────────────────────
const RESULT_BADGE = {
  Passed: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  Failed: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  Pending: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
};

const Badge = ({ palette, children }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${palette}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {children}
  </span>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-10">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <Icon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

const SectionLoader = ({ text }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500 dark:text-gray-400">
    <Spinner size="md" className="text-blue-600" />
    <p className="text-sm">{text}</p>
  </div>
);

const SectionError = ({ message, onRetry, retryLabel }) => (
  <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
      <XCircleIcon className="h-7 w-7 text-red-400" />
    </div>
    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
    >
      {retryLabel}
    </button>
  </div>
);

// ─── Printable document styles (spe-* prefixed to stay isolated) ───────────
const SPE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; }
  .spe-doc { max-width: 820px; margin: 16px auto; padding: 10px; }
  .spe-head { text-align: center; padding-bottom: 10px; border-bottom: 2px solid #1e40af; margin-bottom: 16px; }
  .spe-head .school { font-size: 20px; font-weight: 800; color: #1e40af; letter-spacing: 0.5px; }
  .spe-head .school-sub { font-size: 12px; color: #374151; margin-top: 4px; }
  .spe-head .doc-title { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #1e40af; margin-top: 8px; }
  .spe-meta { display: flex; flex-wrap: wrap; gap: 6px 28px; font-size: 12px; color: #374151; margin-bottom: 14px; }
  .spe-meta .k { color: #6b7280; }
  .spe-meta .v { font-weight: 600; color: #111827; }
  .spe-status { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
  .spe-status.Passed { background: #d1fae5; color: #065f46; }
  .spe-status.Failed { background: #fee2e2; color: #991b1b; }
  .spe-status.Pending { background: #fef3c7; color: #92400e; }
  .spe-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .spe-table th, .spe-table td { border: 1px solid #d1d5db; padding: 7px 10px; text-align: left; }
  .spe-table th { background: #eff6ff; font-size: 11px; text-transform: uppercase; color: #1e3a8a; }
  .spe-table tr.spe-total td { font-weight: 700; background: #f9fafb; }
  .spe-sec-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1e40af; margin: 16px 0 8px; }
  .spe-admit { display: flex; gap: 18px; margin-bottom: 6px; }
  .spe-photo { width: 96px; height: 118px; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f3f4f6; flex-shrink: 0; }
  .spe-photo img { width: 100%; height: 100%; object-fit: cover; }
  .spe-photo .fallback { font-size: 26px; color: #6b7280; }
  .spe-student { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 26px; align-content: start; }
  .spe-student .k { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.4px; }
  .spe-student .v { font-size: 13px; font-weight: 600; margin-top: 1px; }
  .spe-footer { display: flex; justify-content: space-between; gap: 24px; margin-top: 40px; }
  .spe-footer .sig { text-align: center; font-size: 12px; color: #374151; width: 30%; }
  .spe-footer .sig .line { border-top: 1px solid #374151; padding-top: 6px; }
  .spe-note { text-align: center; font-size: 10.5px; color: #9ca3af; margin-top: 14px; }
  @media print { .spe-doc { margin: 0 auto; } }
`;

const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const enWeekday = (value) => {
  const d = parseDateOnly(value);
  if (!d) return EMPTY_DASH;
  return EN_WEEKDAYS[d.getDay()] || EMPTY_DASH;
};

/** Full standalone HTML document used by both the print window and PDF export. */
const buildStandaloneHtml = (title, body) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>${SPE_CSS}</style>
</head>
<body>
  ${body}
</body>
</html>`;

const schoolHeaderHtml = (school, extraTitle, subTitle) => {
  const schoolName = school?.schoolName || 'School';
  const address = [school?.schoolAddress, school?.city, school?.province].filter(Boolean).join(', ');
  return `
  <div class="spe-head">
    <div class="school">${schoolName.replace(/</g, '&lt;')}</div>
    ${address ? `<div class="school-sub">${address.replace(/</g, '&lt;')}</div>` : ''}
    <div class="doc-title">${extraTitle}</div>
    ${subTitle ? `<div class="school-sub" style="margin-top:2px;color:#6b7280;font-weight:600;">${subTitle}</div>` : ''}
  </div>`;
};

const marksheetBodyHtml = ({ result, student, academicYear, school, t }) => {
  const meta = [
    ['Student', student?.fullName || EMPTY_DASH],
    ['Student ID', student?.studentId || EMPTY_DASH],
    ['Class', student?.className || EMPTY_DASH],
    ['Academic Year', academicYear || student?.academicYear || EMPTY_DASH],
  ]
    .map(([k, v]) => `<span class="spe-meta"><span class="k">${k}: </span><span class="v">${String(v).replace(/</g, '&lt;')}</span></span>`)
    .join('');

  const rows = (result.subjectResults || [])
    .map((sr) => {
      const entered = sr.entered;
      const resultCell = !entered
        ? EMPTY_DASH
        : `<span class="spe-status ${sr.passed ? 'Passed' : 'Failed'}">${sr.passed ? 'Pass' : 'Fail'}</span>`;
      return `<tr>
        <td>${String(sr.subjectName).replace(/</g, '&lt;')}</td>
        <td style="text-align:center;">${entered ? sr.obtainedMarks : EMPTY_DASH}</td>
        <td style="text-align:center;">${sr.totalMarks ?? EMPTY_DASH}</td>
        <td style="text-align:center;">${entered ? `${sr.percentage}%` : EMPTY_DASH}</td>
        <td style="text-align:center;">${entered ? sr.grade : EMPTY_DASH}</td>
        <td style="text-align:center;">${resultCell}</td>
      </tr>`;
    })
    .join('');

  const overallStatus = result.status || 'Pending';
  return `
  <div class="spe-doc">
    ${schoolHeaderHtml(school, t('marksheet'), `${result.exam?.name || ''} ${result.exam?.type || ''}`)}
    <div class="spe-meta">${meta}</div>
    <div class="spe-meta">
      <span class="spe-meta"><span class="k">Exam Term: </span><span class="v">${result.exam?.type || EMPTY_DASH}</span></span>
      <span class="spe-meta"><span class="k">Overall Result: </span><span class="spe-status ${overallStatus}">${overallStatus}</span></span>
    </div>
    <table class="spe-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th style="text-align:center;">Obtained</th>
          <th style="text-align:center;">Total</th>
          <th style="text-align:center;">Percentage</th>
          <th style="text-align:center;">Grade</th>
          <th style="text-align:center;">Result</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="spe-total">
          <td>Overall</td>
          <td style="text-align:center;">${result.obtainedMarks ?? EMPTY_DASH}</td>
          <td style="text-align:center;">${result.totalMarks ?? EMPTY_DASH}</td>
          <td style="text-align:center;">${result.percentage != null ? `${result.percentage}%` : EMPTY_DASH}</td>
          <td style="text-align:center;">${result.grade}</td>
          <td style="text-align:center;">
            <span class="spe-status ${overallStatus}">${overallStatus}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="spe-footer">
      <div class="sig"><div class="line">Class Teacher</div></div>
      <div class="sig"><div class="line">Exam Controller</div></div>
      <div class="sig"><div class="line">Principal</div></div>
    </div>
    <div class="spe-note">${t('computerGenerated')}</div>
  </div>`;
};

const admitCardBodyHtml = ({ admitCard, school, t, timeOf }) => {
  const student = admitCard.student;
  const photoUrl = student?.studentImage ? getImageUrl(student.studentImage) : null;
  const photoHtml = photoUrl
    ? `<img src="${photoUrl}" alt="" />`
    : `<span class="fallback">${String((student?.fullName || 'S').trim().charAt(0) || 'S').toUpperCase()}</span>`;
  const fmt = (v) => (typeof timeOf === 'function' ? timeOf(v) : v);

  const details = [
    [t('studentName'), student?.fullName],
    [t('fatherName'), student?.fatherName],
    [t('studentIdLabel'), student?.studentId],
    [t('class'), student?.className],
    [t('academicYear'), student?.academicYear],
    [t('examTypeLabel'), admitCard.exam?.type],
  ]
    .map(([k, v]) => {
      const val = v != null && String(v).trim() !== '' ? String(v) : EMPTY_DASH;
      return `<div class="k">${k}</div><div class="v">${val.replace(/</g, '&lt;')}</div>`;
    })
    .join('');

  const rows = (admitCard.schedules || [])
    .map(
      (s) => `<tr>
        <td>${String(s.subjectName).replace(/</g, '&lt;')}</td>
        <td>${formatDate(s.examDate)}</td>
        <td style="text-align:center;">${enWeekday(s.examDate)}</td>
        <td style="text-align:center;">${fmt(s.startTime)}</td>
        <td style="text-align:center;">${fmt(s.endTime)}</td>
        <td style="text-align:center;">${s.room || EMPTY_DASH}</td>
      </tr>`,
    )
    .join('');

  return `
  <div class="spe-doc">
    ${schoolHeaderHtml(school, t('admitCard'), `${admitCard.exam?.name || ''} ${admitCard.exam?.type || ''}`)}
    <div class="spe-admit">
      <div class="spe-photo">${photoHtml}</div>
      <div class="spe-student">${details}</div>
    </div>
    <div class="spe-sec-title">${t('dateSheet')}</div>
    <table class="spe-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Date</th>
          <th style="text-align:center;">Day</th>
          <th style="text-align:center;">Start Time</th>
          <th style="text-align:center;">End Time</th>
          <th style="text-align:center;">Room</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows : `<tr><td colspan="6" style="text-align:center;color:#6b7280;">${t('noDateSheetDescription')}</td></tr>`}
      </tbody>
    </table>
    <div class="spe-footer">
      <div class="sig"><div class="line">Student Signature</div></div>
      <div class="sig"><div class="line">Class Teacher</div></div>
      <div class="sig"><div class="line">Exam Controller</div></div>
    </div>
    <div class="spe-note">${t('computerGenerated')}</div>
  </div>`;
};

const openPrintWindow = (html) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  const runPrint = () => {
    try {
      printWindow.print();
    } catch {
      /* ignore popup/print failures */
    }
  };
  // Some browsers need the document to finish loading before printing.
  if (printWindow.document.readyState === 'complete') runPrint();
  else printWindow.onload = runPrint;
  setTimeout(runPrint, 500);
};

/**
 * Student Examination — READ-ONLY page.
 *
 * The logged-in student only ever sees THEIR OWN exams, date sheet, result and
 * admit card from the existing Admin Examination / Teacher Mark Entry data.
 * There are no class/student/teacher selectors and no create/edit/delete/mark
 * entry controls. The exam dropdown offers only Mid Term and Final Term.
 */
const StudentExamination = () => {
  const { t, language } = useTranslation();
  const formatTimePref = useFormatTime();
  const { schoolBranding } = useSchoolBranding();

  // `useTranslation` returns a fresh `t` wrapper on every render, so keep the
  // latest one in a ref, synced in an effect (refs must not be written during
  // render). The loaders below stay reference-stable so the section-fetch
  // effect does not re-run on every unrelated render.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Exams for the student's class & central academic year.
  const [examsData, setExamsData] = useState({ student: null, academicYear: '', exams: [] });
  const [examsLoading, setExamsLoading] = useState(true);
  const [examsError, setExamsError] = useState('');

  // Exam term (Mid Term / Final Term only).
  const [selectedTerm, setSelectedTerm] = useState('Mid Term');

  // Date sheet
  const [scheduleData, setScheduleData] = useState({ exams: [] });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Result / marksheet
  const [resultsData, setResultsData] = useState({ results: [] });
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');

  // Admit card
  const [admitCard, setAdmitCard] = useState(null);
  const [admitLoading, setAdmitLoading] = useState(false);
  const [admitError, setAdmitError] = useState('');
  const [admitEmpty, setAdmitEmpty] = useState(false);

  // Print / PDF export
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState(null); // 'marksheet' | 'admit'

  const loadExams = useCallback(async () => {
    setExamsLoading(true);
    setExamsError('');
    try {
      const data = await studentExamService.getExams();
      setExamsData(data);
      // Default to the first term that actually has an exam configured — but
      // only the first time data arrives. Afterwards the user's dropdown
      // choice wins (a term without an exam shows honest empty states).
      if (!initializedTermRef.current && data?.exams?.length) {
        const firstType = data.exams[0]?.type;
        if (firstType) setSelectedTerm(firstType);
        initializedTermRef.current = true;
      }
    } catch (err) {
      const message = err?.response?.data?.message || tRef.current('examLoadError');
      setExamsError(message);
      toast.error(message);
      if (import.meta.env.DEV) {
        console.error('Exams load failed', { status: err?.response?.status, detail: err?.response?.data, error: err });
      }
    } finally {
      setExamsLoading(false);
    }
  }, []);

  const loadSections = useCallback(
    async (examId) => {
      if (!examId) {
        setScheduleData({ exams: [] });
        setScheduleLoading(false);
        setScheduleError('');
        setResultsData({ results: [] });
        setResultsLoading(false);
        setResultsError('');
        setAdmitCard(null);
        setAdmitLoading(false);
        setAdmitError('');
        setAdmitEmpty(true);
        return;
      }

      setScheduleLoading(true);
      setScheduleError('');
      try {
        const data = await studentExamService.getExamSchedule({ examId });
        setScheduleData(data);
      } catch (err) {
        const message = err?.response?.data?.message || tRef.current('examScheduleLoadError');
        setScheduleError(message);
        if (import.meta.env.DEV) {
          console.error('Date sheet load failed', { status: err?.response?.status, detail: err?.response?.data, error: err });
        }
      } finally {
        setScheduleLoading(false);
      }

      setResultsLoading(true);
      setResultsError('');
      try {
        const data = await studentExamService.getResults({ examId });
        setResultsData(data);
      } catch (err) {
        const message = err?.response?.data?.message || tRef.current('resultsLoadError');
        setResultsError(message);
        if (import.meta.env.DEV) {
          console.error('Results load failed', { status: err?.response?.status, detail: err?.response?.data, error: err });
        }
      } finally {
        setResultsLoading(false);
      }

      setAdmitLoading(true);
      setAdmitError('');
      setAdmitEmpty(false);
      try {
        const data = await studentExamService.getAdmitCard({ examId });
        setAdmitCard(data.admitCard);
      } catch (err) {
        if (err?.response?.status === 404) {
          // No published schedule yet — honest empty state, not an error.
          setAdmitEmpty(true);
          setAdmitCard(null);
        } else {
          const message = err?.response?.data?.message || tRef.current('admitCardLoadError');
          setAdmitError(message);
          setAdmitCard(null);
        }
        if (import.meta.env.DEV) {
          console.error('Admit card load failed', { status: err?.response?.status, detail: err?.response?.data, error: err });
        }
      } finally {
        setAdmitLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defaults to the first term that actually has an exam the first time exam
  // data loads; afterwards the user's dropdown choice always wins.
  const initializedTermRef = useRef(false);

  const selectedExam = useMemo(
    () => examsData.exams.find((e) => e.type === selectedTerm) || null,
    [examsData.exams, selectedTerm],
  );
  const selectedExamId = selectedExam?._id || '';

  useEffect(() => {
    if (examsLoading || examsError) return;
    loadSections(selectedExamId);
  }, [selectedExamId, examsLoading, examsError, loadSections]);

  const activeResult =
    resultsData.results.find((r) => String(r.exam?._id) === String(selectedExamId)) || resultsData.results[0] || null;

  const termLabel = selectedTerm === 'Final Term' ? t('finalTerm') : t('midTerm');

  const marksheetBody = useMemo(
    () =>
      activeResult
        ? marksheetBodyHtml({
            result: activeResult,
            student: examsData.student,
            academicYear: examsData.academicYear,
            school: schoolBranding,
            t,
          })
        : '',
    [activeResult, examsData.student, examsData.academicYear, schoolBranding, t],
  );

  const admitCardBody = useMemo(
    () =>
      admitCard
        ? admitCardBodyHtml({
            admitCard,
            school: schoolBranding,
            t,
            timeOf: (hhmm) => scheduleTime(hhmm, formatTimePref),
          })
        : '',
    [admitCard, schoolBranding, t, formatTimePref],
  );

  const handlePrintMarksheet = () => {
    if (!marksheetBody) return;
    openPrintWindow(buildStandaloneHtml(`Marksheet - ${activeResult.exam?.name || 'Result'}`, marksheetBody));
  };

  const handleDownloadMarksheet = async () => {
    if (!marksheetBody) return;
    setExporting(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const el = document.createElement('div');
      el.innerHTML = buildStandaloneHtml(`Marksheet - ${activeResult.exam?.name || 'Result'}`, marksheetBody);
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '0';
      document.body.appendChild(el);
      const filename = `Marksheet-${examsData.student?.studentId || 'student'}-${(activeResult.exam?.name || 'exam').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save();
      document.body.removeChild(el);
      toast.success(t('marksheetDownloaded'));
    } catch {
      toast.error(t('pdfDownloadFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handlePrintAdmitCard = () => {
    if (!admitCardBody) return;
    openPrintWindow(buildStandaloneHtml(`AdmitCard - ${admitCard.exam?.name || 'Exam'}`, admitCardBody));
  };

  const handleDownloadAdmitCard = async () => {
    if (!admitCardBody) return;
    setExporting(true);
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const el = document.createElement('div');
      el.innerHTML = buildStandaloneHtml(`AdmitCard - ${admitCard.exam?.name || 'Exam'}`, admitCardBody);
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '0';
      document.body.appendChild(el);
      const filename = `AdmitCard-${admitCard.student?.studentId || 'student'}-${(admitCard.exam?.name || 'exam').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
      await html2pdf()
        .set({
          margin: [8, 8, 8, 8],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(el)
        .save();
      document.body.removeChild(el);
      toast.success(t('admitCardDownloaded'));
    } catch {
      toast.error(t('pdfDownloadFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleRefresh = () => {
    loadExams();
    loadSections(selectedExamId);
  };

  const termExams = examsData.exams.filter((e) => e.type === selectedTerm);
  const student = examsData.student;

  const marksheetToolbar = [
    {
      key: 'print',
      label: t('printMarksheet'),
      icon: PrinterIcon,
      onClick: handlePrintMarksheet,
    },
    {
      key: 'download',
      label: t('downloadPdf'),
      icon: ArrowDownTrayIcon,
      onClick: handleDownloadMarksheet,
      busyLabel: t('downloading'),
      busy: exporting,
    },
  ];

  const admitToolbar = [
    {
      key: 'print',
      label: t('printAdmitCard'),
      icon: PrinterIcon,
      onClick: handlePrintAdmitCard,
    },
    {
      key: 'download',
      label: t('downloadPdf'),
      icon: ArrowDownTrayIcon,
      onClick: handleDownloadAdmitCard,
      busyLabel: t('downloading'),
      busy: exporting,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{t('examination')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('examSubtitle')}</p>
      </div>

      {/* Student chips + Exam term dropdown + Refresh */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2 items-center">
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
              {t('academicYear')}: {examsData.academicYear || EMPTY_DASH}
            </span>
          </span>

          {/* Exam dropdown — Mid Term / Final Term only */}
          <label className="inline-flex items-center gap-2 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
            <span className="shrink-0">{t('examTerm')}:</span>
            <span className="relative inline-flex items-center">
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="appearance-none bg-transparent pr-5 text-xs font-semibold text-gray-800 dark:text-gray-100 focus:outline-none cursor-pointer"
                aria-label={t('examTerm')}
              >
                <option value="Mid Term">{t('midTerm')}</option>
                <option value="Final Term">{t('finalTerm')}</option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-0 h-3.5 w-3.5 text-gray-400" />
            </span>
          </label>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={examsLoading || scheduleLoading || resultsLoading || admitLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors disabled:opacity-60 sm:ml-auto"
        >
          <ArrowPathIcon className={`h-4 w-4 ${examsLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {/* ── Examinations ─────────────────────────────────────────────────── */}
      <CardSection title={`${t('examList')} — ${termLabel}`}>
        {examsLoading ? (
          <SectionLoader text={t('loadingData')} />
        ) : examsError ? (
          <SectionError message={examsError} onRetry={loadExams} retryLabel={t('tryAgain')} />
        ) : examsData.exams.length === 0 ? (
          <EmptyState icon={AcademicCapIcon} title={t('noExamsTitle')} description={t('noExamsDescription')} />
        ) : termExams.length === 0 ? (
          <EmptyState
            icon={AcademicCapIcon}
            title={t('noExamForTermTitle').replace('{term}', termLabel)}
            description={t('noExamForTermDescription').replace('{term}', termLabel)}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {termExams.map((exam) => (
              <div
                key={exam._id}
                className={`rounded-xl border p-4 space-y-3 ${
                  exam._id === selectedExamId
                    ? 'border-blue-400 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-900/10 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 break-words">{exam.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(exam.startDate)} — {formatDate(exam.endDate)}
                    </p>
                  </div>
                  <Badge palette="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
                    {exam.type === 'Final Term' ? t('finalTerm') : t('midTerm')}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {exam.totalSubjects} {t('subjectsLabel')} · {t('totalMarks')}: {exam.totalMarks}
                </p>
                {(exam.subjects || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(exam.subjects || []).map((sub) => (
                      <span
                        key={`${exam._id}-${sub.subjectCode || sub.subjectName}`}
                        className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300"
                      >
                        {sub.subjectName}
                        <span className="text-gray-400 dark:text-gray-500"> · {sub.totalMarks}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardSection>

      {/* ── Date Sheet ───────────────────────────────────────────────────── */}
      <CardSection title={`${t('dateSheet')}${selectedExam ? ` — ${selectedExam.name}` : ''}`}>
        {examsLoading ? (
          <SectionLoader text={t('loadingData')} />
        ) : examsError ? (
          <SectionError message={examsError} onRetry={loadExams} retryLabel={t('tryAgain')} />
        ) : !selectedExam ? (
          <EmptyState
            icon={CalendarDaysIcon}
            title={t('noDateSheetTitle')}
            description={t('noDateSheetForTermDescription').replace('{term}', termLabel)}
          />
        ) : scheduleLoading ? (
          <SectionLoader text={t('loadingData')} />
        ) : scheduleError ? (
          <SectionError message={scheduleError} onRetry={() => loadSections(selectedExamId)} retryLabel={t('tryAgain')} />
        ) : scheduleData.exams.length === 0 || scheduleData.exams[0]?.schedules?.length === 0 ? (
          <EmptyState icon={CalendarDaysIcon} title={t('noDateSheetTitle')} description={t('noDateSheetDescription')} />
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/40">
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('subject')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('dateLabel')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('day')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('startTime')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('endTime')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('roomNo')}
                    </th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('notes')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {scheduleData.exams[0].schedules.map((row, index) => (
                    <tr key={`${row.examDate}-${row.subjectCode || row.subjectName}-${index}`} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-800 dark:text-gray-100">
                        <span className="block">{row.subjectName}</span>
                        {row.subjectCode && (
                          <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">{row.subjectCode}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatDate(row.examDate)}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300">{getDayName(row.examDate, language)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        <span className="inline-flex items-center gap-1.5">
                          <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
                          {scheduleTime(row.startTime, formatTimePref)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{scheduleTime(row.endTime, formatTimePref)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{row.room || EMPTY_DASH}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{row.notes || EMPTY_DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {scheduleData.exams[0].schedules.map((row, index) => (
                <div key={`${row.examDate}-${row.subjectCode || row.subjectName}-${index}`} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">{row.subjectName}</p>
                      {row.subjectCode && <p className="text-[11px] text-gray-400 dark:text-gray-500">{row.subjectCode}</p>}
                    </div>
                    {row.room && (
                      <span className="shrink-0 rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                        {t('roomNo')}: {row.room}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDaysIcon className="h-3.5 w-3.5" />
                      {formatDate(row.examDate)}
                    </span>
                    <span>{getDayName(row.examDate, language)}</span>
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {scheduleTime(row.startTime, formatTimePref)} — {scheduleTime(row.endTime, formatTimePref)}
                    </span>
                  </div>
                  {row.notes && <p className="text-xs text-gray-500 dark:text-gray-400">{row.notes}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </CardSection>

      {/* ── Result / Marksheet ───────────────────────────────────────────── */}
      <CardSection title={`${t('resultsTitle')}${selectedExam ? ` — ${selectedExam.name}` : ''}`}>
        {examsLoading ? (
          <SectionLoader text={t('loadingData')} />
        ) : examsError ? (
          <SectionError message={examsError} onRetry={loadExams} retryLabel={t('tryAgain')} />
        ) : !selectedExam ? (
          <EmptyState
            icon={DocumentTextIcon}
            title={t('noResultTitle')}
            description={t('noResultForTermDescription').replace('{term}', termLabel)}
          />
        ) : resultsLoading ? (
          <SectionLoader text={t('loadingData')} />
        ) : resultsError ? (
          <SectionError message={resultsError} onRetry={() => loadSections(selectedExamId)} retryLabel={t('tryAgain')} />
        ) : !activeResult || activeResult.subjectResults.length === 0 ? (
          <EmptyState icon={DocumentTextIcon} title={t('noResultTitle')} description={t('noResultDescription')} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge palette={RESULT_BADGE[activeResult.status] || RESULT_BADGE.Pending}>
                {activeResult.status === 'Passed' ? t('passed') : activeResult.status === 'Failed' ? t('failed') : t('pending')}
              </Badge>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {activeResult.obtainedMarks ?? EMPTY_DASH} / {activeResult.totalMarks ?? EMPTY_DASH}
              </span>
              {activeResult.percentage != null && (
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{activeResult.percentage}%</span>
              )}
              {activeResult.grade && activeResult.grade !== '-' && (
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {t('gradeLabel')}: {activeResult.grade}
                </span>
              )}
              <button
                type="button"
                onClick={() => setViewMode('marksheet')}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer sm:ml-auto"
              >
                <PrinterIcon className="h-4 w-4" />
                {t('viewPrintMarksheet')}
              </button>
            </div>

            {/* Desktop / tablet table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/40">
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('subject')}</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('totalMarks')}</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('obtainedMarks')}</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('percentageLabel')}</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('gradeLabel')}</th>
                    <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('passFail')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {activeResult.subjectResults.map((sr, index) => (
                    <tr key={`${sr.subjectName}-${index}`} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-800 dark:text-gray-100">
                        <span className="block">{sr.subjectName}</span>
                        {sr.subjectCode && <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">{sr.subjectCode}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300">{sr.totalMarks ?? EMPTY_DASH}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300">{sr.entered ? sr.obtainedMarks : EMPTY_DASH}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-gray-300">{sr.entered ? `${sr.percentage}%` : EMPTY_DASH}</td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-gray-700 dark:text-gray-200">{sr.entered ? sr.grade : EMPTY_DASH}</td>
                      <td className="px-5 py-3.5">
                        {!sr.entered ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{t('notEntered')}</span>
                        ) : sr.passed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {t('pass')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            {t('fail')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-700/40">
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-gray-100">{t('overallLabel')}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-gray-100">{activeResult.totalMarks}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-gray-100">{activeResult.obtainedMarks ?? EMPTY_DASH}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-gray-100">{activeResult.percentage != null ? `${activeResult.percentage}%` : EMPTY_DASH}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-gray-100">{activeResult.grade}</td>
                    <td className="px-5 py-3.5">
                      <Badge palette={RESULT_BADGE[activeResult.status] || RESULT_BADGE.Pending}>
                        {activeResult.status === 'Passed' ? t('passed') : activeResult.status === 'Failed' ? t('failed') : t('pending')}
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {activeResult.subjectResults.map((sr, index) => (
                <div key={`${sr.subjectName}-${index}`} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">{sr.subjectName}</p>
                      {sr.subjectCode && <p className="text-[11px] text-gray-400 dark:text-gray-500">{sr.subjectCode}</p>}
                    </div>
                    {sr.entered &&
                      (sr.passed ? (
                        <span className="shrink-0 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{t('pass')}</span>
                      ) : (
                        <span className="shrink-0 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{t('fail')}</span>
                      ))}
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {t('obtainedMarks')}: <b className="text-gray-700 dark:text-gray-200">{sr.entered ? sr.obtainedMarks : EMPTY_DASH}</b>
                    </span>
                    <span>
                      {t('totalMarks')}: <b className="text-gray-700 dark:text-gray-200">{sr.totalMarks ?? EMPTY_DASH}</b>
                    </span>
                    <span>
                      {t('percentageLabel')}: <b className="text-gray-700 dark:text-gray-200">{sr.entered ? `${sr.percentage}%` : EMPTY_DASH}</b>
                    </span>
                    <span>
                      {t('gradeLabel')}: <b className="text-gray-700 dark:text-gray-200">{sr.entered ? sr.grade : EMPTY_DASH}</b>
                    </span>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 p-3.5 flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{t('overallLabel')}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    {activeResult.obtainedMarks ?? EMPTY_DASH}/{activeResult.totalMarks}
                  </span>
                  <Badge palette={RESULT_BADGE[activeResult.status] || RESULT_BADGE.Pending}>
                    {activeResult.status === 'Passed' ? t('passed') : activeResult.status === 'Failed' ? t('failed') : t('pending')}
                  </Badge>
                </span>
              </div>
            </div>
          </>
        )}
      </CardSection>

      {/* ── Admit Card ───────────────────────────────────────────────────── */}
      <CardSection title={t('admitCard')}>
        {examsLoading ? (
          <SectionLoader text={t('loadingData')} />
        ) : examsError ? (
          <SectionError message={examsError} onRetry={loadExams} retryLabel={t('tryAgain')} />
        ) : !selectedExam ? (
          <EmptyState
            icon={IdentificationIcon}
            title={t('noAdmitCardTitle')}
            description={t('noAdmitCardForTermDescription').replace('{term}', termLabel)}
          />
        ) : admitLoading ? (
          <SectionLoader text={t('loadingData')} />
        ) : admitError ? (
          <SectionError message={admitError} onRetry={() => loadSections(selectedExamId)} retryLabel={t('tryAgain')} />
        ) : admitEmpty || !admitCard ? (
          <EmptyState icon={IdentificationIcon} title={t('noAdmitCardTitle')} description={t('noAdmitCardDescription')} />
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-24 h-28 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
              {admitCard.student?.studentImage ? (
                <img
                  src={getImageUrl(admitCard.student.studentImage)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-gray-400 dark:text-gray-500">
                  {String((admitCard.student?.fullName || 'S').trim().charAt(0) || 'S').toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h4 className="text-base font-bold text-gray-900 dark:text-white break-words">{admitCard.student?.fullName}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{admitCard.exam?.name} — {admitCard.exam?.type}</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                  <UserCircleIcon className="h-3.5 w-3.5" />
                  {admitCard.student?.studentId}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                  <AcademicCapIcon className="h-3.5 w-3.5" />
                  {t('class')}: {admitCard.student?.className}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                  <CalendarDaysIcon className="h-3.5 w-3.5" />
                  {admitCard.schedules.length} {t('subjectsLabel')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('admit')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <IdentificationIcon className="h-4 w-4" />
              {t('viewAdmitCard')}
            </button>
          </div>
        )}
      </CardSection>

      {/* ── Document modals ──────────────────────────────────────────────── */}
      {viewMode === 'marksheet' && marksheetBody && (
        <DocModal
          title={t('marksheet')}
          docBody={marksheetBody}
          toolbar={marksheetToolbar}
          onClose={() => setViewMode(null)}
        />
      )}
      {viewMode === 'admit' && admitCardBody && (
        <DocModal
          title={t('admitCard')}
          docBody={admitCardBody}
          toolbar={admitToolbar}
          onClose={() => setViewMode(null)}
        />
      )}
    </div>
  );
};

const DocModal = ({ title, docBody, toolbar, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
    <div className="flex items-start justify-center min-h-full p-3 md:p-6">
      <div className="w-full max-w-3xl my-2 md:my-6">
        <div className="flex items-center justify-between gap-3 rounded-t-xl bg-white dark:bg-gray-800 border border-b-0 border-gray-200 dark:border-gray-700 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white truncate">{title}</h3>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {toolbar.map((tool) => (
              <button
                key={tool.key}
                type="button"
                onClick={tool.onClick}
                disabled={tool.busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {tool.busy ? <Spinner size="xs" className="text-blue-600" /> : <tool.icon className="h-3.5 w-3.5" />}
                {tool.busy && tool.busyLabel ? tool.busyLabel : tool.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2.5 py-1.5 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="bg-white rounded-b-xl border border-gray-200 dark:border-gray-700 shadow-2xl p-4 md:p-6 max-h-[70vh] overflow-auto">
          <style>{SPE_CSS}</style>
          <div dangerouslySetInnerHTML={{ __html: docBody }} />
        </div>
      </div>
    </div>
  </div>
);

export default StudentExamination;