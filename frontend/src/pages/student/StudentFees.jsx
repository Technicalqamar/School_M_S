import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDaysIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import SearchInput from '../../components/common/SearchInput/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown/FilterDropdown';
import Spinner from '../../components/common/Spinner/Spinner';
import Modal from '../../components/common/Modal/Modal';
import studentFeesService, {
  STUDENT_FEE_TYPES,
  STUDENT_MONTHS,
} from '../../services/student/studentFees.service';
import { useTranslation } from '../../hooks/useLocalization';

const statusBadgeCls = (status) => {
  const map = {
    Paid: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800',
    Unpaid: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800',
    Partial: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
    Pending: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
    Generated: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
    Cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700',
    'Not Applicable': 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600',
    Overdue: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800',
  };
  return map[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700';
};

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-12">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <Icon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value) =>
  value === null || value === undefined ? '—' : `Rs. ${Number(value).toLocaleString()}`;

const DetailRow = ({ label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-4 py-3 border border-gray-100 dark:border-gray-600">
    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{value}</p>
  </div>
);

const OverviewTile = ({ label, value, status }) => (
  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-4 py-3 border border-gray-100 dark:border-gray-600">
    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
    {status ? (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeCls(status)}`}
      >
        {status}
      </span>
    ) : (
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 break-words">{value}</p>
    )}
  </div>
);

const VoucherDetailModal = ({ voucher, loading, onClose, t, handlePrintVoucher, handleDownloadPdf }) => (
  <Modal isOpen={Boolean(voucher)} onClose={onClose} title={t('voucherDetailsTitle')} maxWidth="max-w-2xl">
    {loading && (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-gray-500 dark:text-gray-400">
        <Spinner size="lg" className="text-blue-600" />
        <p className="text-sm">{t('loadingFees')}</p>
      </div>
    )}

    {!loading && voucher && (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{voucher.voucherNumber || '-'}</h3>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeCls(voucher.status)}`}
          >
            {voucher.status || '-'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailRow label={t('academicYear')} value={voucher.academicYear || '-'} />
          <DetailRow label={t('feeMonth')} value={voucher.feeMonth || '-'} />
          <DetailRow label={t('issueDate')} value={formatDate(voucher.issueDate)} />
          <DetailRow label={t('dueDate')} value={formatDate(voucher.dueDate)} />
          <DetailRow label={t('totalPayable')} value={formatCurrency(voucher.totalPayable)} />
          <DetailRow label={t('voucherStatus')} value={voucher.status || '-'} />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => handlePrintVoucher(voucher)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <PrinterIcon className="h-4 w-4" />
            {t('printVoucher')}
          </button>
          <button
            type="button"
            onClick={() => handleDownloadPdf(voucher)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {t('downloadPdf')}
          </button>
        </div>
      </div>
    )}
  </Modal>
);

const ReceiptDetailModal = ({ receipt, loading, onClose, t }) => (
  <Modal isOpen={Boolean(receipt)} onClose={onClose} title={t('receiptDetailsTitle')} maxWidth="max-w-2xl">
    {loading && (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-gray-500 dark:text-gray-400">
        <Spinner size="lg" className="text-blue-600" />
        <p className="text-sm">{t('loadingFees')}</p>
      </div>
    )}

    {!loading && receipt && (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{receipt.receiptId || '-'}</h3>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeCls(receipt.status)}`}
          >
            {receipt.status || '-'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailRow label={t('feeMonth')} value={receipt.feeMonth || '-'} />
          <DetailRow label={t('feeType')} value={receipt.feeTypeLabel || receipt.feeType || '-'} />
          <DetailRow label={t('amount')} value={formatCurrency(receipt.amount)} />
          <DetailRow label={t('paidAmount')} value={formatCurrency(receipt.paidAmount)} />
          <DetailRow label={t('outstandingDueAmount')} value={formatCurrency(receipt.outstanding)} />
          <DetailRow label={t('paymentDate')} value={formatDate(receipt.paymentDate)} />
        </div>
      </div>
    )}
  </Modal>
);

const statusLabel = (status, t) => {
  const map = {
    Paid: 'feeStatusPaid',
    Unpaid: 'feeStatusUnpaid',
    Partial: 'feeStatusPartial',
    'Not Applicable': 'feeStatusNotApplicable',
  };
  return map[status] ? t(map[status]) : status || '-';
};

const StudentFees = () => {
  const { t } = useTranslation();

  const [overview, setOverview] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyYears, setHistoryYears] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [filters, setFilters] = useState({ academicYear: 'All', feeMonth: 'All', feeType: 'All', search: '' });

  const [activeVoucher, setActiveVoucher] = useState(null);
  const [voucherDetail, setVoucherDetail] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [receiptDetail, setReceiptDetail] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const currentYear = new Date().getFullYear();

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set([String(currentYear - 1), String(currentYear), ...historyYears]))
      .sort()
      .reverse();
    return [t('all'), ...years];
  }, [currentYear, historyYears, t]);

  const monthOptions = [t('all'), ...STUDENT_MONTHS];
  const feeTypeOptions = [t('all'), ...STUDENT_FEE_TYPES];

  const loadFees = useCallback(async () => {
    const [overviewResult, vouchersResult] = await Promise.all([
      studentFeesService.getFeeOverview(),
      studentFeesService.getVouchers(),
    ]);
    return {
      overview: overviewResult,
      vouchers: vouchersResult.vouchers || [],
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    loadFees()
      .then((result) => {
        if (!mounted) return;
        setOverview(result.overview);
        setVouchers(result.vouchers);
        setError('');
      })
      .catch((err) => {
        if (mounted) {
          setError(err?.response?.data?.message || t('studentFeesLoadError'));
          toast.error(err?.response?.data?.message || t('studentFeesLoadError'));
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [loadFees, reloadKey, t]);

  useEffect(() => {
    let cancelled = false;

    const delay = setTimeout(() => {
      const params = {};
      if (filters.academicYear !== 'All') params.academicYear = filters.academicYear;
      if (filters.feeMonth !== 'All') params.feeMonth = filters.feeMonth;
      if (filters.feeType !== 'All') params.feeType = filters.feeType;
      if (filters.search.trim()) params.search = filters.search.trim();

      studentFeesService
        .getHistory(params)
        .then((result) => {
          if (cancelled) return;
          setHistory(result.records || []);
          setHistoryYears(result.years || []);
          setError('');
        })
        .catch((err) => {
          if (!cancelled) {
            const message = err?.response?.data?.message || t('studentFeesLoadError');
            setError(message);
            toast.error(message);
          }
        })
        .finally(() => {
          if (!cancelled) setHistoryLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(delay);
    };
  }, [filters, t]);

  const retry = () => {
    setError('');
    setIsLoading(true);
    setReloadKey((k) => k + 1);
  };

  const updateFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setHistoryLoading(true);
    setError('');
  };

  const filtersActive =
    filters.academicYear !== 'All' || filters.feeMonth !== 'All' || filters.feeType !== 'All' || Boolean(filters.search.trim());

  const handlePrintVoucher = () => {
    // Client-side voucher print is wired to the real voucher payload. PDF/file
    // generation is not fabricated: it will follow the (not yet present)
    // backend download architecture during a later phase.
    window.print();
  };

  const handleDownloadPdf = () => {
    // Prepared for backend integration when a PDF endpoint exists:
    // await studentFeesService.downloadVoucherPdf(voucher.id);
  };

  const openVoucher = (voucher) => {
    setActiveVoucher(voucher);
    setVoucherDetail(null);
    setVoucherLoading(true);
    studentFeesService
      .getVoucher(voucher.id)
      .then((data) => setVoucherDetail(data))
      .catch((err) => {
        toast.error(err?.response?.data?.message || t('studentFeesLoadError'));
      })
      .finally(() => setVoucherLoading(false));
  };

  const closeVoucher = () => {
    setActiveVoucher(null);
    setVoucherDetail(null);
    setVoucherLoading(false);
  };

  const openReceipt = (record) => {
    setActiveReceipt(record);
    setReceiptDetail(null);
    setReceiptLoading(true);
    studentFeesService
      .getReceipt(record.id)
      .then((data) => setReceiptDetail(data))
      .catch((err) => {
        toast.error(err?.response?.data?.message || t('studentFeesLoadError'));
      })
      .finally(() => setReceiptLoading(false));
  };

  const closeReceipt = () => {
    setActiveReceipt(null);
    setReceiptDetail(null);
    setReceiptLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{t('fees')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('feeModuleSubtitle')}</p>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
          <Spinner size="lg" className="text-blue-600" />
          <p className="text-sm">{t('loadingFees')}</p>
        </div>
      )}

      {!isLoading && error && (
        <CardSection>
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <EmptyState icon={DocumentDuplicateIcon} title={t('somethingWentWrong')} description={error} />
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              {t('tryAgain')}
            </button>
          </div>
        </CardSection>
      )}

      {!isLoading && !error && (
        <>
          {/* Fee Overview */}
          <CardSection title={t('feeOverview')}>
            {overview ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <OverviewTile label={t('currentAcademicYear')} value={overview.currentAcademicYear || '-'} />
                <OverviewTile label={t('currentMonth')} value={overview.currentMonth || '-'} />
                <OverviewTile label={t('currentFeeAmount')} value={formatCurrency(overview.currentFeeAmount)} />
                <OverviewTile label={t('paidAmount')} value={formatCurrency(overview.paidAmount)} />
                <OverviewTile label={t('outstandingDueAmount')} value={formatCurrency(overview.outstandingAmount)} />
                <OverviewTile label={t('dueDate')} value={formatDate(overview.dueDate)} />
                <OverviewTile label={t('paymentStatus')} status={statusLabel(overview.paymentStatus, t)} />
              </div>
            ) : (
              <EmptyState
                icon={DocumentDuplicateIcon}
                title={t('feeOverviewUnavailableTitle')}
                description={t('noFeeInfo')}
              />
            )}
          </CardSection>

          {/* Fee Vouchers */}
          <CardSection title={t('feeVoucher')}>
            {vouchers.length === 0 ? (
              <EmptyState icon={DocumentDuplicateIcon} title={t('noVouchersTitle')} description={t('noVouchersDescription')} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {vouchers.map((voucher) => (
                  <article
                    key={voucher.id || voucher.voucherNumber}
                    className="bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white break-all">{voucher.voucherNumber || '-'}</h3>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeCls(voucher.status)}`}
                      >
                        {voucher.status || '-'}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <CalendarDaysIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span>
                          <span className="font-medium text-gray-700 dark:text-gray-200">{t('academicYear')}:</span>{' '}
                          {voucher.academicYear || '-'} &bull; {t('feeMonth')}: {voucher.feeMonth || '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDaysIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span>
                          <span className="font-medium text-gray-700 dark:text-gray-200">{t('issueDate')}:</span>{' '}
                          {formatDate(voucher.issueDate)} &bull; {t('dueDate')}: {formatDate(voucher.dueDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700 dark:text-gray-200">{t('totalPayable')}:</span>{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(voucher.totalPayable)}</span>
                      </div>
                    </div>

                    <div className="mt-auto pt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openVoucher(voucher)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        {t('viewVoucher')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintVoucher(voucher)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        <PrinterIcon className="h-3.5 w-3.5" />
                        {t('printVoucher')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(voucher)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                        {t('downloadPdf')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardSection>

          {/* Fee History */}
          <CardSection title={t('feeHistory')}>
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-1">
                <SearchInput
                  placeholder={t('feeHistorySearchPlaceholder')}
                  value={filters.search}
                  onChange={(v) => updateFilter({ search: v })}
                />
              </div>
              <FilterDropdown
                label={t('academicYear')}
                options={yearOptions}
                value={filters.academicYear}
                onChange={(v) => updateFilter({ academicYear: v })}
              />
              <FilterDropdown
                label={t('month')}
                options={monthOptions}
                value={filters.feeMonth}
                onChange={(v) => updateFilter({ feeMonth: v })}
              />
              <FilterDropdown
                label={t('feeType')}
                options={feeTypeOptions}
                value={filters.feeType}
                onChange={(v) => updateFilter({ feeType: v })}
              />
            </div>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-gray-500 dark:text-gray-400">
                <Spinner size="lg" className="text-blue-600" />
                <p className="text-sm">{t('loadingFees')}</p>
              </div>
            ) : history.length === 0 && filtersActive ? (
              <EmptyState
                icon={DocumentDuplicateIcon}
                title={t('noMatchingHistoryTitle')}
                description={t('noMatchingHistoryDescription')}
              />
            ) : history.length === 0 ? (
              <EmptyState icon={DocumentDuplicateIcon} title={t('noHistoryTitle')} description={t('noHistoryDescription')} />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300">{t('feeMonth')}</th>
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300">{t('feeType')}</th>
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300">{t('amount')}</th>
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300">{t('paidAmount')}</th>
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300">{t('outstandingDueAmount')}</th>
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300">{t('paymentDate')}</th>
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300">{t('status')}</th>
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300">{t('action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {history.map((record) => (
                        <tr key={record.id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{record.feeMonth || '-'}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{record.feeTypeLabel || record.feeType || '-'}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{formatCurrency(record.amount)}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{formatCurrency(record.paidAmount)}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{formatCurrency(record.outstanding)}</td>
                          <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{formatDate(record.paymentDate)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeCls(record.status)}`}
                            >
                              {record.status || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => openReceipt(record)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                            >
                              <EyeIcon className="h-3.5 w-3.5" />
                              {t('viewReceipt')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {history.map((record) => (
                    <article
                      key={record.id}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {record.feeMonth || '-'} <span className="font-medium text-gray-500">({record.feeTypeLabel || record.feeType || '-'})</span>
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeCls(record.status)}`}
                        >
                          {record.status || '-'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <span>
                          {t('amount')}: <span className="font-medium">{formatCurrency(record.amount)}</span>
                        </span>
                        <span>
                          {t('paidAmount')}: <span className="font-medium">{formatCurrency(record.paidAmount)}</span>
                        </span>
                        <span>
                          {t('outstandingDueAmount')}: <span className="font-medium">{formatCurrency(record.outstanding)}</span>
                        </span>
                        <span>
                          {t('paymentDate')}: {formatDate(record.paymentDate)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openReceipt(record)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                        {t('viewReceipt')}
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
          </CardSection>

          {/* Voucher / Receipt detail modals (populated from the real APIs) */}
          <VoucherDetailModal
            voucher={voucherDetail || activeVoucher}
            loading={voucherLoading}
            onClose={closeVoucher}
            t={t}
            handlePrintVoucher={handlePrintVoucher}
            handleDownloadPdf={handleDownloadPdf}
          />
          <ReceiptDetailModal receipt={receiptDetail || activeReceipt} loading={receiptLoading} onClose={closeReceipt} t={t} />
        </>
      )}
    </div>
  );
};

export default StudentFees;