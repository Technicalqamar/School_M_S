import { BanknotesIcon } from '@heroicons/react/24/outline';
import StatCard from '../../../common/StatCard/StatCard';
import Table from '../../../common/Table/Table';
import Spinner from '../../../common/Spinner/Spinner';
import { EmptyState } from '../shared';
import { formatCurrency, formatDate } from '../helpers';

const periodLabel = (line) => {
  if (line.exam) return line.exam;
  return line.feeType === 'Monthly Fee' ? line.month : 'Admission';
};

const FeesTab = ({ feeReport, payments = [], feeLoading = false, feeError = '' }) => {
  if (feeLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" className="text-blue-600" />
      </div>
    );
  }

  const hasReport = Boolean(feeReport);

  if (!hasReport && payments.length === 0) {
    return (
      <EmptyState
        icon={BanknotesIcon}
        title="Fee information not available yet"
        message={feeError || 'No fee data is currently available for this student.'}
      />
    );
  }

  const breakdown = feeReport?.breakdown || [];
  const report = feeReport;

  const breakdownColumns = [
    { key: 'feeType', label: 'Fee Type' },
    { key: 'period', label: 'Period' },
    { key: 'expected', label: 'Amount', className: 'text-right' },
    { key: 'paid', label: 'Paid', className: 'text-right' },
    { key: 'discount', label: 'Discount', className: 'text-right' },
    { key: 'fine', label: 'Fine', className: 'text-right' },
    { key: 'due', label: 'Due', className: 'text-right' },
    { key: 'status', label: 'Status' },
  ];

  const renderBreakdownRow = (line) => (
    <>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{line.feeType}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{periodLabel(line)}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(line.expected)}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(line.paid)}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(line.discount)}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(line.fine)}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(line.due)}</td>
      <td className="px-4 py-3 text-sm">
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
          line.status === 'Paid'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : line.status === 'Partially Paid'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        }`}>
          {line.status}
        </span>
      </td>
    </>
  );

  const paymentColumns = [
    { key: 'receiptId', label: 'Receipt' },
    { key: 'paymentDate', label: 'Date' },
    { key: 'feeType', label: 'Fee Type' },
    { key: 'period', label: 'Period' },
    { key: 'method', label: 'Method' },
    { key: 'amountPaid', label: 'Paid', className: 'text-right' },
    { key: 'discount', label: 'Discount', className: 'text-right' },
    { key: 'lateFine', label: 'Fine', className: 'text-right' },
    { key: 'remainingAmount', label: 'Remaining', className: 'text-right' },
  ];

  const paymentPeriod = (p) => {
    if (p.feeType === 'Monthly') return p.month || '-';
    if (p.feeType === 'Examination') return p.exam || '-';
    return 'Admission';
  };

  const renderPaymentRow = (payment) => (
    <>
      <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-300">{payment.receiptId}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(payment.paymentDate)}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
        {payment.feeType === 'Monthly' ? 'Monthly Fee' : payment.feeType === 'Examination' ? 'Examination Fee' : 'Admission Fee'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{paymentPeriod(payment)}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{payment.paymentMethod || '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(payment.amountPaid)}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(payment.discount)}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(payment.lateFine)}</td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{formatCurrency(payment.remainingAmount)}</td>
    </>
  );

  return (
    <div className="space-y-6">
      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BanknotesIcon} label="Total Expected" value={formatCurrency(report.totalExpected)} color="blue" />
          <StatCard icon={BanknotesIcon} label="Total Paid" value={formatCurrency(report.totalPaid)} color="green" />
          <StatCard icon={BanknotesIcon} label="Outstanding" value={formatCurrency(report.totalDue)} color="red" />
          <StatCard icon={BanknotesIcon} label="Transactions" value={report.totalTransactions} color="yellow" />
        </div>
      )}

      {report && breakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 uppercase tracking-wider">Fee Breakdown</h3>
          <Table columns={breakdownColumns} data={breakdown} renderRow={renderBreakdownRow} />
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 uppercase tracking-wider">Payment History</h3>
        {payments.length === 0 ? (
          <EmptyState
            icon={BanknotesIcon}
            title="No payment records yet"
            message="Payment receipts for this student will appear here."
          />
        ) : (
          <Table columns={paymentColumns} data={payments} renderRow={renderPaymentRow} />
        )}
      </div>
    </div>
  );
};

export default FeesTab;