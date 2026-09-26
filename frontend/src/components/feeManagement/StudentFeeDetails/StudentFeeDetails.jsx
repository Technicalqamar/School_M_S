import { useState, useCallback, useEffect, useMemo } from 'react';
import { MagnifyingGlassIcon, PrinterIcon, UserIcon, CurrencyDollarIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Table from '../../common/Table/Table';
import Button from '../../common/Button/Button';
import Modal from '../../common/Modal/Modal';
import feeService from '../../../services/fee/fee.service';
import studentService from '../../../services/student/student.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';

const FEE_TYPES = ['All Fee Types', 'Monthly Fee', 'Admission Fee', 'Examination Fee'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ALL_MONTHS = ['All Months', ...MONTHS];

const CLASS_TO_FEE_CLASS = {
  Montessori: 'Montessori',
  Nursery: 'Nursery',
  'KG 1': 'KG1',
  'KG 2': 'KG2',
  'Class 1': '1',
  'Class 2': '2',
  'Class 3': '3',
  'Class 4': '4',
  'Class 5': '5',
  'Class 6': '6',
  'Class 7': '7',
  'Class 8': '8',
  'Class 9': '9',
  'Class 10': '10',
};

const toDisplayFeeType = (canonical) => ({
  Admission: 'Admission Fee',
  Monthly: 'Monthly Fee',
  Examination: 'Examination Fee',
}[canonical] || canonical);

const formatCurrency = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

const formatDate = (val) => {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-CA');
};

const getInitials = (name) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

const buildStudentCard = (student) => ({
  _id: student._id,
  id: student.studentId,
  name: student.fullName,
  fatherName: student.fatherName,
  class: student.class,
  gender: student.gender,
  fatherPhone: student.fatherPhone,
  admissionDate: formatDate(student.admissionDate),
});

const mapPaymentRow = (p) => ({
  _id: p._id,
  id: p.receiptId,
  feeType: toDisplayFeeType(p.feeType),
  month: p.month,
  exam: p.exam || null,
  amount: p.baseAmount,
  discount: p.discount,
  fine: p.lateFine,
  totalPaid: p.amountPaid,
  remaining: p.remainingAmount,
  status: p.remainingAmount > 0 ? 'Partial' : 'Paid',
  date: formatDate(p.paymentDate),
  paymentMethod: p.paymentMethod,
  academicYear: p.academicYear,
  studentId: p.studentId,
  studentName: p.studentName,
  fatherName: p.fatherName,
  className: p.className,
});

const StudentFeeDetails = () => {
  const { schoolInfo, branding, academic } = useSchoolConfig();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [foundStudent, setFoundStudent] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  const [studentPayments, setStudentPayments] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [structures, setStructures] = useState([]);

  const [feeTypeFilter, setFeeTypeFilter] = useState('All Fee Types');
  const [monthFilter, setMonthFilter] = useState('All Months');
  const [yearFilter, setYearFilter] = useState('All Years');
  const [inputFocused, setInputFocused] = useState(false);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptItem, setReceiptItem] = useState(null);

  const currentYear = /^\d{4}$/.test(academic?.currentYear || '') ? academic.currentYear : String(new Date().getFullYear());

  const yearOptions = useMemo(() => {
    const years = new Set(studentPayments.map((p) => p.academicYear).filter(Boolean));
    if (currentYear) years.add(currentYear);
    return ['All Years', ...[...years].sort((a, b) => String(b).localeCompare(String(a)))];
  }, [studentPayments, currentYear]);

  const fetchStructures = useCallback(async () => {
    try {
      const result = await feeService.getAllFeeStructures();
      setStructures(result.data?.structures || []);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load fee structures';
      toast.error(msg);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStructures();
  }, [fetchStructures]);

  const getFeeStructureForClass = (className) => {
    const feeClass = CLASS_TO_FEE_CLASS[className] || className;
    const active = structures.filter((s) => !s.isDeleted && s.status === 'Active');
    return (
      active.find((s) => s.className === feeClass && s.academicYear === currentYear) ||
      active.find((s) => s.className === feeClass) ||
      null
    );
  };

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setFoundStudent(null);
      setSearchResults([]);
      setHasSearched(false);
      setStudentPayments([]);
      setPaymentHistory([]);
      setPaymentsLoading(false);
      return;
    }

    setSearching(true);
    setStudentPayments([]);
    setPaymentHistory([]);
    setPaymentsLoading(true);
    try {
      const result = await studentService.getAllStudents({ search: q, status: 'Active', limit: 50 });
      const students = result.data?.students || [];
      setSearchResults(students);

      if (students.length === 1) {
        setFoundStudent(buildStudentCard(students[0]));
        setSearchResults([]);
      } else {
        setFoundStudent(null);
        if (students.length === 0) setPaymentsLoading(false);
      }

      setHasSearched(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to search students';
      toast.error(msg);
      setFoundStudent(null);
      setSearchResults([]);
      setPaymentsLoading(false);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        if (!cancelled) setSearchResults([]);
        return;
      }
      studentService.getAllStudents({ search: q, status: 'Active', limit: 50 })
        .then((result) => {
          if (!cancelled) setSearchResults(result.data?.students || []);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  const selectSearchResult = (student) => {
    setSearchResults([]);
    setStudentPayments([]);
    setPaymentHistory([]);
    setPaymentsLoading(true);
    setFoundStudent(buildStudentCard(student));
    setHasSearched(true);
    setInputFocused(false);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const showSuggestions = !!searchQuery.trim() && searchResults.length > 0 && (inputFocused || hasSearched);

  useEffect(() => {
    if (!foundStudent) return undefined;

    let cancelled = false;

    feeService.getStudentPayments({ studentId: foundStudent._id })
      .then((res) => {
        if (cancelled) return;
        setStudentPayments((res.data?.payments || []).map(mapPaymentRow));
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err.response?.data?.message || 'Failed to load payment history';
        toast.error(msg);
        setStudentPayments([]);
      })
      .finally(() => {
        if (!cancelled) setPaymentsLoading(false);
      });

    return () => { cancelled = true; };
  }, [foundStudent]);

  useEffect(() => {
    if (!foundStudent) return undefined;

    let cancelled = false;

    const params = { studentId: foundStudent._id };
    if (yearFilter !== 'All Years') params.academicYear = yearFilter;
    if (feeTypeFilter !== 'All Fee Types') params.feeType = feeTypeFilter;
    if (monthFilter !== 'All Months') params.month = monthFilter;

    feeService.getStudentPayments(params)
      .then((res) => {
        if (cancelled) return;
        setPaymentHistory((res.data?.payments || []).map(mapPaymentRow));
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err.response?.data?.message || 'Failed to load payment history';
        toast.error(msg);
        setPaymentHistory([]);
      });

    return () => { cancelled = true; };
  }, [foundStudent, yearFilter, feeTypeFilter, monthFilter]);

  const feeLines = useMemo(() => {
    const lines = new Map();

    for (const payment of studentPayments) {
      const key = `${payment.feeType}::${payment.month || ''}::${payment.exam || ''}`;

      if (!lines.has(key)) {
        lines.set(key, {
          key,
          feeType: payment.feeType,
          month: payment.month,
          exam: payment.exam,
          amount: payment.amount,
          discount: 0,
          fine: 0,
          totalPaid: 0,
        });
      }

      const line = lines.get(key);
      line.discount += payment.discount;
      line.fine += payment.fine;
      line.totalPaid += payment.totalPaid;
    }

    for (const line of lines.values()) {
      line.remaining = Math.max(0, line.amount - line.totalPaid + line.fine - line.discount);
      line.status = line.remaining > 0 ? 'Partial' : 'Paid';
    }

    return Array.from(lines.values());
  }, [studentPayments]);

  const structureForStudent = getFeeStructureForClass(foundStudent?.class);
  const monthlyTotal = (structureForStudent?.monthlyFee || 0) * 12;
  const admissionTotal = structureForStudent?.admissionFee || 0;
  const examTotal = (structureForStudent?.examFee || 0) * 3;

  const monthlyLines = feeLines.filter((l) => l.feeType === 'Monthly Fee');
  const admissionLines = feeLines.filter((l) => l.feeType === 'Admission Fee');
  const examLines = feeLines.filter((l) => l.feeType === 'Examination Fee');
  const monthlyPaid = monthlyLines.reduce((sum, l) => sum + l.totalPaid, 0);
  const monthlyDue = monthlyLines.reduce((sum, l) => sum + l.remaining, 0);
  const admissionPaid = admissionLines.reduce((sum, l) => sum + l.totalPaid, 0);
  const admissionDue = admissionLines.reduce((sum, l) => sum + l.remaining, 0);
  const examPaid = examLines.reduce((sum, l) => sum + l.totalPaid, 0);
  const examDue = examLines.reduce((sum, l) => sum + l.remaining, 0);
  const totalPaid = monthlyPaid + admissionPaid + examPaid;
  const totalRemaining = monthlyDue + admissionDue + examDue;

  const handleViewReceipt = (item) => {
    setReceiptItem(item);
    setShowReceiptModal(true);
  };

  const handlePrint = () => {
    const receiptEl = document.getElementById('thermal-receipt');
    if (!receiptEl) return;
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${receiptItem?.id || ''}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0 auto; padding: 10px 12px; color: #000; background: #fff; }
          .receipt-header { text-align: center; margin-bottom: 8px; }
          .receipt-header img { width: 40px; height: 40px; object-fit: contain; margin-bottom: 4px; }
          .receipt-header .school-name { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; }
          .receipt-header .school-sub { font-size: 9px; color: #555; margin-top: 1px; }
          .receipt-title { text-align: center; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin: 8px 0 6px; }
          .sep { border: none; border-top: 1px dashed #000; margin: 6px 0; }
          .sep-solid { border: none; border-top: 1px solid #000; margin: 6px 0; }
          .info-row { display: flex; justify-content: space-between; font-size: 10px; line-height: 1.7; }
          .info-row .label { color: #444; }
          .info-row .value { font-weight: 600; text-align: right; }
          .section-title { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; margin: 8px 0 4px; }
          .fee-row { display: flex; justify-content: space-between; font-size: 10px; line-height: 1.7; }
          .fee-row .label { color: #444; }
          .fee-row .value { font-weight: 500; text-align: right; }
          .total-row { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; line-height: 1.8; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; }
          .paid-row { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; line-height: 1.8; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; }
          .receipt-footer { text-align: center; margin-top: 10px; font-size: 9px; color: #555; }
          .receipt-footer .thanks { font-size: 10px; font-weight: 600; color: #000; margin-bottom: 2px; }
          .sig-stamp { display: flex; justify-content: space-between; align-items: flex-end; margin: 10px 0; }
          .sig-stamp .sig-stamp-item { text-align: center; flex: 1; }
          .sig-stamp img { height: 32px; object-fit: contain; margin-bottom: 4px; }
          .sig-stamp .placeholder { height: 32px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 4px; }
          .sig-stamp .placeholder .line { border-bottom: 1px solid #888; width: 80px; }
          .sig-stamp .placeholder .stamp-circle { width: 32px; height: 32px; border: 1px dashed #888; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #888; text-align: center; line-height: 1.2; }
          .sig-stamp .sig-stamp-label { font-size: 8px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
        </style>
      </head>
      <body>
        ${receiptEl.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  const getShowMonth = () => feeTypeFilter === 'All Fee Types' || feeTypeFilter === 'Monthly Fee' || feeTypeFilter === 'Admission Fee';
  const getShowExam = () => feeTypeFilter === 'All Fee Types' || feeTypeFilter === 'Examination Fee';

  const paymentColumns = [
    { key: 'id', label: 'Receipt No.' },
    { key: 'feeType', label: 'Fee Type' },
  ];

  if (getShowMonth()) {
    paymentColumns.push({ key: 'month', label: 'Month' });
  }
  if (getShowExam()) {
    paymentColumns.push({ key: 'exam', label: 'Exam' });
  }

  paymentColumns.push(
    { key: 'amount', label: 'Amount' },
    { key: 'discount', label: 'Discount' },
    { key: 'fine', label: 'Fine' },
    { key: 'totalPaid', label: 'Paid' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Date' },
    { key: 'actions', label: 'Action', className: 'text-right' },
  );

  const renderPaymentRow = (item) => (
    <>
      <td className="px-4 py-3 font-mono text-xs font-medium text-blue-600 dark:text-blue-400">{item.id}</td>
      <td className="px-4 py-3 text-sm">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          item.feeType === 'Monthly Fee' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
          item.feeType === 'Admission Fee' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
        }`}>
          {item.feeType}
        </span>
      </td>
      {getShowMonth() && (
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.month || '-'}</td>
      )}
      {getShowExam() && (
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{item.exam || '-'}</td>
      )}
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{formatCurrency(item.amount)}</td>
      <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400">{item.discount > 0 ? formatCurrency(item.discount) : '-'}</td>
      <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{item.fine > 0 ? formatCurrency(item.fine) : '-'}</td>
      <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(item.totalPaid)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          item.status === 'Paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
        }`}>{item.status}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{item.date}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => handleViewReceipt(item)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer shadow-sm"
        >
          View
        </button>
      </td>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Student Fee Details</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Search for a student to view their complete fee details and payment history</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3 max-w-lg">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Student ID or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setTimeout(() => setInputFocused(false), 150)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                {searchResults.map((s) => (
                  <button
                    key={s._id}
                    type="button"
                    onMouseDown={() => selectSearchResult(s)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {getInitials(s.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{s.fullName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Father: {s.fatherName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{s.studentId}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{s.class}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {hasSearched && !foundStudent && searchResults.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <UserIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">No student found matching your search.</p>
        </div>
      )}

      {foundStudent && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Student Information</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ring-2 ring-blue-200 dark:ring-blue-900">
                {getInitials(foundStudent.name)}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 flex-1 text-sm">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student Name</p>
                  <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">{foundStudent.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Student ID</p>
                  <p className="mt-0.5 font-semibold text-gray-900 dark:text-white font-mono">{foundStudent.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Father Name</p>
                  <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">{foundStudent.fatherName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class</p>
                  <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">{foundStudent.class}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gender</p>
                  <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">{foundStudent.gender}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Father Phone</p>
                  <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">{foundStudent.fatherPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admission Date</p>
                  <p className="mt-0.5 font-semibold text-gray-900 dark:text-white">{foundStudent.admissionDate}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <CurrencyDollarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Yearly Fee</p>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Total</span><span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(monthlyTotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Paid</span><span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(monthlyPaid)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Remaining</span><span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(monthlyDue)}</span></div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CurrencyDollarIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admission Fee</p>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Total</span><span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(admissionTotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Paid</span><span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(admissionPaid)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Remaining</span><span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(admissionDue)}</span></div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <CurrencyDollarIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                </div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Exam Fee</p>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Total</span><span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(examTotal)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Paid</span><span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(examPaid)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Remaining</span><span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(examDue)}</span></div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <CurrencyDollarIcon className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Paid</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <ClockIcon className="h-5 w-5" />
                <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Remaining</p>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalRemaining)}</p>
            </div>
          </div>

          {(() => {
            const studentDues = feeLines
              .filter((line) => line.remaining > 0)
              .map((line) => ({
                id: `${line.feeType}-${line.month || ''}-${line.exam || ''}`,
                feeType: line.feeType,
                month: line.month,
                exam: line.exam,
                totalPaid: line.totalPaid,
                remaining: line.remaining,
                status: line.totalPaid <= 0 ? 'Unpaid' : 'Partial',
              }));
            const totalPreviousDues = studentDues.reduce((sum, d) => sum + d.remaining, 0);
            if (studentDues.length === 0) return null;
            return (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-orange-200 dark:border-orange-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <ClockIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Previous Outstanding Dues</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Outstanding</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(totalPreviousDues)}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Fee Type</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Month/Exam</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Paid</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Remaining</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {studentDues.map((d) => (
                        <tr key={d.id} className="bg-white dark:bg-gray-800/50">
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              d.feeType === 'Monthly Fee' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                              d.feeType === 'Admission Fee' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            }`}>{d.feeType}</span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{d.month}{d.exam ? ` / ${d.exam}` : ''}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(d.totalPaid)}</td>
                          <td className="px-3 py-2 text-sm font-bold text-red-600 dark:text-red-400 text-right">{formatCurrency(d.remaining)}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              d.status === 'Partial' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                              'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}>{d.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Current Month Due: </span>
                    <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(totalRemaining)}</span>
                    <span className="text-gray-400 mx-2">|</span>
                    <span className="text-gray-500 dark:text-gray-400">Previous Outstanding: </span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(totalPreviousDues)}</span>
                    <span className="text-gray-400 mx-2">|</span>
                    <span className="text-gray-500 dark:text-gray-400">Total: </span>
                    <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(totalRemaining + totalPreviousDues)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Payment History</h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select
                value={feeTypeFilter}
                onChange={(e) => setFeeTypeFilter(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                {FEE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                {ALL_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {paymentsLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Loading payment history...</p>
            ) : (
              <Table columns={paymentColumns} data={paymentHistory} renderRow={renderPaymentRow} />
            )}
          </div>
        </>
      )}

      <Modal isOpen={showReceiptModal} onClose={() => { setShowReceiptModal(false); setReceiptItem(null); }} title="Fee Receipt" maxWidth="max-w-sm">
        {receiptItem && (
          <div className="flex flex-col items-center">
            <div id="thermal-receipt" className="w-[280px] bg-white text-black p-3 font-mono text-[10px] leading-tight">
              <div className="receipt-header text-center mb-2">
                {schoolInfo.logo ? (
                  <img src={schoolInfo.logo} alt="School Logo" className="w-10 h-10 object-contain mx-auto mb-1" />
                ) : (
                  <div className="w-10 h-10 rounded-full border border-black flex items-center justify-center mx-auto mb-1 text-xs font-bold">
                    {schoolInfo.name ? schoolInfo.name.charAt(0) : 'S'}
                  </div>
                )}
                <div className="text-[13px] font-bold tracking-wide">{schoolInfo.name || 'School Name'}</div>
                {schoolInfo.address && <div className="text-[9px] text-gray-600 mt-0.5">{schoolInfo.address}{schoolInfo.city ? `, ${schoolInfo.city}` : ''}</div>}
              </div>

              <div className="text-[12px] font-bold tracking-widest text-center my-2">FEE RECEIPT</div>
              <hr className="sep" />

              <div className="space-y-0">
                <div className="info-row"><span className="label">Receipt No:</span><span className="value">{receiptItem.id}</span></div>
                <div className="info-row"><span className="label">Date:</span><span className="value">{receiptItem.date}</span></div>
                <hr className="sep" />
                <div className="info-row"><span className="label">Student:</span><span className="value">{receiptItem.studentName}</span></div>
                <div className="info-row"><span className="label">Student ID:</span><span className="value">{receiptItem.studentId}</span></div>
                <div className="info-row"><span className="label">Father Name:</span><span className="value">{foundStudent?.fatherName || '-'}</span></div>
                <div className="info-row"><span className="label">Class:</span><span className="value">{foundStudent?.class || '-'}</span></div>
              </div>

              <hr className="sep" />
              <div className="section-title">FEE DETAILS</div>
              <hr className="sep-solid" />

              <div className="space-y-0">
                <div className="fee-row"><span className="label">Fee Type:</span><span className="value">{receiptItem.feeType}</span></div>
                {receiptItem.feeType === 'Monthly Fee' && receiptItem.month && (
                  <div className="fee-row"><span className="label">Month:</span><span className="value">{receiptItem.month}</span></div>
                )}
                {receiptItem.feeType === 'Admission Fee' && receiptItem.month && (
                  <div className="fee-row"><span className="label">Month:</span><span className="value">{receiptItem.month}</span></div>
                )}
                {receiptItem.feeType === 'Examination Fee' && (
                  <>
                    {receiptItem.month && <div className="fee-row"><span className="label">Month:</span><span className="value">{receiptItem.month}</span></div>}
                    {receiptItem.exam && <div className="fee-row"><span className="label">Exam:</span><span className="value">{receiptItem.exam}</span></div>}
                  </>
                )}
                <div className="fee-row"><span className="label">Original Fee:</span><span className="value">{formatCurrency(receiptItem.amount)}</span></div>
                {receiptItem.discount > 0 && <div className="fee-row"><span className="label">Discount:</span><span className="value">- {formatCurrency(receiptItem.discount)}</span></div>}
                {receiptItem.fine > 0 && <div className="fee-row"><span className="label">Fine:</span><span className="value">+ {formatCurrency(receiptItem.fine)}</span></div>}
                <div className="paid-row"><span>AMOUNT PAID:</span><span>{formatCurrency(receiptItem.totalPaid)}</span></div>
                <div className="fee-row"><span className="label">Remaining:</span><span className="value font-bold">{formatCurrency(receiptItem.remaining)}</span></div>
                <div className="fee-row"><span className="label">Payment Method:</span><span className="value">{receiptItem.paymentMethod}</span></div>
              </div>

              <hr className="sep" />

              <div className="sig-stamp">
                <div className="sig-stamp-item">
                  {branding.signature ? (
                    <img src={branding.signature} alt="Principal Signature" />
                  ) : (
                    <div className="placeholder">
                      <div className="line"></div>
                    </div>
                  )}
                  <div className="sig-stamp-label">Principal Signature</div>
                </div>
                <div className="sig-stamp-item">
                  {branding.stamp ? (
                    <img src={branding.stamp} alt="School Stamp" />
                  ) : (
                    <div className="placeholder">
                      <div className="stamp-circle">School<br/>Stamp</div>
                    </div>
                  )}
                  <div className="sig-stamp-label">School Stamp</div>
                </div>
              </div>

              <hr className="sep" />
              <div className="receipt-footer">
                <div className="thanks">Thank You</div>
                <hr className="sep-solid mt-1" />
              </div>
            </div>

            <div className="flex gap-3 pt-4 w-full">
              <Button variant="secondary" onClick={() => { setShowReceiptModal(false); setReceiptItem(null); }} className="flex-1">Close</Button>
              <Button onClick={handlePrint} className="flex items-center justify-center gap-2 flex-1">
                <PrinterIcon className="h-4 w-4" /> Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentFeeDetails;