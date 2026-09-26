import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import FeeCollection from '../models/feeCollection.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import feeOutstandingService from './feeOutstanding.service.js';

const VALID_FEE_TYPES = ['Admission', 'Monthly', 'Examination'];

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }

  return String(new Date().getFullYear());
};

const resolveStudent = async (user) => {
  if (user.referenceId && user.referenceModel === 'Student') {
    const student = await Student.findById(user.referenceId);
    if (!student) {
      throw new ApiError(404, 'Linked student profile not found');
    }
    return student;
  }

  if (user.role === 'student') {
    const student = user.referenceId
      ? await Student.findById(user.referenceId)
      : await Student.findOne({ studentId: user.loginId || user.studentId });
    if (!student) {
      throw new ApiError(404, 'Student profile not found');
    }
    return student;
  }

  throw new ApiError(403, 'Only students can access this resource');
};

const assertActiveStudent = (student) => {
  if (String(student.status).toLowerCase() !== 'active') {
    throw new ApiError(403, 'Your student profile is inactive. Contact the administration.');
  }
};

const assertValidObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `${label} must be a valid ID`);
  }
};

const buildHistoryRecord = (doc) => {
  const outstanding = Number(doc.remainingAmount) || 0;
  const paid = Number(doc.amountPaid) || 0;

  return {
    id: doc._id,
    receiptId: doc.receiptId,
    academicYear: doc.academicYear,
    feeMonth: doc.month,
    feeType: doc.feeType,
    feeTypeLabel: feeOutstandingService.FEE_TYPE_LABELS[doc.feeType] || doc.feeType,
    exam: doc.exam || null,
    amount: doc.totalPayable ?? doc.baseAmount,
    totalPayable: doc.totalPayable ?? doc.baseAmount,
    baseAmount: doc.baseAmount,
    paidAmount: paid,
    outstanding,
    discount: Number(doc.discount) || 0,
    lateFine: Number(doc.lateFine) || 0,
    paymentDate: doc.paymentDate,
    paymentMethod: doc.paymentMethod,
    status: outstanding <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
  };
};

const buildVoucher = (doc) => ({
  id: doc._id,
  voucherId: doc.voucherId,
  receiptId: doc.receiptId || doc.voucherId,
  academicYear: doc.academicYear,
  feeMonth: doc.month,
  issueDate: doc.issueDate,
  dueDate: doc.dueDate,
  totalPayable: doc.totalPayable ?? doc.baseAmount,
  currentFee: doc.currentFee ?? doc.baseAmount,
  previousOutstanding: doc.previousOutstanding ?? 0,
  amountPaid: Number(doc.amountPaid) || 0,
  status: doc.voucherStatus,
  paymentMethod: doc.paymentMethod,
  generatedAt: doc.generatedAt,
  studentId: doc.studentId,
  studentName: doc.studentName,
});

/**
 * Student fee overview built from the real fee architecture (FeeStructure +
 * FeeCollection + shared dues/status computation). Reuses
 * feeOutstandingService.getStudentOutstandingDues so admin and portal stay
 * consistent; the voucher's real due date is used when one exists for the
 * current month.
 */
const getMyFeeOverview = async (user) => {
  const student = await resolveStudent(user);
  assertActiveStudent(student);

  const academicYear = student.academicYear || (await getCurrentAcademicYear());

  const summary = await feeOutstandingService.getStudentOutstandingDues(student._id, academicYear);

  if (!summary.structureAvailable) {
    return null;
  }

  const currentMonth = summary.currentMonth?.month || null;

  let voucherDueDate = null;

  if (currentMonth) {
    const vouchers = await FeeCollection.find({
      student: student._id,
      academicYear,
      feeType: 'Monthly',
      month: currentMonth,
      voucherId: { $ne: null },
      voucherStatus: { $ne: 'Cancelled' },
    })
      .select('dueDate')
      .sort({ generatedAt: -1, createdAt: -1 })
      .limit(1)
      .lean();

    if (vouchers.length > 0) {
      voucherDueDate = vouchers[0].dueDate;
    }
  }

  return {
    id: student._id,
    studentId: student.studentId,
    currentAcademicYear: academicYear,
    currentMonth,
    currentFeeAmount: summary.currentMonth?.baseAmount ?? null,
    paidAmount: summary.currentMonth?.paid ?? null,
    outstandingAmount: summary.totalOutstanding,
    outstandingCount: summary.outstandingCount,
    totalPaidThisYear: summary.totalPaidThisYear,
    dueDate: voucherDueDate || null,
    paymentStatus: summary.currentMonth?.status || null,
  };
};

