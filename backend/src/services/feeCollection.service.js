import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import FeeStructure from '../models/feeStructure.model.js';
import FeeCollection from '../models/feeCollection.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import Counter from '../models/counter.model.js';
import { ApiError } from '../utils/apiError.js';
import { FEE_TYPE_MAP } from '../validations/feeCollection.validation.js';

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

const FEE_TYPE_FIELD = {
  Admission: 'admissionFee',
  Monthly: 'monthlyFee',
  Examination: 'examFee',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }

  return String(new Date().getFullYear());
};

const collectFee = async (data) => {
  const { studentId, feeType, month, exam, discount, lateFine, amountPaid, paymentMethod } = data;

  const student = await Student.findOne({ _id: studentId, status: 'Active' });

  if (!student) {
    throw new ApiError(404, 'Active student not found');
  }

  const academicYear = await getCurrentAcademicYear();

  if (feeType === 'Monthly') {
    const academicYearNum = /^\d{4}$/.test(academicYear) ? Number(academicYear) : new Date().getFullYear();
    const admissionDate = student.admissionDate ? new Date(student.admissionDate) : new Date(student.createdAt);
    const admissionYear = Number.isNaN(admissionDate.getTime()) ? null : admissionDate.getFullYear();
    const monthIndex = MONTHS.indexOf(month);

    let startMonthIndex = 0;
    if (admissionYear !== null && admissionYear > academicYearNum) {
      startMonthIndex = MONTHS.length;
    } else if (admissionYear !== null && admissionYear === academicYearNum) {
      startMonthIndex = admissionDate.getMonth();
    }

    if (monthIndex < 0 || monthIndex < startMonthIndex) {
      throw new ApiError(400, 'Monthly fee cannot be collected for a month before the student admission month');
    }

    if (monthIndex > new Date().getMonth()) {
      throw new ApiError(400, 'Monthly fee cannot be collected for a future month');
    }
  }

  const feeClassName = CLASS_TO_FEE_CLASS[student.class] || student.class;

  const structure = await FeeStructure.findOne({
    className: feeClassName,
    academicYear,
    isDeleted: { $ne: true },
  });

  if (!structure) {
    throw new ApiError(400, `No fee structure defined for ${student.class} in the current academic year`);
  }

  if (structure.status !== 'Active') {
    throw new ApiError(400, `Fee structure for ${student.class} is not active`);
  }

  const amountField = FEE_TYPE_FIELD[feeType];
  const baseAmount = Number(structure[amountField]) || 0;

  const duplicateFilter = { student: student._id, academicYear, feeType };

  if (feeType === 'Monthly') {
    duplicateFilter.month = month;
  }

  if (feeType === 'Examination') {
    duplicateFilter.exam = exam;
  }

  const stored = {};

  if (feeType === 'Monthly') {
    const linePayments = await FeeCollection.find(duplicateFilter);

    let paid = 0;
    let discountTotal = 0;
    let fineTotal = 0;

    for (const payment of linePayments) {
      paid += Number(payment.amountPaid) || 0;
      discountTotal += Number(payment.discount) || 0;
      fineTotal += Number(payment.lateFine) || 0;
    }

    const lineOutstanding = Math.max(
      0,
      (linePayments.length > 0 ? Number(linePayments[0].baseAmount) : baseAmount) - paid + fineTotal - discountTotal
    );

    if (linePayments.length > 0 && lineOutstanding <= 0) {
      throw new ApiError(409, 'This month fee has already been fully collected');
    }

    stored.baseAmount = linePayments.length > 0 ? Number(linePayments[0].baseAmount) : baseAmount;
    stored.totalPayable = lineOutstanding - discount + lateFine;

    if (stored.totalPayable < 0) {
      throw new ApiError(400, 'Discount cannot exceed the remaining outstanding amount');
    }

    if (amountPaid > stored.totalPayable) {
      throw new ApiError(400, 'Amount paid cannot exceed the remaining outstanding amount');
    }
  } else {
    const existing = await FeeCollection.findOne(duplicateFilter);

    if (existing) {
      const label = feeType === 'Admission' ? 'Admission fee for this student' : `This ${feeType.toLowerCase()} fee`;
      throw new ApiError(409, `${label} has already been collected`);
    }

    stored.baseAmount = baseAmount;
    stored.totalPayable = baseAmount - discount + lateFine;

    if (stored.totalPayable < 0) {
      throw new ApiError(400, 'Discount cannot exceed the applicable fee amount');
    }

    if (amountPaid > stored.totalPayable) {
      throw new ApiError(400, 'Amount paid cannot exceed the total payable amount');
    }
  }

  const sequence = await Counter.increment('feeCollection');
  const receiptId = `REC-${academicYear}-${String(sequence).padStart(4, '0')}`;

  const payment = await FeeCollection.create({
    receiptId,
    student: student._id,
    studentId: student.studentId,
    studentName: student.fullName,
    fatherName: student.fatherName,
    className: student.class,
    academicYear,
    feeType,
    month,
    exam: feeType === 'Examination' ? exam : null,
    baseAmount: stored.baseAmount,
    discount,
    lateFine,
    totalPayable: stored.totalPayable,
    amountPaid,
    remainingAmount: stored.totalPayable - amountPaid,
    paymentMethod,
  });

  return payment;
};

const getFeeCollections = async ({ studentId, feeType, month, academicYear } = {}) => {
  const filter = {};

  if (studentId) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new ApiError(400, 'Valid student ID is required');
    }

    const student = await Student.findById(studentId);

    if (!student) {
      throw new ApiError(404, 'Student not found');
    }

    filter.student = studentId;
  }

  if (academicYear) {
    filter.academicYear = String(academicYear).trim();
  }

  if (month) {
    filter.month = month;
  }

  if (feeType) {
    const canonicalFeeType = FEE_TYPE_MAP[feeType];

    if (!canonicalFeeType) {
      throw new ApiError(400, 'Invalid fee type. Allowed values: Admission Fee, Monthly Fee, Examination Fee');
    }

    filter.feeType = canonicalFeeType;
  }

  const payments = await FeeCollection.find({ ...filter, voucherId: null }).sort({ paymentDate: -1, createdAt: -1 });

  return { payments };
};

export default { collectFee, getFeeCollections };