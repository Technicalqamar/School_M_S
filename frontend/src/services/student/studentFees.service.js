import api from '../../api/axios';

/**
 * Student Fees service — view-only.
 *
 * Backed by the protected student endpoints:
 *   GET /api/v1/student/fees/overview
 *   GET /api/v1/student/fees/history     (?academicYear&feeMonth&feeType&search&page&limit)
 *   GET /api/v1/student/fees/vouchers
 *   GET /api/v1/student/fees/vouchers/:id
 *   GET /api/v1/student/fees/receipts/:id
 *
 * The server always derives the student's identity from the authenticated
 * session and only returns their own fee records. Students have no
 * create/collect/edit/delete/generate capabilities at the API level, so this
 * service exposes reads only. No fabricated fee data is ever used.
 */

export const STUDENT_FEE_TYPES = ['Admission', 'Monthly', 'Examination'];

export const STUDENT_MONTHS = [
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

const normalizeOverview = (o) => ({
  id: o.id,
  studentId: o.studentId,
  currentAcademicYear: o.currentAcademicYear,
  currentMonth: o.currentMonth,
  currentFeeAmount: o.currentFeeAmount ?? null,
  paidAmount: o.paidAmount ?? null,
  outstandingAmount: o.outstandingAmount ?? 0,
  outstandingCount: o.outstandingCount ?? 0,
  totalPaidThisYear: o.totalPaidThisYear ?? 0,
  dueDate: o.dueDate,
  paymentStatus: o.paymentStatus,
});

const normalizeHistoryRecord = (r) => ({
  id: r.id || r._id,
  receiptId: r.receiptId,
  academicYear: r.academicYear,
  feeMonth: r.feeMonth,
  feeType: r.feeType,
  feeTypeLabel: r.feeTypeLabel || r.feeType,
  exam: r.exam,
  amount: r.amount ?? r.totalPayable ?? r.baseAmount,
  paidAmount: r.paidAmount ?? r.amountPaid ?? 0,
  outstanding: r.outstanding ?? r.remainingAmount ?? 0,
  paymentDate: r.paymentDate,
  paymentMethod: r.paymentMethod,
  status: r.status,
});

const normalizeVoucher = (v) => ({
  id: v.id || v._id,
  voucherNumber: v.voucherId || v.voucherNumber,
  receiptId: v.receiptId || v.voucherId,
  academicYear: v.academicYear,
  feeMonth: v.feeMonth,
  issueDate: v.issueDate,
  dueDate: v.dueDate,
  totalPayable: v.totalPayable ?? v.baseAmount,
  currentFee: v.currentFee,
  previousOutstanding: v.previousOutstanding,
  status: v.status || v.voucherStatus,
  generatedAt: v.generatedAt,
});

/**
 * Fetches the logged-in student's fee overview (real structure + records).
 * Resolves null when no fee structure is configured (empty state).
 */
const getFeeOverview = async () => {
  const response = await api.get('/student/fees/overview');
  const data = response.data?.data;
  return data ? normalizeOverview(data) : null;
};

/**
 * Fetches the logged-in student's fee history (actual collected records).
 * @param {{ academicYear?: string, feeMonth?: string, feeType?: string, search?: string, page?: number, limit?: number }} [params]
 */
const getHistory = async (params = {}) => {
  const response = await api.get('/student/fees/history', { params });
  const data = response.data?.data || {};

  return {
    records: (data.records || []).map(normalizeHistoryRecord),
    total: data.total ?? (data.records || []).length,
    years: data.years || [],
    page: data.page,
    limit: data.limit,
  };
};

/**
 * Fetches the logged-in student's own fee vouchers (existing generated rows).
 */
const getVouchers = async (params = {}) => {
  const response = await api.get('/student/fees/vouchers', { params });
  const data = response.data?.data || {};

  return {
    vouchers: (data.vouchers || []).map(normalizeVoucher),
    total: data.total ?? (data.vouchers || []).length,
    academicYear: data.academicYear,
  };
};

/**
 * Fetches a single voucher by id. Throws on missing/foreign voucher.
 */
const getVoucher = async (id) => {
  const response = await api.get(`/student/fees/vouchers/${id}`);
  const data = response.data?.data;
  return data ? normalizeVoucher(data) : null;
};

/**
 * Fetches a single receipt by id. Throws on missing/foreign receipt.
 */
const getReceipt = async (id) => {
  const response = await api.get(`/student/fees/receipts/${id}`);
  const data = response.data?.data;
  return data ? normalizeHistoryRecord(data) : null;
};

const studentFeesService = {
  getFeeOverview,
  getHistory,
  getVouchers,
  getVoucher,
  getReceipt,
};

export default studentFeesService;