/**
 * Student fee history — actual collected fee records (FeeCollection rows with
 * voucherId null, i.e. real payments). Identity is always the logged-in
 * student's own _id; client-supplied IDs/params are never trusted.
 */
const getMyFeeHistory = async (user, { academicYear, feeMonth, feeType, search, page, limit } = {}) => {
  const student = await resolveStudent(user);
  assertActiveStudent(student);

  const effectiveYear = academicYear || (await getCurrentAcademicYear());

  const filter = {
    student: student._id,
    academicYear: effectiveYear,
    voucherId: null,
  };

  if (feeMonth) filter.month = feeMonth;

  if (feeType) {
    if (!VALID_FEE_TYPES.includes(feeType)) {
      throw new ApiError(400, `Fee type must be one of: ${VALID_FEE_TYPES.join(', ')}`);
    }
    filter.feeType = feeType;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { receiptId: regex },
      { month: regex },
      { feeType: regex },
      { exam: regex },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

  const [total, records, years] = await Promise.all([
    FeeCollection.countDocuments(filter),
    FeeCollection.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    FeeCollection.distinct('academicYear', { student: student._id }).then((ys) =>
      ys.filter((y) => /^\d{4}$/.test(String(y))).sort().reverse(),
    ),
  ]);

  return {
    total,
    records: records.map(buildHistoryRecord),
    academicYear: effectiveYear,
    years,
    page: pageNum,
    limit: limitNum,
  };
};

/**
 * Student's own fee vouchers — reuses existing generated voucher records from
 * the FeeCollection collection (rows carrying voucherId). No duplicate
 * vouchers are ever generated from the student portal.
 */
const getMyVouchers = async (user, { academicYear } = {}) => {
  const student = await resolveStudent(user);
  assertActiveStudent(student);

  const effectiveYear = academicYear || (await getCurrentAcademicYear());

  const vouchers = await FeeCollection.find({
    student: student._id,
    academicYear: effectiveYear,
    voucherId: { $ne: null },
  })
    .sort({ generatedAt: -1, createdAt: -1 })
    .limit(100)
    .lean();

  return {
    total: vouchers.length,
    vouchers: vouchers.map(buildVoucher),
    academicYear: effectiveYear,
  };
};

const getMyVoucher = async (user, id) => {
  const student = await resolveStudent(user);
  assertActiveStudent(student);

  assertValidObjectId(id, 'Voucher ID');

  const voucher = await FeeCollection.findOne({ _id: id, voucherId: { $ne: null } }).lean();

  if (!voucher) {
    throw new ApiError(404, 'Voucher not found');
  }

  if (String(voucher.student) !== String(student._id)) {
    throw new ApiError(403, 'You can only view your own vouchers');
  }

  return buildVoucher(voucher);
};

const getMyReceipt = async (user, id) => {
  const student = await resolveStudent(user);
  assertActiveStudent(student);

  assertValidObjectId(id, 'Receipt ID');

  const receipt = await FeeCollection.findOne({ _id: id, voucherId: null }).lean();

  if (!receipt) {
    throw new ApiError(404, 'Receipt not found');
  }

  if (String(receipt.student) !== String(student._id)) {
    throw new ApiError(403, 'You can only view your own receipts');
  }

  return buildHistoryRecord(receipt);
};

export default {
  getMyFeeOverview,
  getMyFeeHistory,
  getMyVouchers,
  getMyVoucher,
  getMyReceipt,
};