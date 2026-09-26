import { useState, useMemo, useCallback, useRef } from 'react';
import {
  CurrencyDollarIcon, ArrowTrendingUpIcon, ClockIcon,
  UserGroupIcon, MagnifyingGlassIcon, FunnelIcon,
  ArrowPathIcon, DocumentChartBarIcon, CheckCircleIcon,
  ExclamationCircleIcon, PrinterIcon, ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import CardSection from '../../common/CardSection/CardSection';
import SelectInput from '../../common/SelectInput/SelectInput';
import DateInput from '../../common/DateInput/DateInput';
import Button from '../../common/Button/Button';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import feeService from '../../../services/fee/fee.service.js';

const formatCurrency = (val) => `Rs. ${Number(val).toLocaleString()}`;

const FEE_TYPES = ['All Fees', 'Monthly Fee', 'Admission Fee', 'Examination Fee'];

const CLASS_OPTIONS = [
  'Montessori', 'Nursery', 'KG1', 'KG2',
  '1', '2', '3', '4', '5',
  '6', '7', '8', '9', '10',
];

const MONTHS_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const Reports = () => {
  const { schoolInfo } = useSchoolConfig();
  const [scope, setScope] = useState('Overall');
  const [academicYear, setAcademicYear] = useState('');
  const [feeType, setFeeType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [generatedFilters, setGeneratedFilters] = useState(null);

  const currentYear = schoolInfo?.academicYear?.currentYear || String(new Date().getFullYear());

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchTimerRef = useRef(null);

  const effectiveYear = reportData?.academicYear || generatedFilters?.academicYear || currentYear;

  const studentReport = useMemo(() => (reportData && scope === 'Student' ? reportData : null), [reportData, scope]);

  const classReport = useMemo(() => (reportData && scope === 'Class' ? reportData : null), [reportData, scope]);

  const overallReport = useMemo(() => (reportData && scope === 'Overall' ? reportData : null), [reportData, scope]);

  const summary = useMemo(() => {
    if (!reportData) return null;

    return {
      totalExpected: reportData.totalExpected || 0,
      totalCollected: reportData.totalCollected ?? reportData.totalPaid ?? 0,
      totalDue: reportData.totalDue || 0,
      paidStudents: reportData.paidStudents || 0,
      pendingStudents: reportData.pendingStudents || 0,
      totalTransactions: reportData.totalTransactions || 0,
    };
  }, [reportData]);

  const handleScopeChange = (e) => {
    const v = e.target.value;
    setScope(v);
    setSelectedClass('');
    setSelectedStudent(null);
    setStudentQuery('');
    setSearchResults([]);
    setSearchError('');
    setError('');
    setGeneratedFilters(null);
    setReportData(null);
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setError('');
    setGeneratedFilters(null);
    setReportData(null);
  };

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setStudentQuery('');
    setSearchResults([]);
    setSearchError('');
    setError('');
    setGeneratedFilters(null);
    setReportData(null);
  };

  const handleStudentQueryChange = (e) => {
    const query = e.target.value;
    setStudentQuery(query);
    setError('');
    setGeneratedFilters(null);
    setReportData(null);

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError('');
      return;
    }

    setSearchLoading(true);

    searchTimerRef.current = setTimeout(async () => {
      try {
        const response = await feeService.searchFeeReportStudents(query.trim());
        setSearchResults(response?.data?.students || []);
        setSearchError('');
      } catch (searchErr) {
        setSearchError(searchErr?.response?.data?.message || 'Student search failed');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleReset = () => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    setScope('Overall');
    setAcademicYear('');
    setFeeType('');
    setDateFrom('');
    setDateTo('');
    setSelectedClass('');
    setSelectedStudent(null);
    setStudentQuery('');
    setSearchResults([]);
    setSearchError('');
    setError('');
    setLoading(false);
    setGeneratedFilters(null);
    setReportData(null);
  };

  const handleGenerate = async () => {
    if (scope === 'Student' && !selectedStudent) {
      setError('Please search and select a student before generating the report.');
      return;
    }

    if (scope === 'Class' && !selectedClass) {
      setError('Please select a class before generating the report.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = {
        scope,
        feeType: feeType || 'All Fees',
        ...(academicYear ? { academicYear } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(scope === 'Class' && selectedClass ? { className: selectedClass } : {}),
        ...(scope === 'Student' && selectedStudent ? { studentId: selectedStudent._id } : {}),
      };

      const response = await feeService.generateReport(params);
      const report = response?.data?.report;

      if (!report) {
        throw new Error('No report data returned from the server');
      }

      setGeneratedFilters({
        scope, academicYear, feeType: feeType || 'All Fees', dateFrom, dateTo, selectedClass, selectedStudent,
      });
      setReportData(report);
    } catch (generateError) {
      setError(generateError?.response?.data?.message || generateError?.message || 'Failed to generate report. Please try again.');
      setReportData(null);
      setGeneratedFilters(null);
    } finally {
      setLoading(false);
    }
  };

  const getReportData = useCallback(() => reportData, [reportData]);

  const buildReportHtml = useCallback(() => {
    const reportData = getReportData();
    if (!reportData) return '';
    const sName = schoolInfo?.name || 'School';
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const year = reportData?.academicYear || generatedFilters?.academicYear || currentYear;
    const fType = reportData?.feeType || generatedFilters?.feeType || 'All Fees';
    const dateRange = (generatedFilters?.dateFrom || generatedFilters?.dateTo)
      ? `${generatedFilters?.dateFrom || 'Start'} to ${generatedFilters?.dateTo || 'End'}`
      : 'All Dates';

    const filterTags = [
      `Academic Year: ${year}`,
      `Fee Type: ${fType}`,
      `Date Range: ${dateRange}`,
      generatedFilters?.scope === 'Class' && generatedFilters?.selectedClass ? `Class: ${generatedFilters.selectedClass}` : '',
      generatedFilters?.scope === 'Student' && selectedStudent ? `Student: ${selectedStudent.name} (${selectedStudent.id})` : '',
    ].filter(Boolean).join(' &nbsp;|&nbsp; ');

    const css = `
      @page { size: A4 portrait; margin: 12mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #1f2937; background: #fff; font-size: 11px; }
      .rpt-hdr { background: linear-gradient(135deg, #1e3a5f, #1e40af); padding: 18px 24px; border-radius: 6px 6px 0 0; color: #fff; }
      .rpt-hdr h1 { font-size: 18px; font-weight: 700; letter-spacing: 0.3px; }
      .rpt-hdr p { font-size: 11px; color: rgba(255,255,255,0.75); margin-top: 2px; }
      .rpt-hdr .date { text-align: right; }
      .rpt-hdr .date p { font-size: 10px; }
      .rpt-hdr .date p:last-child { color: #fff; font-weight: 600; font-size: 11px; }
      .rpt-body { padding: 16px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; }
      .filters { text-align: center; font-size: 10px; color: #6b7280; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; }
      .sec-title { font-size: 13px; font-weight: 700; color: #1e40af; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1e40af; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
      .info-card { background: #f3f4f6; padding: 8px 10px; border-radius: 4px; }
      .info-card .lbl { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
      .info-card .val { font-size: 11px; font-weight: 700; color: #111827; margin-top: 2px; }
      .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; text-align: center; }
      .summary-card .lbl { font-size: 9px; color: #6b7280; text-transform: uppercase; font-weight: 600; }
      .summary-card .val { font-size: 14px; font-weight: 700; color: #111827; margin-top: 2px; }
      .summary-card .val.green { color: #16a34a; }
      .summary-card .val.red { color: #dc2626; }
      .summary-card .val.blue { color: #2563eb; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
      thead th { background: #1e40af; color: #fff; padding: 7px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
      tbody td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
      tbody tr:nth-child(even) { background: #f9fafb; }
      .paid { color: #16a34a; font-weight: 600; }
      .due { color: #dc2626; font-weight: 600; }
      .status-paid { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
      .status-partial { background: #fef9c3; color: #854d0e; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
      .status-due { background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
      .badge-monthly { background: #dbeafe; color: #1e40af; }
      .badge-admission { background: #f3e8ff; color: #7c3aed; }
      .badge-exam { background: #ffedd5; color: #c2410c; }
      .months-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
      .months-wrap .mth { background: #f3f4f6; border: 1px solid #e5e7eb; padding: 3px 10px; border-radius: 4px; font-size: 9px; font-weight: 600; }
      .months-wrap .mth.paid-m { background: #dcfce7; border-color: #bbf7d0; color: #166534; }
      .months-wrap .mth.due-m { background: #fee2e2; border-color: #fecaca; color: #991b1b; }
      .ftr { border-top: 1px solid #e5e7eb; margin-top: 16px; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8px; color: #9ca3af; }
      @media print { body { margin: 0; padding: 0; } .rpt-body { border: none; } }
    `;

    const studentInfoHtml = () => {
      const d = reportData;
      return `
        <div class="sec-title">Student Information</div>
        <div class="info-grid">
          <div class="info-card"><div class="lbl">Student ID</div><div class="val">${d.student.id}</div></div>
          <div class="info-card"><div class="lbl">Student Name</div><div class="val">${d.student.name}</div></div>
          <div class="info-card"><div class="lbl">Class</div><div class="val">${d.student.class}</div></div>
          <div class="info-card"><div class="lbl">Academic Year</div><div class="val">${year}</div></div>
        </div>
        <div class="sec-title">Fee Summary</div>
        <div class="summary-grid">
          <div class="summary-card"><div class="lbl">Total Expected</div><div class="val blue">${formatCurrency(d.totalExpected)}</div></div>
          <div class="summary-card"><div class="lbl">Total Paid</div><div class="val green">${formatCurrency(d.totalPaid)}</div></div>
          <div class="summary-card"><div class="lbl">Total Due</div><div class="val red">${formatCurrency(d.totalDue)}</div></div>
          <div class="summary-card"><div class="lbl">Total Discount</div><div class="val">${formatCurrency(d.totalDiscount)}</div></div>
          <div class="summary-card"><div class="lbl">Late Fine</div><div class="val">${formatCurrency(d.totalFine)}</div></div>
          <div class="summary-card"><div class="lbl">Transactions</div><div class="val blue">${d.totalTransactions}</div></div>
        </div>
        <div class="sec-title">Monthly Fee Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Month</th><th>Fee Type</th><th>Expected</th><th>Paid</th>
              <th>Discount</th><th>Fine</th><th>Net Paid</th><th>Due</th><th>Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${d.breakdown.length === 0
              ? '<tr><td colspan="10" style="text-align:center;color:#9ca3af;padding:16px;">No fee records found.</td></tr>'
              : d.breakdown.map((r) => {
                const badgeCls = r.feeType === 'Monthly Fee' ? 'badge-monthly' : r.feeType === 'Admission Fee' ? 'badge-admission' : 'badge-exam';
                const statusCls = r.status === 'Paid' ? 'status-paid' : r.status === 'Partially Paid' ? 'status-partial' : 'status-due';
                return `<tr>
                  <td style="font-weight:600;">${r.month}</td>
                  <td><span class="badge ${badgeCls}">${r.feeType}</span></td>
                  <td>${formatCurrency(r.expected)}</td>
                  <td class="paid">${formatCurrency(r.paid)}</td>
                  <td>${r.discount > 0 ? formatCurrency(r.discount) : '-'}</td>
                  <td>${r.fine > 0 ? formatCurrency(r.fine) : '-'}</td>
                  <td style="font-weight:600;">${formatCurrency(r.netPaid)}</td>
                  <td class="${r.due > 0 ? 'due' : ''}">${formatCurrency(r.due)}</td>
                  <td><span class="${statusCls}">${r.status}</span></td>
                  <td>${r.date || '-'}</td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
        <div style="margin-bottom:14px;">
          <div class="sec-title">Paid Months</div>
          ${d.paidMonths.length === 0 ? '<p style="font-size:10px;color:#9ca3af;">No months fully paid yet.</p>' : `<div class="months-wrap">${MONTHS_ORDER.filter((m) => d.paidMonths.includes(m)).map((m) => `<span class="mth paid-m">${m}</span>`).join('')}</div>`}
        </div>
        <div>
          <div class="sec-title">Due Months</div>
          ${d.dueMonths.length === 0 ? '<p style="font-size:10px;color:#9ca3af;">All months are paid.</p>' : `<div class="months-wrap">${MONTHS_ORDER.filter((m) => d.dueMonths.includes(m)).map((m) => `<span class="mth due-m">${m}</span>`).join('')}</div>`}
        </div>`;
    };

    const classInfoHtml = () => {
      const d = reportData;
      return `
        <div class="sec-title">Class Information</div>
        <div class="info-grid">
          <div class="info-card"><div class="lbl">Class</div><div class="val">${d.className}</div></div>
          <div class="info-card"><div class="lbl">Academic Year</div><div class="val">${year}</div></div>
          <div class="info-card"><div class="lbl">Fee Type</div><div class="val">${fType}</div></div>
          <div class="info-card"><div class="lbl">Total Students</div><div class="val">${d.totalStudents}</div></div>
        </div>
        <div class="sec-title">Class Summary</div>
        <div class="summary-grid">
          <div class="summary-card"><div class="lbl">Total Expected</div><div class="val blue">${formatCurrency(d.totalExpected)}</div></div>
          <div class="summary-card"><div class="lbl">Total Collected</div><div class="val green">${formatCurrency(d.totalCollected)}</div></div>
          <div class="summary-card"><div class="lbl">Total Due</div><div class="val red">${formatCurrency(d.totalDue)}</div></div>
          <div class="summary-card"><div class="lbl">Paid Students</div><div class="val green">${d.paidStudents}</div></div>
          <div class="summary-card"><div class="lbl">Pending Students</div><div class="val red">${d.pendingStudents}</div></div>
          <div class="summary-card"><div class="lbl">Transactions</div><div class="val blue">${d.totalTransactions}</div></div>
        </div>
        <div class="sec-title">Student Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Student ID</th><th>Name</th><th>Expected</th>
              <th>Collected</th><th>Due</th><th>Paid/Due Months</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${d.students.length === 0
              ? '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:16px;">No students found.</td></tr>'
              : d.students.map((s) => {
                const statusCls = s.status === 'Paid' ? 'status-paid' : s.status === 'Partial' ? 'status-partial' : 'status-due';
                return `<tr>
                  <td style="font-family:monospace;font-size:9px;">${s.id}</td>
                  <td style="font-weight:600;">${s.name}</td>
                  <td>${formatCurrency(s.expected)}</td>
                  <td class="paid">${formatCurrency(s.collected)}</td>
                  <td class="${s.due > 0 ? 'due' : ''}">${formatCurrency(s.due)}</td>
                  <td>${s.paidMonths}/${s.dueMonths + s.paidMonths}</td>
                  <td><span class="${statusCls}">${s.status}</span></td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>`;
    };

    const overallInfoHtml = () => {
      const d = reportData;
      return `
        <div class="sec-title">Overall Summary</div>
        <div class="summary-grid">
          <div class="summary-card"><div class="lbl">Total Students</div><div class="val blue">${d.totalStudents}</div></div>
          <div class="summary-card"><div class="lbl">Total Expected</div><div class="val blue">${formatCurrency(d.totalExpected)}</div></div>
          <div class="summary-card"><div class="lbl">Total Collected</div><div class="val green">${formatCurrency(d.totalCollected)}</div></div>
          <div class="summary-card"><div class="lbl">Total Due</div><div class="val red">${formatCurrency(d.totalDue)}</div></div>
          <div class="summary-card"><div class="lbl">Paid Students</div><div class="val green">${d.paidStudents}</div></div>
          <div class="summary-card"><div class="lbl">Pending Students</div><div class="val red">${d.pendingStudents}</div></div>
        </div>
        <div class="sec-title">Class-wise Breakdown</div>
        <table>
          <thead>
            <tr>
              <th>Class</th><th>Students</th><th>Expected</th><th>Collected</th>
              <th>Due</th><th>Paid</th><th>Pending</th>
            </tr>
          </thead>
          <tbody>
            ${d.classSummaries.length === 0
              ? '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:16px;">No class data available.</td></tr>'
              : d.classSummaries.map((cs) => `<tr>
                  <td style="font-weight:600;">${cs.className}</td>
                  <td>${cs.totalStudents}</td>
                  <td>${formatCurrency(cs.totalExpected)}</td>
                  <td class="paid">${formatCurrency(cs.totalCollected)}</td>
                  <td class="${cs.totalDue > 0 ? 'due' : ''}">${formatCurrency(cs.totalDue)}</td>
                  <td class="paid">${cs.paidStudents}</td>
                  <td class="${cs.pendingStudents > 0 ? 'due' : ''}">${cs.pendingStudents}</td>
                </tr>`).join('')}
          </tbody>
        </table>`;
    };

    const title = generatedFilters?.scope === 'Student' ? 'Student Fee Report'
      : generatedFilters?.scope === 'Class' ? 'Class Fee Report' : 'Overall Fee Collection Report';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title} - ${sName}</title>
  <style>${css}</style>
</head>
<body>
  <div class="rpt-hdr">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1>${sName}</h1>
        <p>${title}</p>
      </div>
      <div class="date">
        <p>Generated On</p>
        <p>${today}</p>
      </div>
    </div>
  </div>
  <div class="rpt-body">
    <div class="filters">${filterTags}</div>
    ${generatedFilters?.scope === 'Student' ? studentInfoHtml() : ''}
    ${generatedFilters?.scope === 'Class' ? classInfoHtml() : ''}
    ${generatedFilters?.scope === 'Overall' ? overallInfoHtml() : ''}
  </div>
  <div class="ftr">
    <span>${sName} &mdash; ${title}</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>`;
  }, [getReportData, schoolInfo, generatedFilters, selectedStudent, currentYear]);

  const handlePrint = useCallback(() => {
    const reportData = getReportData();
    if (!reportData) return;
    const html = buildReportHtml();
    if (!html) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { window.print(); return; }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }, [getReportData, buildReportHtml]);

  const handleExportPdf = useCallback(async () => {
    const reportData = getReportData();
    if (!reportData) return;
    const html = buildReportHtml();
    if (!html) return;
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const el = document.createElement('div');
      el.innerHTML = html;
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      el.style.top = '0';
      document.body.appendChild(el);
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `${generatedFilters?.scope || 'Report'}-Report-${reportData?.academicYear || academicYear || currentYear}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(el).save();
      document.body.removeChild(el);
    } catch {
      // PDF generation failed silently
    }
  }, [getReportData, buildReportHtml, generatedFilters, currentYear, academicYear]);

  const renderStudentReport = () => {
    if (!studentReport) return null;
    const { student, breakdown, paidMonths, dueMonths, totalExpected, totalPaid, totalDue, totalDiscount, totalFine, totalTransactions } = studentReport;
    const sortedPaid = MONTHS_ORDER.filter((m) => paidMonths.includes(m));
    const sortedDue = MONTHS_ORDER.filter((m) => dueMonths.includes(m));

    return (
      <>
        <CardSection title="Student Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Student ID', value: student.id },
              { label: 'Student Name', value: student.name },
              { label: 'Class', value: student.class },
              { label: 'Academic Year', value: effectiveYear },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        </CardSection>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Expected', value: formatCurrency(totalExpected), color: 'blue', Icon: CurrencyDollarIcon },
            { label: 'Total Paid', value: formatCurrency(totalPaid), color: 'green', Icon: ArrowTrendingUpIcon },
            { label: 'Total Due', value: formatCurrency(totalDue), color: 'red', Icon: ClockIcon },
            { label: 'Total Discount', value: formatCurrency(totalDiscount), color: 'blue', Icon: ArrowTrendingUpIcon },
            { label: 'Late Fine', value: formatCurrency(totalFine), color: 'yellow', Icon: ClockIcon },
            { label: 'Transactions', value: totalTransactions, color: 'green', Icon: DocumentChartBarIcon },
          ].map((card) => (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${
                  card.color === 'green' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : card.color === 'red' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      : card.color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                }`}>
                  <card.Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <CardSection title="Monthly Fee Breakdown">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Month</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Fee Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Expected</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Paid</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Discount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Fine</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Net Paid</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Due</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {breakdown.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No fee records found for the selected filters.</td></tr>
                ) : (
                  breakdown.map((r) => (
                    <tr key={r.id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.month}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.feeType === 'Monthly Fee' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : r.feeType === 'Admission Fee' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        }`}>{r.feeType}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(r.expected)}</td>
                      <td className="px-4 py-3 text-green-600 dark:text-green-400">{formatCurrency(r.paid)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.discount > 0 ? formatCurrency(r.discount) : '-'}</td>
                      <td className="px-4 py-3 text-yellow-600 dark:text-yellow-400">{r.fine > 0 ? formatCurrency(r.fine) : '-'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{formatCurrency(r.netPaid)}</td>
                      <td className={`px-4 py-3 font-medium ${r.due > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{formatCurrency(r.due)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          r.status === 'Paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                            : r.status === 'Partially Paid' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.date || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSection title="Paid Months">
            {sortedPaid.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No months fully paid yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sortedPaid.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                    <CheckCircleIcon className="h-3.5 w-3.5" /> {m}
                  </span>
                ))}
              </div>
            )}
          </CardSection>
          <CardSection title="Due Months">
            {sortedDue.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">All months are paid. No dues pending.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sortedDue.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                    <ExclamationCircleIcon className="h-3.5 w-3.5" /> {m}
                  </span>
                ))}
              </div>
            )}
          </CardSection>
        </div>
      </>
    );
  };

  const renderClassReport = () => {
    if (!classReport) return null;
    const { className, students: sData, totalStudents, totalExpected, totalCollected, totalDue, paidStudents, pendingStudents, totalTransactions } = classReport;

    return (
      <>
        <CardSection title="Class Summary">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Class Name', value: className },
              { label: 'Academic Year', value: effectiveYear },
              { label: 'Total Students', value: totalStudents },
              { label: 'Fee Type', value: generatedFilters?.feeType || 'All Fees' },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Expected', value: formatCurrency(totalExpected), color: 'blue', Icon: CurrencyDollarIcon },
              { label: 'Total Collected', value: formatCurrency(totalCollected), color: 'green', Icon: ArrowTrendingUpIcon },
              { label: 'Total Due', value: formatCurrency(totalDue), color: 'red', Icon: ClockIcon },
              { label: 'Paid Students', value: paidStudents, color: 'green', Icon: UserGroupIcon },
              { label: 'Pending Students', value: pendingStudents, color: 'yellow', Icon: UserGroupIcon },
              { label: 'Transactions', value: totalTransactions, color: 'blue', Icon: DocumentChartBarIcon },
            ].map((card) => (
              <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    card.color === 'green' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                      : card.color === 'red' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        : card.color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  }`}>
                    <card.Icon className="h-6 w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardSection>

        <CardSection title="Student Breakdown">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Student ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Expected</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Collected</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Due</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Paid/Due Months</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sData.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No students found for this class.</td></tr>
                ) : (
                  sData.map((s) => (
                    <tr key={s.id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{s.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(s.expected)}</td>
                      <td className="px-4 py-3 text-green-600 dark:text-green-400">{formatCurrency(s.collected)}</td>
                      <td className={`px-4 py-3 font-medium ${s.due > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{formatCurrency(s.due)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{s.paidMonths}/{s.dueMonths + s.paidMonths}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          s.status === 'Paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
                            : s.status === 'Partial' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
                        }`}>{s.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardSection>
      </>
    );
  };

  const renderOverallReport = () => {
    if (!overallReport) return null;
    const { classSummaries, totalStudents, totalExpected, totalCollected, totalDue, paidStudents, pendingStudents } = overallReport;

    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Students', value: totalStudents, color: 'blue', Icon: UserGroupIcon },
            { label: 'Total Expected', value: formatCurrency(totalExpected), color: 'blue', Icon: CurrencyDollarIcon },
            { label: 'Total Collected', value: formatCurrency(totalCollected), color: 'green', Icon: ArrowTrendingUpIcon },
            { label: 'Total Due', value: formatCurrency(totalDue), color: 'red', Icon: ClockIcon },
            { label: 'Paid Students', value: paidStudents, color: 'green', Icon: UserGroupIcon },
            { label: 'Pending Students', value: pendingStudents, color: 'yellow', Icon: UserGroupIcon },
          ].map((card) => (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${
                  card.color === 'green' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                    : card.color === 'red' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      : card.color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                }`}>
                  <card.Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <CardSection title="Class-wise Breakdown">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Class</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Students</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Expected</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Collected</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Due</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Paid</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {classSummaries.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No class data available.</td></tr>
                ) : (
                  classSummaries.map((cs) => (
                    <tr key={cs.className} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{cs.className}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{cs.totalStudents}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(cs.totalExpected)}</td>
                      <td className="px-4 py-3 text-green-600 dark:text-green-400">{formatCurrency(cs.totalCollected)}</td>
                      <td className={`px-4 py-3 font-medium ${cs.totalDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>{formatCurrency(cs.totalDue)}</td>
                      <td className="px-4 py-3 text-green-600 dark:text-green-400">{cs.paidStudents}</td>
                      <td className={`px-4 py-3 font-medium ${cs.pendingStudents > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}`}>{cs.pendingStudents}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardSection>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Fee Reports</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Analyze fee collection, outstanding fees, and payment performance across students and classes.
          </p>
        </div>
      </div>

      <CardSection title="Report Scope">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { value: 'Overall', label: 'Overall Report', desc: 'Complete school fee position across all classes' },
            { value: 'Class', label: 'Class Report', desc: 'Analyze fee position for a specific class' },
            { value: 'Student', label: 'Student Report', desc: 'Search and analyze a specific student\'s fee position' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleScopeChange({ target: { value: opt.value } })}
              className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                scope === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <p className={`text-sm font-semibold ${scope === opt.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                {opt.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </CardSection>

      <CardSection title="Filters">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Academic Year
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              name="academicYear"
              value={academicYear}
              onChange={handleFilterChange(setAcademicYear)}
              placeholder="e.g. 2025"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <SelectInput
            label="Fee Type"
            name="feeType"
            value={feeType}
            onChange={handleFilterChange(setFeeType)}
            options={FEE_TYPES}
            placeholder="Select Fee Type"
          />
          <DateInput
            label="Date From"
            name="dateFrom"
            value={dateFrom}
            onChange={handleFilterChange(setDateFrom)}
          />
          <DateInput
            label="Date To"
            name="dateTo"
            value={dateTo}
            onChange={handleFilterChange(setDateTo)}
          />
        </div>

        {scope === 'Class' && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <SelectInput
              label="Select Class"
              name="selectedClass"
              value={selectedClass}
              onChange={handleFilterChange(setSelectedClass)}
              options={CLASS_OPTIONS}
              placeholder="Choose a class"
            />
          </div>
        )}

        {scope === 'Student' && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Search by Student ID or Name
            </label>
            {selectedStudent ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{selectedStudent.name}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{selectedStudent.id} &middot; {selectedStudent.class}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedStudent(null); setStudentQuery(''); setSearchResults([]); setSearchError(''); setError(''); setGeneratedFilters(null); setReportData(null); }}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-xs font-medium cursor-pointer"
                >Change</button>
              </div>
            ) : (
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Student ID or Name..."
                  value={studentQuery}
                  onChange={handleStudentQueryChange}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                {studentQuery && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchLoading ? (
                      <div className="px-4 py-6 text-center"><p className="text-sm text-gray-500 dark:text-gray-400">Searching...</p></div>
                    ) : searchError ? (
                      <div className="px-4 py-6 text-center"><p className="text-sm text-red-500 dark:text-red-400">{searchError}</p></div>
                    ) : searchResults.length === 0 ? (
                      <div className="px-4 py-6 text-center"><p className="text-sm text-gray-500 dark:text-gray-400">No student found matching your search.</p></div>
                    ) : (
                      searchResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleStudentSelect(s)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 cursor-pointer"
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Father: {s.fatherName || '-'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{s.id} &middot; {s.class}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {scope === 'Overall' && 'Showing results for all classes.'}
            {scope === 'Class' && (selectedClass ? `Showing results for ${selectedClass}.` : 'Select a class to filter results.')}
            {scope === 'Student' && (selectedStudent ? `Showing results for ${selectedStudent.name}.` : 'Search and select a student to filter results.')}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowPathIcon className="h-4 w-4" /> Reset
            </button>
            <Button onClick={handleGenerate} loading={loading} className="!w-auto">
              <FunnelIcon className="h-4 w-4 mr-2" /> Generate Report
            </Button>
          </div>
        </div>
      </CardSection>

      {loading && (
        <CardSection title="Report Summary">
          <div className="text-center py-12">
            <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-blue-200 dark:border-blue-900/30 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Generating Report</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Please wait while your report is being prepared...</p>
          </div>
        </CardSection>
      )}

      {!loading && error && (
        <CardSection title="Report Summary">
          <div className="text-center py-12">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <ExclamationCircleIcon className="h-6 w-6 text-red-500 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Report Generation Failed</h3>
            <p className="text-sm text-red-500 dark:text-red-400 max-w-md mx-auto">{error}</p>
          </div>
        </CardSection>
      )}

      {!loading && !error && summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Expected', value: formatCurrency(summary.totalExpected), color: 'blue', Icon: CurrencyDollarIcon },
              { label: 'Total Collected', value: formatCurrency(summary.totalCollected), color: 'green', Icon: ArrowTrendingUpIcon },
              { label: 'Total Due', value: formatCurrency(summary.totalDue), color: 'red', Icon: ClockIcon },
              { label: 'Paid Students', value: summary.paidStudents, color: 'green', Icon: UserGroupIcon },
              { label: 'Pending Students', value: summary.pendingStudents, color: 'yellow', Icon: UserGroupIcon },
              { label: 'Total Transactions', value: summary.totalTransactions, color: 'blue', Icon: DocumentChartBarIcon },
            ].map((card) => (
              <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    card.color === 'green' ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                      : card.color === 'red' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        : card.color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  }`}>
                    <card.Icon className="h-6 w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <CardSection title="Report Summary">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Report Type</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{scope} Report</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Academic Year</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{effectiveYear}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fee Type</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{generatedFilters?.feeType || 'All Fees'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date Range</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                    {generatedFilters?.dateFrom || generatedFilters?.dateTo
                      ? `${generatedFilters?.dateFrom || 'Start'} to ${generatedFilters?.dateTo || 'End'}`
                      : 'All Dates'}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scope</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                    {scope === 'Overall' && 'All Classes'}
                    {scope === 'Class' && (selectedClass || 'All Classes')}
                    {scope === 'Student' && selectedStudent?.name}
                  </p>
                </div>
              </div>
              {summary.totalExpected > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                    <span>Collection Progress</span>
                    <span>{((summary.totalCollected / summary.totalExpected) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((summary.totalCollected / summary.totalExpected) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardSection>

          {scope === 'Student' && renderStudentReport()}
          {scope === 'Class' && renderClassReport()}
          {scope === 'Overall' && renderOverallReport()}

          {getReportData() && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 pb-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Report ready — Print or download as PDF
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-sm transition-all cursor-pointer"
                >
                  <PrinterIcon className="h-4 w-4" />
                  Print Report
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-sm transition-all cursor-pointer"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !error && !generatedFilters && (
        <CardSection title="Report Summary">
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/20">
                <DocumentChartBarIcon className="h-10 w-10 text-blue-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Report Generated</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Configure your filters above and click <span className="font-semibold text-blue-600 dark:text-blue-400">Generate Report</span> to view the fee summary.
            </p>
          </div>
        </CardSection>
      )}
    </div>
  );
};

export default Reports;
