import { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  EyeIcon,
  PrinterIcon,
  SparklesIcon,
  UsersIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import Table from '../../common/Table/Table';
import Button from '../../common/Button/Button';
import Modal from '../../common/Modal/Modal';
import CardSection from '../../common/CardSection/CardSection';
import StatCard from '../../common/StatCard/StatCard';
import SelectInput from '../../common/SelectInput/SelectInput';
import DateInput from '../../common/DateInput/DateInput';
import feeService from '../../../services/fee/fee.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const VOUCHER_CLASSES = [
  'Montessori', 'Nursery', 'KG1', 'KG2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

const VOUCHER_COLUMNS = [
  { key: 'voucherNumber', label: 'Voucher Number' },
  { key: 'studentId', label: 'Student ID' },
  { key: 'studentName', label: 'Student Name' },
  { key: 'className', label: 'Class' },
  { key: 'feeMonth', label: 'Fee Month' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'totalPayable', label: 'Total Payable' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', className: 'text-right' },
];

const formatCurrency = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

const formatDate = (val) => {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const toISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const FeeVoucherGeneration = () => {
  const { academic } = useSchoolConfig();
  const currentAcademicYear = (academic?.currentYear || '').trim();

  const academicYearOptions = useMemo(() => {
    if (!currentAcademicYear) return [];
    const base = Number(currentAcademicYear);
    if (Number.isNaN(base)) return [];
    const options = [String(base)];
    for (let i = 1; i <= 5; i += 1) options.push(String(base - i));
    return options;
  }, [currentAcademicYear]);

  const now = useMemo(() => new Date(), []);
  const currentMonthIndex = now.getMonth();
  const currentMonthName = MONTHS[currentMonthIndex];
  const todayISO = toISODate(now);

  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [yearManuallySelected, setYearManuallySelected] = useState(false);
  const [feeMonth, setFeeMonth] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const [vouchers, setVouchers] = useState([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState({
    classesSelected: 0,
    studentsFound: 0,
    vouchersGenerated: 0,
    alreadyGenerated: 0,
    failed: 0,
  });
  const [resultMessage, setResultMessage] = useState('');
  const [resultType, setResultType] = useState(null);

  const [viewingVoucher, setViewingVoucher] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    if (!yearManuallySelected && currentAcademicYear && academicYear !== currentAcademicYear) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAcademicYear(currentAcademicYear);
    }
  }, [currentAcademicYear, academicYear, yearManuallySelected]);

  const fetchVouchers = useCallback(async () => {
    setVouchersLoading(true);
    try {
      const res = await feeService.getVouchers({ academicYear, month: feeMonth || undefined });
      setVouchers(res.data?.vouchers || []);
    } catch (err) {
      setVouchers([]);
      toast.error(err?.response?.data?.message || 'Failed to load vouchers');
    } finally {
      setVouchersLoading(false);
    }
  }, [academicYear, feeMonth]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVouchers();
  }, [fetchVouchers]);

  const allSelected = VOUCHER_CLASSES.length > 0 && VOUCHER_CLASSES.every((c) => selectedClasses.includes(c));

  const toggleClass = (className) => {
    setSelectedClasses((prev) => (prev.includes(className) ? prev.filter((c) => c !== className) : [...prev, className]));
  };

  const toggleSelectAll = () => {
    setSelectedClasses(allSelected ? [] : [...VOUCHER_CLASSES]);
  };

  const isCurrentYear = Boolean(currentAcademicYear) && academicYear === currentAcademicYear;

  const selectedMonthIndex = MONTHS.indexOf(feeMonth);
  const monthBlocked = feeMonth ? (
    selectedMonthIndex < currentMonthIndex
      ? { message: 'Previous month vouchers cannot be generated. You can only generate vouchers for the current month.' }
      : selectedMonthIndex > currentMonthIndex
        ? { message: 'Future month vouchers cannot be generated yet. You can only generate vouchers for the current month.' }
        : null
  ) : null;

  const dueDateValid = useMemo(() => {
    if (!dueDate) return false;
    const d = new Date(dueDate);
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, [dueDate, now]);

  const canGenerate = Boolean(
    isCurrentYear &&
    selectedClasses.length > 0 &&
    feeMonth === currentMonthName &&
    dueDateValid &&
    !generating
  );

  const handleOpenConfirm = () => {
    setShowConfirm(true);
  };

  const handleConfirmGenerate = async () => {
    if (!canGenerate) return;
    setShowConfirm(false);
    setGenerating(true);
    setResultMessage('');
    setResultType(null);

    try {
      const res = await feeService.generateVouchers({
        classes: selectedClasses,
        month: feeMonth,
        academicYear,
        dueDate,
      });
      const s = res.data?.summary || {};
      const nextSummary = {
        classesSelected: s.classesSelected || 0,
        studentsFound: s.studentsFound || 0,
        vouchersGenerated: s.vouchersGenerated || 0,
        alreadyGenerated: s.alreadyGenerated || 0,
        failed: s.failed || 0,
      };
      setSummary(nextSummary);
      toast.success('Vouchers generated successfully');

      const skipped = (res.data?.skippedClasses || []).length > 0 ? ` (skipped: ${(res.data.skippedClasses).join(', ')})` : '';
      if (nextSummary.vouchersGenerated > 0) {
        setResultMessage(`Vouchers generated successfully — ${nextSummary.vouchersGenerated} voucher(s) for ${feeMonth} ${academicYear}.${skipped}`);
        setResultType('success');
      } else if (nextSummary.failed > 0) {
        setResultMessage(`Vouchers could not be generated for ${nextSummary.failed} student(s) due to conflicts.${skipped}`);
        setResultType('error');
      } else if (nextSummary.alreadyGenerated > 0) {
        setResultMessage(`No new vouchers created — ${nextSummary.alreadyGenerated} student(s) already have a voucher for ${feeMonth} ${academicYear}.${skipped}`);
        setResultType('info');
      } else {
        setResultMessage(`No vouchers created — no eligible students found for the selected classes in ${feeMonth} ${academicYear}.${skipped}`);
        setResultType('info');
      }

      await fetchVouchers();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to generate vouchers';
      setResultMessage(msg);
      setResultType('error');
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleViewVoucher = async (voucherId) => {
    setViewLoading(true);
    try {
      const res = await feeService.getVoucher(voucherId);
      setViewingVoucher(res.data?.voucher || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load voucher');
    } finally {
      setViewLoading(false);
    }
  };

  const handlePrintVoucher = (voucherId) => {
    if (voucherId) handleViewVoucher(voucherId);
  };

  const rows = useMemo(
    () => vouchers.map((v) => ({
      id: v._id || v.voucherId,
      voucherNumber: v.voucherId || v.receiptId || '-',
      studentId: v.studentId || '-',
      studentName: v.studentName || '-',
      className: v.className || '-',
      feeMonth: v.month || '-',
      dueDate: formatDate(v.dueDate),
      totalPayable: formatCurrency(v.totalPayable),
      status: v.voucherStatus || 'Generated',
      raw: v,
    })),
    [vouchers],
  );

  const renderVoucherRow = (row) => (
    <>
      <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{row.voucherNumber}</td>
      <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300">{row.studentId}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.studentName}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.className}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.feeMonth}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.dueDate}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.totalPayable}</td>
      <td className="px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          {row.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1.5">
          <button
            onClick={() => handleViewVoucher(row.raw?.voucherId)}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            title="View Voucher"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handlePrintVoucher(row.raw?.voucherId)}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            title="Print Voucher"
          >
            <PrinterIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </>
  );

  const resultToneClasses =
    resultType === 'success'
      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
      : resultType === 'error'
        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Voucher Generation</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Generate fee vouchers for the current month for selected classes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CardSection title="Generation Settings">
            <SelectInput
              label="Academic Year"
              name="academicYear"
              value={academicYear}
              onChange={(e) => {
                setYearManuallySelected(true);
                setAcademicYear(e.target.value);
              }}
              options={academicYearOptions}
              placeholder="Select year"
              className="mb-4"
            />
            {!isCurrentYear && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-4">
                Historical year selected — previously generated vouchers for this year can only be viewed here. New generation is not allowed.
              </p>
            )}
            <SelectInput
              label="Fee Month"
              name="feeMonth"
              value={feeMonth}
              onChange={(e) => setFeeMonth(e.target.value)}
              options={MONTHS}
              placeholder="Select month"
              className="mb-4"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2 mb-4">
              Only {currentMonthName} ({now.getFullYear()}) can be generated. Past and future month selections are view-only.
            </p>
            {monthBlocked && (
              <p className="text-xs text-red-600 dark:text-red-400 -mt-1 mb-4">{monthBlocked.message}</p>
            )}
            <DateInput
              label="Voucher Due Date"
              name="dueDate"
              value={dueDate}
              min={todayISO}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
              Due date must be a valid date within {currentMonthName} {now.getFullYear()}.
            </p>
            {feeMonth === currentMonthName && dueDate && !dueDateValid && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Due date must be within the current month and not in the past.
              </p>
            )}
          </CardSection>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <CardSection title="Class Selection">
            <div className="flex items-center gap-3 mb-4">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 cursor-pointer"
                />
                Select All
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedClasses.length} of {VOUCHER_CLASSES.length} classes selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {VOUCHER_CLASSES.map((className) => {
                const isChecked = selectedClasses.includes(className);
                return (
                  <label
                    key={className}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleClass(className);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none ${
                      isChecked
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleClass(className)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{className}</span>
                  </label>
                );
              })}
            </div>
          </CardSection>

          <CardSection title="Generate Vouchers">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Button onClick={handleOpenConfirm} disabled={!canGenerate} className="sm:w-auto sm:px-8">
                <SparklesIcon className="h-4 w-4 mr-2" />
                {generating ? 'Generating...' : 'Generate Vouchers'}
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {!isCurrentYear
                  ? 'Historical year selected — new vouchers cannot be generated for this year'
                  : monthBlocked
                    ? monthBlocked.message
                    : selectedClasses.length === 0
                      ? 'Select at least one class to generate vouchers'
                      : !dueDateValid
                        ? 'Select a valid due date within the current month to continue'
                        : `Ready to generate vouchers for ${selectedClasses.length} class${selectedClasses.length !== 1 ? 'es' : ''} for ${feeMonth} ${academicYear}`}
              </p>
            </div>
          </CardSection>
        </div>
      </div>

      <CardSection title="Generation Summary">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard icon={ClipboardDocumentListIcon} label="Classes Selected" value={summary.classesSelected} color="blue" />
          <StatCard icon={UsersIcon} label="Students Found" value={summary.studentsFound} color="blue" />
          <StatCard icon={CheckCircleIcon} label="Vouchers Generated" value={summary.vouchersGenerated} color="green" />
          <StatCard icon={SparklesIcon} label="Already Generated" value={summary.alreadyGenerated} color="yellow" />
          <StatCard icon={XCircleIcon} label="Failed" value={summary.failed} color="red" />
        </div>
        {resultMessage ? (
          <div className={`mt-3 px-4 py-3 rounded-lg border text-sm ${resultToneClasses}`}>{resultMessage}</div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Generation results will appear here after you run a generation.
          </p>
        )}
      </CardSection>

      <CardSection title="Vouchers">
        <div className="mb-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {vouchersLoading
              ? 'Loading vouchers...'
              : vouchers.length > 0
                ? `${vouchers.length} voucher${vouchers.length !== 1 ? 's' : ''} found for ${academicYear}${feeMonth ? ` (${feeMonth})` : ''}.`
                : `No vouchers found for ${academicYear}${feeMonth ? ` (${feeMonth})` : ''}. Generate vouchers for the current month to create them.`}
          </p>
        </div>
        <Table columns={VOUCHER_COLUMNS} data={rows} renderRow={renderVoucherRow} />
      </CardSection>

      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Confirm Voucher Generation" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="mb-3">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">Selected Classes</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedClasses.length === 0 ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400">None</span>
                ) : (
                  selectedClasses.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                    >
                      {c}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Fee Month</span>
                <p className="font-semibold text-gray-900 dark:text-white">{feeMonth || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Due Date</span>
                <p className="font-semibold text-gray-900 dark:text-white">{formatDate(dueDate)}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Academic Year</span>
                <p className="font-semibold text-gray-900 dark:text-white">{academicYear || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Voucher Issued For</span>
                <p className="font-semibold text-gray-900 dark:text-white">{currentMonthName} {now.getFullYear()}</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Eligible students from the selected classes will receive a voucher for {feeMonth} {academicYear}. Students admitted after this month are skipped. Students who already have a voucher for this month are skipped.
          </p>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowConfirm(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleConfirmGenerate} disabled={generating} className="flex-1">
              <BanknotesIcon className="h-4 w-4 mr-2" />
              {generating ? 'Generating...' : 'Confirm & Generate'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(viewingVoucher)} onClose={() => setViewingVoucher(null)} title="Voucher Details" maxWidth="max-w-lg">
        {viewLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading voucher...</p>
        ) : viewingVoucher ? (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Voucher Number</p>
                  <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{viewingVoucher.voucherId || viewingVoucher.receiptId}</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {viewingVoucher.voucherStatus || 'Generated'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Student ID</span>
                  <p className="font-medium text-gray-900 dark:text-white">{viewingVoucher.studentId || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Student Name</span>
                  <p className="font-medium text-gray-900 dark:text-white">{viewingVoucher.studentName || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Class</span>
                  <p className="font-medium text-gray-900 dark:text-white">{viewingVoucher.className || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Fee Month</span>
                  <p className="font-medium text-gray-900 dark:text-white">{viewingVoucher.month || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Academic Year</span>
                  <p className="font-medium text-gray-900 dark:text-white">{viewingVoucher.academicYear || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Due Date</span>
                  <p className="font-medium text-gray-900 dark:text-white">{formatDate(viewingVoucher.dueDate)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Current Fee</span>
                  <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(viewingVoucher.currentFee)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Previous Outstanding</span>
                  <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(viewingVoucher.previousOutstanding)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Total Payable</span>
                  <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(viewingVoucher.totalPayable)}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Issued At</span>
                  <p className="font-medium text-gray-900 dark:text-white">{formatDate(viewingVoucher.generatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Voucher could not be loaded.</p>
        )}
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" onClick={() => setViewingVoucher(null)} className="flex-1">
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default FeeVoucherGeneration;