import { useState, useMemo, useEffect, useCallback } from 'react';
import { PrinterIcon, CurrencyRupeeIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Table from '../../common/Table/Table';
import Button from '../../common/Button/Button';
import Modal from '../../common/Modal/Modal';
import Input from '../../common/Input/Input';
import SelectInput from '../../common/SelectInput/SelectInput';
import feeService from '../../../services/fee/fee.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Online Payment'];

const formatCurrency = (val) => `Rs. ${Number(val || 0).toLocaleString()}`;

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
};

const OutstandingDues = () => {
  const { schoolInfo } = useSchoolConfig();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchStudentId, setSearchStudentId] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [showBillModal, setShowBillModal] = useState(false);
  const [billDues, setBillDues] = useState([]);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payDue, setPayDue] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDiscount, setPayDiscount] = useState('');
  const [payFine, setPayFine] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [payErrors, setPayErrors] = useState({});

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const [studentsWithDues, setStudentsWithDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    feeService.getOutstandingDues()
      .then((res) => {
        if (cancelled) return;
        setStudentsWithDues(res.data?.entries || []);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.response?.data?.message || 'Failed to load outstanding dues');
        setStudentsWithDues([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshDues = useCallback(async () => {
    try {
      const res = await feeService.getOutstandingDues();
      const entries = res.data?.entries || [];
      setStudentsWithDues(entries);

      setSelectedStudent((current) => {
        if (!current) return current;
        const updated = entries.find((entry) => entry.studentId === current.studentId);
        return updated || null;
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to refresh outstanding dues');
    }
  }, []);

  const filteredStudents = useMemo(() => {
    if (!hasSearched || !searchStudentId.trim()) return studentsWithDues;
    const q = searchStudentId.trim().toLowerCase();

    return studentsWithDues.filter((entry) => {
      const idMatches = (entry.studentId || '').toLowerCase() === q;
      const nameMatches = (entry.studentName || '').toLowerCase().includes(q);
      const fatherMatches = (entry.student?.fatherName || '').toLowerCase().includes(q);
      return idMatches || nameMatches || fatherMatches;
    });
  }, [studentsWithDues, searchStudentId, hasSearched]);

  const handleSearch = () => {
    const q = searchStudentId.trim();
    if (!q) {
      setHasSearched(false);
      return;
    }
    setHasSearched(true);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const clearSearch = () => {
    setSearchStudentId('');
    setHasSearched(false);
  };

  const selectStudent = (entry) => {
    setSelectedStudent(entry);
  };

  const totalOutstanding = selectedStudent
    ? selectedStudent.dues.reduce((sum, d) => sum + d.remaining, 0)
    : 0;

  const openPayModal = (due) => {
    setPayDue(due);
    setPayAmount('');
    setPayDiscount('');
    setPayFine('');
    setPayMethod('');
    setPayErrors({});
    setShowPayModal(true);
  };

  const closePayModal = () => {
    setShowPayModal(false);
    setPayDue(null);
    setPayAmount('');
    setPayDiscount('');
    setPayFine('');
    setPayMethod('');
    setPayErrors({});
  };

  const validatePay = () => {
    const errs = {};
    if (!payAmount || Number(payAmount) <= 0) errs.amount = 'Enter a valid amount';
    if (Number(payAmount) > payDue.remaining) errs.amount = 'Amount cannot exceed remaining dues';
    if (!payMethod) errs.method = 'Select a payment method';
    setPayErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePayDue = async () => {
    if (!validatePay()) return;

    const paidAmount = Number(payAmount);
    const discount = Number(payDiscount || 0);
    const fine = Number(payFine || 0);
    const student = selectedStudent.student;

    setPaying(true);

    try {
      const res = await feeService.collectFee({
        studentId: student._id,
        feeType: payDue.feeType,
        month: payDue.month,
        exam: payDue.exam || null,
        discount,
        lateFine: fine,
        amountPaid: paidAmount,
        paymentMethod: payMethod,
      });

      const payment = res?.data?.payment || {};

      const receipt = {
        id: payment.receiptId || `DUE-REC-${Date.now()}`,
        date: new Date(payment.paymentDate || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        studentId: payment.studentId || student.id,
        studentName: payment.studentName || student.name,
        fatherName: payment.fatherName || student.fatherName,
        className: payment.className || student.class,
        feeType: payDue.feeType,
        month: payDue.month,
        exam: payDue.exam,
        originalAmount: Number(payment.baseAmount) || payDue.amount,
        discount: Number(payment.discount) || discount,
        fine: Number(payment.lateFine) || fine,
        totalPayable: Number(payment.totalPayable) || (payDue.amount - discount + fine),
        amountPaid: Number(payment.amountPaid) || paidAmount,
        remaining: payment.remainingAmount !== undefined && payment.remainingAmount !== null
          ? Math.max(0, Number(payment.remainingAmount))
          : Math.max(0, payDue.remaining - paidAmount),
        paymentMethod: payment.paymentMethod || payMethod,
        paymentAgainst: `Previous Due (${payDue.feeType} - ${payDue.month}${payDue.exam ? ` / ${payDue.exam}` : ''})`,
      };

      setReceiptData(receipt);
      setShowReceiptModal(true);
      closePayModal();
      toast.success(`Payment of ${formatCurrency(paidAmount)} recorded against previous due`);

      await refreshDues();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const openBillModal = () => {
    setBillDues(selectedStudent.dues.filter((d) => d.remaining > 0));
    setShowBillModal(true);
  };

  const handlePrintBill = () => {
    const billEl = document.getElementById('dues-bill');
    if (!billEl) return;
    const win = window.open('', '_blank', 'width=400,height=700');
    win.document.write(`<!DOCTYPE html><html><head><title>Outstanding Dues Statement</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',Courier,monospace;width:280px;margin:0 auto;padding:10px 12px;color:#000;background:#fff}
      .hdr{text-align:center;margin-bottom:8px}
      .hdr img{width:40px;height:40px;object-fit:contain;margin-bottom:4px}
      .hdr .sn{font-size:13px;font-weight:700;letter-spacing:.5px}
      .hdr .sa{font-size:9px;color:#555;margin-top:1px}
      .title{text-align:center;font-size:12px;font-weight:700;letter-spacing:1px;margin:8px 0 6px}
      .sep{border:none;border-top:1px dashed #000;margin:6px 0}
      .sep-s{border:none;border-top:1px solid #000;margin:6px 0}
      .row{display:flex;justify-content:space-between;font-size:10px;line-height:1.7}
      .row .l{color:#444}.row .v{font-weight:600;text-align:right}
      .sec{font-size:10px;font-weight:700;letter-spacing:.5px;margin:8px 0 4px}
      .tbl{width:100%;border-collapse:collapse;font-size:9px;margin-top:4px}
      .tbl th,.tbl td{padding:3px 2px;border-bottom:1px solid #ddd;text-align:left}
      .tbl th{font-weight:700;border-top:1px solid #000;border-bottom:1px solid #000}
      .tbl td:last-child,.tbl th:last-child{text-align:right}
      .tot{display:flex;justify-content:space-between;font-size:12px;font-weight:700;line-height:1.8;border-top:1px solid #000;margin-top:6px;padding-top:4px}
      .ftr{text-align:center;margin-top:10px;font-size:9px;color:#555}
      .ftr .thx{font-size:10px;font-weight:600;color:#000;margin-bottom:2px}
    </style></head><body>${billEl.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const tableColumns = [
    { key: 'student', label: 'Student', className: 'w-[280px]' },
    { key: 'fatherName', label: 'Father Name' },
    { key: 'class', label: 'Class' },
    { key: 'outstanding', label: 'Outstanding Amount', className: 'text-right' },
    { key: 'actions', label: 'Action', className: 'text-right' },
  ];

  const renderRow = (entry) => (
    <>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {getInitials(entry.student.name)}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{entry.student.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{entry.student.id}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{entry.student.fatherName}</td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{entry.student.class}</td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-bold text-red-600 dark:text-red-400">
          {formatCurrency(entry.totalOutstanding)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => selectStudent(entry)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer shadow-sm"
        >
          View Dues
        </button>
      </td>
    </>
  );

  const duesColumns = [
    { key: 'feeType', label: 'Fee Type' },
    { key: 'month', label: 'Month/Exam' },
    { key: 'amount', label: 'Original Amount', className: 'text-right' },
    { key: 'totalPaid', label: 'Paid', className: 'text-right' },
    { key: 'remaining', label: 'Remaining', className: 'text-right' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Action', className: 'text-right' },
  ];

  const renderDuesRow = (due) => (
    <>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          due.feeType === 'Monthly Fee' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
          due.feeType === 'Admission Fee' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
        }`}>{due.feeType}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        {due.month}{due.exam ? ` / ${due.exam}` : ''}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(due.amount)}</td>
      <td className="px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400 text-right">{formatCurrency(due.totalPaid)}</td>
      <td className="px-4 py-3 text-sm font-bold text-red-600 dark:text-red-400 text-right">{formatCurrency(due.remaining)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          due.status === 'Paid' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
          due.status === 'Partial' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        }`}>{due.status}</span>
      </td>
      <td className="px-4 py-3 text-right">
        {due.remaining > 0 && (
          <button
            onClick={() => openPayModal(due)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-all cursor-pointer shadow-sm"
          >
            <CurrencyRupeeIcon className="h-3 w-3" /> Pay
          </button>
        )}
      </td>
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Outstanding Dues</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Students with unpaid or partially paid fee records
        </p>
      </div>

      {!selectedStudent && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          {loading ? (
            <div className="py-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Loading outstanding dues...</p>
            </div>
          ) : studentsWithDues.length === 0 ? (
            <div className="py-12 text-center">
              <ExclamationTriangleIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">No outstanding dues found</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-1 max-w-xs">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by Student ID or Name..."
                    value={searchStudentId}
                    onChange={(e) => setSearchStudentId(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full pl-10 pr-8 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                  {searchStudentId && (
                    <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer shadow-sm whitespace-nowrap"
                >
                  Search
                </button>
              </div>

              {hasSearched && filteredStudents.length === 0 ? (
                <div className="py-8 text-center">
                  <ExclamationTriangleIcon className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No student found matching "{searchStudentId}"</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} with outstanding dues
                  </p>
                  <Table columns={tableColumns} data={filteredStudents} renderRow={renderRow} />
                </>
              )}
            </>
          )}
        </div>
      )}

      {selectedStudent && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Outstanding Dues</h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer"
                >
                  Back to List
                </button>
                {selectedStudent.dues.filter((d) => d.remaining > 0).length > 0 && (
                  <button
                    onClick={openBillModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transition-all cursor-pointer shadow-sm"
                  >
                    <PrinterIcon className="h-3.5 w-3.5" /> Generate Dues Bill
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                {getInitials(selectedStudent.student.name)}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedStudent.student.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{selectedStudent.student.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Father</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedStudent.student.fatherName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedStudent.student.class}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Outstanding</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalOutstanding)}</p>
              </div>
            </div>

            <Table columns={duesColumns} data={selectedStudent.dues} renderRow={renderDuesRow} />
          </div>
        </>
      )}

      {/* Generate Dues Bill Modal */}
      <Modal isOpen={showBillModal} onClose={() => setShowBillModal(false)} title="Outstanding Dues Statement" maxWidth="max-w-sm">
        <div className="flex flex-col items-center">
          <div id="dues-bill" className="w-[280px] bg-white text-black p-3 font-mono text-[10px] leading-tight">
            <div className="text-center mb-2">
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

            <div className="text-[12px] font-bold tracking-widest text-center my-2">OUTSTANDING DUES STATEMENT</div>
            <hr className="sep" />

            <div className="space-y-0">
              <div className="row"><span className="l">Student:</span><span className="v">{selectedStudent?.student.name}</span></div>
              <div className="row"><span className="l">Student ID:</span><span className="v">{selectedStudent?.student.id}</span></div>
              <div className="row"><span className="l">Father Name:</span><span className="v">{selectedStudent?.student.fatherName}</span></div>
              <div className="row"><span className="l">Class:</span><span className="v">{selectedStudent?.student.class}</span></div>
              <div className="row"><span className="l">Statement Date:</span><span className="v">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
            </div>

            <hr className="sep" />
            <div className="sec">OUTSTANDING DUES</div>
            <hr className="sep-s" />

            <table className="tbl">
              <thead>
                <tr>
                  <th>Fee Type</th>
                  <th>Month/Exam</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {billDues.map((d) => (
                  <tr key={d.id}>
                    <td>{d.feeType}</td>
                    <td>{d.month}{d.exam ? `/${d.exam}` : ''}</td>
                    <td>{formatCurrency(d.amount)}</td>
                    <td>{formatCurrency(d.totalPaid)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(d.remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="tot">
              <span>TOTAL OUTSTANDING:</span>
              <span>{formatCurrency(billDues.reduce((s, d) => s + d.remaining, 0))}</span>
            </div>

            <hr className="sep" />
            <div className="ftr">
              <div className="thx">Thank You</div>
              <div>This is a dues statement, not a payment receipt.</div>
              <hr className="sep-s mt-1" />
            </div>
          </div>

          <div className="flex gap-3 pt-4 w-full">
            <Button variant="secondary" onClick={() => setShowBillModal(false)} className="flex-1">Close</Button>
            <Button onClick={handlePrintBill} className="flex items-center justify-center gap-2 flex-1">
              <PrinterIcon className="h-4 w-4" /> Print Statement
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pay Due Modal */}
      <Modal isOpen={showPayModal} onClose={closePayModal} title="Payment Against Previous Due" maxWidth="max-w-md">
        {payDue && (
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 border border-orange-200 dark:border-orange-800">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Payment Against Previous Outstanding Due</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{payDue.feeType} - {payDue.month}{payDue.exam ? ` / ${payDue.exam}` : ''}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Remaining: {formatCurrency(payDue.remaining)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Amount Paid"
                name="amount"
                type="number"
                value={payAmount}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) { setPayAmount(v); if (payErrors.amount) setPayErrors((p) => ({ ...p, amount: '' })); } }}
                placeholder="0"
                required
                error={payErrors.amount}
              />
              <Input
                label="Discount"
                name="discount"
                type="number"
                value={payDiscount}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setPayDiscount(v); }}
                placeholder="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Fine"
                name="fine"
                type="number"
                value={payFine}
                onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setPayFine(v); }}
                placeholder="0"
              />
              <SelectInput
                label="Payment Method"
                name="paymentMethod"
                value={payMethod}
                onChange={(e) => { setPayMethod(e.target.value); if (payErrors.method) setPayErrors((p) => ({ ...p, method: '' })); }}
                options={PAYMENT_METHODS}
                placeholder="Select method"
                required
              />
            </div>
            {payErrors.method && <p className="text-xs text-red-600 dark:text-red-400 -mt-2">{payErrors.method}</p>}

            {payAmount && Number(payAmount) > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Remaining After Payment</span>
                  <span className={`font-bold ${payDue.remaining - Number(payAmount) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCurrency(Math.max(0, payDue.remaining - Number(payAmount)))}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={closePayModal} className="flex-1">Cancel</Button>
              <Button onClick={handlePayDue} disabled={paying} className="flex-1">
                {paying ? 'Processing...' : 'Confirm Payment'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={showReceiptModal} onClose={() => { setShowReceiptModal(false); setReceiptData(null); }} title="Payment Receipt" maxWidth="max-w-sm">
        {receiptData && (
          <div className="flex flex-col items-center">
            <div id="thermal-receipt" className="w-[280px] bg-white text-black p-3 font-mono text-[10px] leading-tight">
              <div className="text-center mb-2">
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
                <div className="row"><span className="l">Receipt No:</span><span className="v">{receiptData.id}</span></div>
                <div className="row"><span className="l">Date:</span><span className="v">{receiptData.date}</span></div>
                <hr className="sep" />
                <div className="row"><span className="l">Student:</span><span className="v">{receiptData.studentName}</span></div>
                <div className="row"><span className="l">Student ID:</span><span className="v">{receiptData.studentId}</span></div>
                <div className="row"><span className="l">Father Name:</span><span className="v">{receiptData.fatherName}</span></div>
                <div className="row"><span className="l">Class:</span><span className="v">{receiptData.className}</span></div>
              </div>

              <hr className="sep" />
              <div className="sec">PAYMENT AGAINST PREVIOUS DUE</div>
              <hr className="sep-s" />

              <div className="space-y-0">
                <div className="row"><span className="l">Fee Type:</span><span className="v">{receiptData.feeType}</span></div>
                {receiptData.month && <div className="row"><span className="l">Month:</span><span className="v">{receiptData.month}</span></div>}
                {receiptData.exam && <div className="row"><span className="l">Exam:</span><span className="v">{receiptData.exam}</span></div>}
                <div className="row"><span className="l">Payment Against:</span><span className="v">{receiptData.paymentAgainst}</span></div>
                <div className="row"><span className="l">Original Fee:</span><span className="v">{formatCurrency(receiptData.originalAmount)}</span></div>
                {receiptData.discount > 0 && <div className="row"><span className="l">Discount:</span><span className="v">- {formatCurrency(receiptData.discount)}</span></div>}
                {receiptData.fine > 0 && <div className="row"><span className="l">Fine:</span><span className="v">+ {formatCurrency(receiptData.fine)}</span></div>}
                <div className="row"><span className="l">Payment Method:</span><span className="v">{receiptData.paymentMethod}</span></div>
              </div>

              <hr className="sep" />
              <div className="paid-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, lineHeight: 1.8, borderTop: '1px dashed #000', marginTop: 4, paddingTop: 4 }}>
                <span>AMOUNT PAID:</span>
                <span>{formatCurrency(receiptData.amountPaid)}</span>
              </div>
              {receiptData.remaining > 0 && (
                <div className="row" style={{ marginTop: 2 }}>
                  <span className="l">Remaining Due:</span>
                  <span className="v" style={{ fontWeight: 700 }}>{formatCurrency(receiptData.remaining)}</span>
                </div>
              )}

              <hr className="sep" />
              <div className="text-center mt-2 text-[9px] text-gray-500">
                <div className="text-[10px] font-semibold text-black mb-1">Thank You</div>
                <hr className="sep-s" />
              </div>
            </div>

            <div className="flex gap-3 pt-4 w-full">
              <Button variant="secondary" onClick={() => { setShowReceiptModal(false); setReceiptData(null); }} className="flex-1">Close</Button>
              <Button onClick={() => {
                const el = document.getElementById('thermal-receipt');
                if (!el) return;
                const win = window.open('', '_blank', 'width=400,height=700');
                win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>
                  *{margin:0;padding:0;box-sizing:border-box}
                  body{font-family:'Courier New',Courier,monospace;width:280px;margin:0 auto;padding:10px 12px;color:#000;background:#fff}
                  .sep{border:none;border-top:1px dashed #000;margin:6px 0}
                  .sep-s{border:none;border-top:1px solid #000;margin:6px 0}
                  .row{display:flex;justify-content:space-between;font-size:10px;line-height:1.7}
                  .row .l{color:#444}.row .v{font-weight:600;text-align:right}
                  .sec{font-size:10px;font-weight:700;letter-spacing:.5px;margin:8px 0 4px}
                </style></head><body>${el.innerHTML}</body></html>`);
                win.document.close();
                win.focus();
                setTimeout(() => { win.print(); win.close(); }, 300);
              }} className="flex items-center justify-center gap-2 flex-1">
                <PrinterIcon className="h-4 w-4" /> Print Receipt
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OutstandingDues;
