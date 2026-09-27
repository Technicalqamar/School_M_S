import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BanknotesIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  CheckIcon,
  PrinterIcon,
  EyeIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  UserIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import SearchInput from '../../../common/SearchInput/SearchInput';
import Table from '../../../common/Table/Table';
import Modal from '../../../common/Modal/Modal';
import Button from '../../../common/Button/Button';
import payrollService from '../../../../services/payroll/payroll.service';
import { useCurrency } from '../../../../hooks/useLocalization';
import { useSchoolConfig } from '../../../../contexts/SchoolConfigContext';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Other'];
const PAYMENT_STATUSES = ['Paid', 'Pending'];
const PAGE_SIZE = 10;
const EMPTY_FORM = { amountPaid: '', paymentDate: '', paymentMethod: '', paymentReference: '' };

const BASE_FILTERS = { month: '', status: '', paymentMethod: '', fromDate: '', toDate: '' };

// Format a date stored as YYYY-MM-DD (or ISO datetime) without timezone shifting.
const formatDate = (value) => {
  if (!value) return '—';
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value).slice(0, 10);
  return `${match[3]} ${MONTH_SHORT[Number(match[2]) - 1]} ${match[1]}`;
};

// Local-timezone YYYY-MM-DD for "today" (payment dates must never be in the future).
const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// Selectable payroll years come from the system's central Academic Year setting
// plus the years that actually exist in real payroll/payment records — never an
// invented sequential list.
const statusBadgeClass = (status) => {
  if (status === 'Paid') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  if (status === 'Pending') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const SalaryHistory = () => {
  const { formatCurrency } = useCurrency();
  const { schoolInfo, branding, academic } = useSchoolConfig();
  const centralYear = String(academic.currentYear || '').trim();

  // Academic year source: the system's central Academic Year plus years that
  // exist in real payroll/payment records (never an invented sequential list).
  const [dataYears, setDataYears] = useState(() => new Set());
  const yearOptions = useMemo(() => {
    const years = new Set(dataYears);
    if (centralYear) years.add(centralYear);
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [dataYears, centralYear]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(() => ({ ...BASE_FILTERS, year: centralYear || '' }));
  const defaultYearApplied = useRef(Boolean(centralYear));
  const [page, setPage] = useState(1);

  // Payment history (server-paginated, exactly PAGE_SIZE per page).
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const requestRef = useRef(0);

  // Payrolls awaiting settlement (real backend payroll records, Generated/Pending).
  const [pendingPayrolls, setPendingPayrolls] = useState([]);
  const pendingRef = useRef(0);

  // Record / mark-as-paid modal state.
  const [payItem, setPayItem] = useState(null); // { mode: 'create'|'update', payroll, payment }
  const [payForm, setPayForm] = useState(EMPTY_FORM);
  const [payErrors, setPayErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // View payment modal state.
  const [viewItem, setViewItem] = useState(null);

  const buildParams = (pageToLoad) => {
    const params = { page: pageToLoad, limit: PAGE_SIZE };
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    if (filters.month) params.month = MONTH_NAMES.indexOf(filters.month) + 1;
    if (filters.year) params.year = filters.year;
    if (filters.status) params.status = filters.status;
    if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    return params;
  };

  // Payment history fetch — the server does the filtering and pagination.
  const fetchPayments = async (pageToLoad) => {
    const reqId = ++requestRef.current;
    setLoading(true);
    try {
      const result = await payrollService.getPayments(buildParams(pageToLoad));
      if (reqId !== requestRef.current) return;
      const loadedPayments = result.data?.payments || [];
      setPayments(loadedPayments);
      setPagination(result.data?.pagination || { currentPage: 1, totalPages: 1, totalItems: 0, limit: PAGE_SIZE });
      setLoadError(null);
      mergeYearsFromRecords(loadedPayments);
    } catch (err) {
      if (reqId !== requestRef.current) return;
      setLoadError(err.response?.data?.message || 'Failed to load payment history');
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
  };

  // Payrolls still awaiting settlement (status Generated or Pending only).
  const fetchPendingPayrolls = async () => {
    const reqId = ++pendingRef.current;
    const base = {};
    if (debouncedSearch.trim()) base.search = debouncedSearch.trim();
    if (filters.month) base.month = MONTH_NAMES.indexOf(filters.month) + 1;
    if (filters.year) base.year = filters.year;

    try {
      const [generatedRes, pendingRes] = await Promise.all([
        payrollService.getPayrollRecords({ ...base, status: 'Generated' }),
        payrollService.getPayrollRecords({ ...base, status: 'Pending' }),
      ]);
      if (reqId !== pendingRef.current) return;
      const awaiting = [...(generatedRes.data?.payrolls || []), ...(pendingRes.data?.payrolls || [])];
      awaiting.sort(
        (a, b) => b.payrollYear - a.payrollYear || b.payrollMonth - a.payrollMonth || String(b._id).localeCompare(String(a._id)),
      );
      setPendingPayrolls(awaiting);
      mergeYearsFromRecords(awaiting);
    } catch {
      if (reqId === pendingRef.current) setPendingPayrolls([]);
    }
  };

  // Distinct years present in real payroll records (any status) — the source
  // for the Payroll Year options so no invented/sequential years are offered.
  const fetchAvailableYears = async () => {
    try {
      const result = await payrollService.getPayrollRecords();
      const years = (result.data?.payrolls || [])
        .map((payroll) => payroll.payrollYear)
        .filter((year) => year !== undefined && year !== null)
        .map(String);
      if (years.length) setDataYears(new Set(years));
    } catch {
      // Keep the current options if the census request fails.
    }
  };

  // Insurance: merge years from records that are currently loaded so the year
  // options always reflect the payments/payrolls actually being displayed.
  const mergeYearsFromRecords = (records) => {
    const years = (records || [])
      .map((record) => record.payrollYear)
      .filter((year) => year !== undefined && year !== null)
      .map(String);
    if (!years.length) return;
    setDataYears((prev) => {
      const next = new Set(prev);
      let changed = false;
      years.forEach((year) => {
        if (!next.has(year)) {
          next.add(year);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  };

  const refreshAll = async () => {
    await Promise.all([fetchPayments(page), fetchPendingPayrolls(), fetchAvailableYears()]);
  };

  // Debounce the teacher search box.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Apply the central academic year once it is available (school settings load
  // asynchronously), matching the convention used across the admin module.
  useEffect(() => {
    if (centralYear && !defaultYearApplied.current) {
      defaultYearApplied.current = true;
      setFilters((prev) => ({ ...prev, year: centralYear }));
    }
  }, [centralYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAvailableYears();
  }, []);

  // Any filter change goes back to the first page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, filters.year, filters.month, filters.status, filters.paymentMethod, filters.fromDate, filters.toDate]);

  // Payment history follows page + filters; the backend pages the data.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, filters.year, filters.month, filters.status, filters.paymentMethod, filters.fromDate, filters.toDate]);

  // Awaiting-payment payrolls follow the search / period filters only.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPendingPayrolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.year, filters.month]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilters({ ...BASE_FILTERS, year: centralYear || '' });
    setPage(1);
    refreshAll();
  };

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
      filters.month ||
      (filters.year && filters.year !== centralYear) ||
      filters.status ||
      filters.paymentMethod ||
      filters.fromDate ||
      filters.toDate,
  );

  // ─── Payment modal (create for an awaiting payroll, update for a Pending payment) ───

  const openPayCreate = (payroll) => {
    setPayItem({ mode: 'create', payroll });
    setPayForm({
      amountPaid: payroll.netSalary !== undefined && payroll.netSalary !== null ? String(payroll.netSalary) : '',
      paymentDate: todayISO(),
      paymentMethod: '',
      paymentReference: '',
    });
    setPayErrors({});
  };

  const openPayUpdate = (payment) => {
    setPayItem({ mode: 'update', payment });
    setPayForm({
      amountPaid: payment.amountPaid !== undefined && payment.amountPaid !== null ? String(payment.amountPaid) : '',
      paymentDate: payment.paymentDate ? String(payment.paymentDate).slice(0, 10) : todayISO(),
      paymentMethod: payment.paymentMethod || '',
      paymentReference: payment.paymentReference || '',
    });
    setPayErrors({});
  };

  const closePayModal = () => {
    setPayItem(null);
    setPayForm(EMPTY_FORM);
    setPayErrors({});
  };

  const handlePayChange = (name, value) => {
    setPayForm((prev) => ({ ...prev, [name]: value }));
    if (payErrors[name]) setPayErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validatePay = () => {
    const newErrors = {};
    if (!payForm.amountPaid || payForm.amountPaid === '') {
      newErrors.amountPaid = 'Amount paid is required';
    } else if (!(Number(payForm.amountPaid) > 0)) {
      newErrors.amountPaid = 'Amount paid must be a positive number';
    }
    if (!payForm.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    } else if (payForm.paymentDate > todayISO()) {
      newErrors.paymentDate = 'Payment date cannot be in the future';
    }
    if (!payForm.paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required';
    }
    setPayErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitPay = async () => {
    if (!validatePay()) return;
    setSubmitting(true);

    const payload = {
      amountPaid: Number(payForm.amountPaid),
      paymentDate: payForm.paymentDate,
      paymentMethod: payForm.paymentMethod,
      paymentReference: payForm.paymentReference.trim(),
      status: 'Paid',
    };

    try {
      const result =
        payItem.mode === 'update'
          ? await payrollService.updatePayment(payItem.payment._id, payload)
          : await payrollService.createPayment({ ...payload, payrollId: payItem.payroll._id });
      toast.success(result.message || 'Payment recorded successfully');
      closePayModal();
      await refreshAll();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to record payment';
      toast.error(msg);
      // A duplicate (409) or stale state means the server view changed (e.g. a
      // payment already exists for this payroll) — resync the lists.
      if (err.response?.status === 409) {
        await refreshAll();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── View / Print ─────────────────────────────────────────────────

  const openView = (payment) => {
    setViewItem(payment);
  };

  const closeView = () => {
    setViewItem(null);
  };

  const buildReceiptHtml = (payment) => {
    const pay = payment || {};
    const teacher = pay.teacher || {};
    const payroll = pay.payroll || {};
    const monthName = MONTH_NAMES[Number(pay.payrollMonth) - 1] || pay.payrollMonth || '—';
    const period = `${monthName} ${pay.payrollYear ?? '—'}`;
    const schoolLine = [schoolInfo.address, schoolInfo.city, schoolInfo.province, schoolInfo.country]
      .filter(Boolean)
      .join(', ');
    const schoolName = schoolInfo.name || 'School';
    const money = (value) => (value === undefined || value === null || value === '' ? '—' : formatCurrency(value));
    const teacherName = teacher.fullName || pay.teacherId || '—';

    const deduction = payroll.salaryDeduction;
    const netSalary = payroll.netSalary;

    const css = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: A4; margin: 12mm; }
      body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #111827; font-size: 13px; line-height: 1.5; }
      .rpt { max-width: 720px; margin: 0 auto; background: #fff; }
      .hdr { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 2px solid #111827; padding-bottom: 12px; }
      .hdr-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .hdr-left img { height: 56px; width: 56px; object-fit: contain; }
      .school { font-size: 18px; font-weight: 800; letter-spacing: 0.3px; }
      .school-sub { font-size: 11px; color: #4b5563; margin-top: 2px; word-break: break-word; }
      .title { text-align: center; font-size: 14px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; margin: 16px 0 4px; }
      .title-sub { text-align: center; font-size: 10.5px; color: #6b7280; margin-bottom: 14px; }
      .meta { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; font-size: 11px; color: #374151; }
      .meta b { color: #111827; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
      .sec-title { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #374151; margin-bottom: 8px; }
      .rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
      .row .lbl { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
      .row .val { font-size: 13px; font-weight: 600; color: #111827; margin-top: 2px; word-break: break-word; }
      table.sum { width: 100%; border-collapse: collapse; margin-bottom: 12px; page-break-inside: avoid; }
      table.sum th { background: #f3f4f6; text-align: left; }
      table.sum th, table.sum td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; }
      table.sum th.num, table.sum td.num { text-align: right; white-space: nowrap; }
      table.sum td.neg { color: #b91c1c; }
      .paid-box { display: flex; justify-content: space-between; align-items: center; border: 1.5px solid #111827; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; background: #f9fafb; page-break-inside: avoid; }
      .paid-box .lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #374151; }
      .paid-box .val { font-size: 16px; font-weight: 800; color: #111827; }
      .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 600; }
      .badge.paid { background: #dcfce7; color: #166534; }
      .badge.pending { background: #fef3c7; color: #92400e; }
      .sig { display: flex; justify-content: space-between; gap: 20px; margin: 28px 0 8px; }
      .sig-item { width: 220px; text-align: center; }
      .sig-item .ph { height: 48px; display: flex; align-items: flex-end; justify-content: center; }
      .sig-item .line { border-bottom: 1px solid #6b7280; width: 100%; }
      .sig-item img { height: 48px; object-fit: contain; }
      .sig-item .lbl { font-size: 10px; color: #6b7280; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .ftr { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #6b7280; }
    `;

    const statusBadge =
      pay.status === 'Paid'
        ? '<span class="badge paid">Paid</span>'
        : '<span class="badge pending">Pending</span>';

    const signatureBlock = branding.signature
      ? `<img src="${escapeHtml(branding.signature)}" alt="Principal Signature" />`
      : '<div class="ph"><div class="line"></div></div>';
    const stampBlock = branding.stamp
      ? `<img src="${escapeHtml(branding.stamp)}" alt="School Stamp" />`
      : '<div class="ph"><div class="line"></div></div>';

    const footerText = branding.footerText || 'This is a computer-generated receipt.';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Salary Payment Receipt — ${escapeHtml(schoolName)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="rpt">
    <div class="hdr">
      <div class="hdr-left">
        ${schoolInfo.logo ? `<img src="${escapeHtml(schoolInfo.logo)}" alt="School Logo" />` : ''}
        <div>
          <div class="school">${escapeHtml(schoolName)}</div>
          ${schoolLine ? `<div class="school-sub">${escapeHtml(schoolLine)}</div>` : ''}
          ${schoolInfo.registrationNumber ? `<div class="school-sub">Reg. No: ${escapeHtml(schoolInfo.registrationNumber)}</div>` : ''}
          ${schoolInfo.contact ? `<div class="school-sub">Tel: ${escapeHtml(schoolInfo.contact)}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;">
        <div class="school-sub">${escapeHtml(period)}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">Payment Date: ${escapeHtml(formatDate(pay.paymentDate))}</div>
      </div>
    </div>

    <div class="title">Salary Payment Receipt</div>
    <div class="title-sub">Salary payment record for the payroll period ${escapeHtml(period)}</div>

    <div class="meta">
      <div>Payment Reference: <b>${escapeHtml(pay.paymentReference || '—')}</b></div>
      <div>Payment Status: ${statusBadge}</div>
    </div>

    <div class="card">
      <div class="sec-title">Teacher Information</div>
      <div class="rows">
        <div class="row"><div class="lbl">Teacher Name</div><div class="val">${escapeHtml(teacherName)}</div></div>
        <div class="row"><div class="lbl">Teacher ID</div><div class="val">${escapeHtml(pay.teacherId || '—')}</div></div>
        <div class="row"><div class="lbl">Payroll Period</div><div class="val">${escapeHtml(period)}</div></div>
      </div>
    </div>

    <div class="sec-title" style="margin:4px 0 8px;">Salary Summary</div>
    <table class="sum">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Basic Salary</th>
          <th class="num">Deduction</th>
          <th class="num">Net Salary</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(period)}</td>
          <td class="num">${money(pay.basicSalary ?? payroll.basicSalary)}</td>
          <td class="num neg">${deduction > 0 ? `-${money(deduction)}` : money(deduction)}</td>
          <td class="num"><b>${money(netSalary)}</b></td>
        </tr>
      </tbody>
    </table>

    <div class="card">
      <div class="sec-title">Payment Details</div>
      <div class="rows">
        <div class="row"><div class="lbl">Amount Paid</div><div class="val">${money(pay.amountPaid)}</div></div>
        <div class="row"><div class="lbl">Payment Date</div><div class="val">${escapeHtml(formatDate(pay.paymentDate))}</div></div>
        <div class="row"><div class="lbl">Payment Method</div><div class="val">${escapeHtml(pay.paymentMethod || '—')}</div></div>
        <div class="row"><div class="lbl">Payment Reference</div><div class="val">${escapeHtml(pay.paymentReference || '—')}</div></div>
      </div>
    </div>

    <div class="paid-box">
      <span class="lbl">Amount Paid</span>
      <span class="val">${money(pay.amountPaid)}</span>
    </div>

    <div class="sig">
      <div class="sig-item">
        ${signatureBlock}
        <div class="lbl">Principal Signature</div>
      </div>
      <div class="sig-item">
        ${stampBlock}
        <div class="lbl">School Stamp</div>
      </div>
    </div>

    <div class="ftr">
      ${escapeHtml(schoolName)} &mdash; Salary Payment Receipt &middot; ${escapeHtml(footerText)}
    </div>
  </div>
</body>
</html>`;
  };

  const openPrintWindow = (payment) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildReceiptHtml(payment));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  // ─── Table rendering ───────────────────────────────────────────────

  const tableColumns = [
    { key: 'teacherId', label: 'Teacher ID' },
    { key: 'teacherName', label: 'Teacher Name' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'salaryDeduction', label: 'Deduction' },
    { key: 'netSalary', label: 'Net Salary' },
    { key: 'status', label: 'Payment Status' },
    { key: 'paymentDate', label: 'Payment Date' },
    { key: 'paymentMethod', label: 'Payment Method' },
    { key: 'paymentReference', label: 'Payment Reference' },
    { key: 'actions', label: '', className: 'text-right' },
  ];

  const renderActions = (payment) => {
    if (payment.status === 'Pending') {
      return (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => openPayUpdate(payment)}
            title="Mark as Paid"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-all cursor-pointer whitespace-nowrap"
          >
            <CheckIcon className="h-3.5 w-3.5" /> Mark as Paid
          </button>
          <button
            onClick={() => openView(payment)}
            title="View Payment"
            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => openView(payment)}
          title="View Payment"
          className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => openPrintWindow(payment)}
          title="Print Receipt"
          className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors cursor-pointer"
        >
          <PrinterIcon className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const renderRow = (payment) => {
    const teacherName = payment.teacher?.fullName || '—';
    const deduction = payment.payroll?.salaryDeduction;
    const netSalary = payment.payroll?.netSalary;

    return (
      <>
        <td className="px-4 py-3">
          <span className="font-medium text-gray-900 dark:text-white whitespace-nowrap">{payment.teacherId}</span>
        </td>
        <td className="px-4 py-3">
          <span className="font-medium text-gray-700 dark:text-gray-300 block max-w-[180px] truncate" title={teacherName}>
            {teacherName}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {MONTH_SHORT[Number(payment.payrollMonth) - 1] || payment.payrollMonth || '—'}
        </td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 tabular-nums">{payment.payrollYear ?? '—'}</td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {formatCurrency(payment.basicSalary)}
        </td>
        <td className="px-4 py-3 text-red-600 dark:text-red-400 whitespace-nowrap">
          {deduction === undefined || deduction === null ? '—' : `-${formatCurrency(deduction)}`}
        </td>
        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
          {netSalary === undefined || netSalary === null ? '—' : formatCurrency(netSalary)}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusBadgeClass(
              payment.status,
            )}`}
          >
            {payment.status}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatDate(payment.paymentDate)}</td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{payment.paymentMethod || '—'}</td>
        <td className="px-4 py-3">
          {payment.paymentReference ? (
            <span className="block max-w-[150px] truncate text-gray-600 dark:text-gray-300" title={payment.paymentReference}>
              {payment.paymentReference}
            </span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          )}
        </td>
        <td className="px-4 py-3">{renderActions(payment)}</td>
      </>
    );
  };

  const renderMobileCard = (payment) => {
    const teacherName = payment.teacher?.fullName || '—';
    const deduction = payment.payroll?.salaryDeduction;
    const netSalary = payment.payroll?.netSalary;
    const period = `${MONTH_NAMES[Number(payment.payrollMonth) - 1] || payment.payrollMonth || ''} ${payment.payrollYear || ''}`.trim();

    return (
      <div key={payment._id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{teacherName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{payment.teacherId}</p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${statusBadgeClass(
              payment.status,
            )}`}
          >
            {payment.status}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <CalendarDaysIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <span>{period || '—'}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Basic</p>
            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{formatCurrency(payment.basicSalary)}</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-[10px] text-red-500 dark:text-red-400 uppercase tracking-wider">Deduction</p>
            <p className="text-xs font-semibold text-red-700 dark:text-red-300 truncate">
              {deduction === undefined || deduction === null ? '—' : `-${formatCurrency(deduction)}`}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-[10px] text-green-600 dark:text-green-400 uppercase tracking-wider">Net</p>
            <p className="text-xs font-semibold text-green-700 dark:text-green-300 truncate">
              {netSalary === undefined || netSalary === null ? '—' : formatCurrency(netSalary)}
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 dark:text-gray-500">Payment Date</span>
            <span className="font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatDate(payment.paymentDate)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 dark:text-gray-500">Method</span>
            <span className="font-medium text-gray-700 dark:text-gray-200">{payment.paymentMethod || '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 dark:text-gray-500">Reference</span>
            <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[55%]">{payment.paymentReference || '—'}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          {payment.status === 'Pending' && (
            <button
              onClick={() => openPayUpdate(payment)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-all cursor-pointer whitespace-nowrap"
            >
              <CheckIcon className="h-3.5 w-3.5" /> Mark as Paid
            </button>
          )}
          <button
            onClick={() => openView(payment)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <EyeIcon className="h-3.5 w-3.5" /> View
          </button>
          <button
            onClick={() => openPrintWindow(payment)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <PrinterIcon className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      </div>
    );
  };

  // ─── Shared UI helpers ─────────────────────────────────────────────

  const selectClass =
    'appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border text-sm transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer';

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg border text-sm transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500';

  const filterLabelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide';

  const currentPage = pagination.currentPage || 1;
  const totalItems = pagination.totalItems || 0;
  const totalPages = pagination.totalPages || 1;
  const from = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, totalItems);

  const pageList = (() => {
    const end = Math.min(totalPages, Math.max(currentPage + 2, 5));
    const start = Math.max(1, end - 4);
    const list = [];
    for (let i = start; i <= end; i += 1) list.push(i);
    return list;
  })();

  // Data used by the pay modal (create: payroll; update: payment).
  const paySummary = (() => {
    if (!payItem) return null;
    if (payItem.mode === 'create') {
      const payroll = payItem.payroll || {};
      return {
        teacherName: payroll.teacher?.fullName || payroll.teacherId || '—',
        teacherId: payroll.teacherId || '—',
        monthName: MONTH_NAMES[Number(payroll.payrollMonth) - 1] || '—',
        year: payroll.payrollYear ?? '—',
        netSalary: payroll.netSalary,
      };
    }
    const payment = payItem.payment || {};
    return {
      teacherName: payment.teacher?.fullName || payment.teacherId || '—',
      teacherId: payment.teacherId || '—',
      monthName: MONTH_NAMES[Number(payment.payrollMonth) - 1] || '—',
      year: payment.payrollYear ?? '—',
      netSalary: payment.payroll?.netSalary,
    };
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Salary History / Payments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Record and manage salary payments. All salary figures and payment rules stay authoritative in the backend
            and are never recomputed in the browser.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetFilters}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <ArrowPathIcon className="h-4 w-4" /> Reset
          </button>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <ArrowPathIcon className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={refreshAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <label className={filterLabelClass}>Teacher ID / Name</label>
            <SearchInput placeholder="Search by Teacher ID or Name..." value={search} onChange={setSearch} />
          </div>
          <div className="relative">
            <label className={filterLabelClass}>Payroll Month</label>
            <div className="relative">
              <select
                value={filters.month}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                className={selectClass}
              >
                <option value="">All Months</option>
                {MONTH_NAMES.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="relative">
            <label className={filterLabelClass}>Payroll Year</label>
            <div className="relative">
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                className={selectClass}
              >
                <option value="">All Years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="relative">
            <label className={filterLabelClass}>Payment Status</label>
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className={selectClass}
              >
                <option value="">All Statuses</option>
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <label className={filterLabelClass}>Payment Method</label>
            <div className="relative">
              <select
                value={filters.paymentMethod}
                onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
                className={selectClass}
              >
                <option value="">All Methods</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="relative">
            <label className={filterLabelClass}>From Date</label>
            <input
              type="date"
              value={filters.fromDate}
              max={filters.toDate || undefined}
              onChange={(e) => handleFilterChange('fromDate', e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="relative">
            <label className={filterLabelClass}>To Date</label>
            <input
              type="date"
              value={filters.toDate}
              min={filters.fromDate || undefined}
              max={todayISO()}
              onChange={(e) => handleFilterChange('toDate', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
          Filters apply automatically. Payment records are fetched in pages of {PAGE_SIZE} from the backend.
        </p>
      </div>

      {/* Payrolls awaiting payment */}
      {pendingPayrolls.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                Awaiting Payment
              </h3>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {pendingPayrolls.length} payroll{pendingPayrolls.length === 1 ? '' : 's'} not yet settled
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendingPayrolls.map((payroll) => (
              <div
                key={payroll._id}
                className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-900/10 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {payroll.teacher?.fullName || payroll.teacherId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{payroll.teacherId}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${statusBadgeClass(
                      payroll.status,
                    )}`}
                  >
                    {payroll.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <CalendarDaysIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <span>
                    {MONTH_NAMES[Number(payroll.payrollMonth) - 1]} {payroll.payrollYear}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/70 dark:border-amber-900/40">
                  <div className="min-w-0">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Salary</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(payroll.netSalary)}
                    </p>
                  </div>
                  <button
                    onClick={() => openPayCreate(payroll)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
                  >
                    <CheckIcon className="h-3.5 w-3.5" /> Mark as Paid
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BanknotesIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Payment History
            </h3>
          </div>
          {!loading && totalItems > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {from}–{to}
              </span>{' '}
              of <span className="font-semibold text-gray-700 dark:text-gray-300">{totalItems}</span> payment record
              {totalItems === 1 ? '' : 's'}
            </p>
          )}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">
              <p className="text-sm">Loading payment history...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-16">
              <BanknotesIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                {hasActiveFilters ? 'No matching payment records' : 'No payment records found'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {hasActiveFilters
                  ? 'Try adjusting your filters.'
                  : pendingPayrolls.length > 0
                    ? 'Select an awaiting-payment payroll above and mark it as paid.'
                    : 'Generate a payroll first; its payment will appear here once recorded.'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table columns={tableColumns} data={payments} renderRow={renderRow} />
              </div>

              <div className="md:hidden space-y-3">{payments.map(renderMobileCard)}</div>

              {(totalPages > 1 || totalItems > 0) && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Page{' '}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{currentPage}</span> of{' '}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{totalPages}</span> ·{' '}
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{totalItems}</span> record
                    {totalItems === 1 ? '' : 's'}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => setPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      className="px-3 h-9 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {pageList.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`h-9 min-w-9 px-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          p === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-3 h-9 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Record / Mark as Paid modal */}
      <Modal
        isOpen={Boolean(payItem)}
        onClose={closePayModal}
        title={payItem?.mode === 'update' ? 'Mark as Paid' : 'Record Salary Payment'}
        maxWidth="max-w-lg"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {payItem?.mode === 'update'
            ? 'This payment record is pending. Confirm and save the payment details to mark the payroll as paid.'
            : 'Confirm the payment details below. Submitting records the payment and marks the payroll as paid in the backend.'}
        </p>

        {paySummary && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 mb-5">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-600">
              <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Teacher</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {paySummary.teacherName} · {paySummary.teacherId}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Month</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{paySummary.monthName}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Year</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{paySummary.year}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Salary</p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300 whitespace-nowrap">
                  {paySummary.netSalary === undefined || paySummary.netSalary === null
                    ? '—'
                    : formatCurrency(paySummary.netSalary)}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="payAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Amount Paid <span className="text-red-500">*</span>
          </label>
          <input
            id="payAmount"
            type="number"
            min="0"
            step="0.01"
            value={payForm.amountPaid}
            onChange={(e) => handlePayChange('amountPaid', e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
          {payErrors.amountPaid && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{payErrors.amountPaid}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="payDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              id="payDate"
              type="date"
              value={payForm.paymentDate}
              max={todayISO()}
              onChange={(e) => handlePayChange('paymentDate', e.target.value)}
              className={inputClass}
            />
            {payErrors.paymentDate && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{payErrors.paymentDate}</p>
            )}
          </div>
          <div>
            <label htmlFor="payMethod" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="payMethod"
                value={payForm.paymentMethod}
                onChange={(e) => handlePayChange('paymentMethod', e.target.value)}
                className={selectClass}
              >
                <option value="">Select method</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            {payErrors.paymentMethod && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{payErrors.paymentMethod}</p>
            )}
          </div>
        </div>

        <div className="mb-2">
          <label htmlFor="payRef" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Payment Reference
          </label>
          <input
            id="payRef"
            type="text"
            value={payForm.paymentReference}
            onChange={(e) => handlePayChange('paymentReference', e.target.value)}
            placeholder="Bank slip / cheque / transaction reference (optional)"
            className={inputClass}
          />
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={closePayModal} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submitPay} loading={submitting}>
            {payItem?.mode === 'update' ? 'Confirm Payment' : 'Record Payment'}
          </Button>
        </div>
      </Modal>

      {/* View Payment modal */}
      <Modal isOpen={Boolean(viewItem)} onClose={closeView} title="Payment Details" maxWidth="max-w-lg">
        {viewItem && (
          <div className="space-y-5">
            <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                {viewItem.teacher?.teacherImage ? (
                  <img
                    src={viewItem.teacher.teacherImage}
                    alt={viewItem.teacher?.fullName || 'Teacher'}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <UserIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {viewItem.teacher?.fullName || viewItem.teacherId}
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">{viewItem.teacherId}</p>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${statusBadgeClass(
                  viewItem.status,
                )}`}
              >
                {viewItem.status}
              </span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <CalendarDaysIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payroll Period</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {MONTH_NAMES[Number(viewItem.payrollMonth) - 1]} {viewItem.payrollYear}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Basic Salary</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                  {formatCurrency(viewItem.basicSalary)}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-xs text-red-500 dark:text-red-400 uppercase tracking-wider mb-1">Deduction</p>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300 whitespace-nowrap">
                  {viewItem.payroll?.salaryDeduction === undefined || viewItem.payroll?.salaryDeduction === null
                    ? '—'
                    : `-${formatCurrency(viewItem.payroll.salaryDeduction)}`}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Net Salary</p>
                <p className="text-sm font-semibold text-green-700 dark:text-green-300 whitespace-nowrap">
                  {viewItem.payroll?.netSalary === undefined || viewItem.payroll?.netSalary === null
                    ? '—'
                    : formatCurrency(viewItem.payroll.netSalary)}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center gap-3">
              <CurrencyDollarIcon className="h-5 w-5 text-indigo-500 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Amount Paid</p>
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                  {formatCurrency(viewItem.amountPaid)}
                </p>
              </div>
              <div className="min-w-0 flex-1 text-right">
                <p className="text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Payment Method</p>
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 truncate">
                  {viewItem.paymentMethod || '—'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Payment Date</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(viewItem.paymentDate)}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Payment Status</p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(
                    viewItem.status,
                  )}`}
                >
                  {viewItem.status}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Payment Reference</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white break-words">
                {viewItem.paymentReference || '—'}
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={closeView}>
                Close
              </Button>
              <Button onClick={() => openPrintWindow(viewItem)} className="inline-flex items-center justify-center gap-2">
                <PrinterIcon className="h-4 w-4" /> Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SalaryHistory;