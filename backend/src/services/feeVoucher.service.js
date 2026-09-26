import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import Class from '../models/class.model.js';
import FeeStructure from '../models/feeStructure.model.js';
import FeeCollection from '../models/feeCollection.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import Counter from '../models/counter.model.js';
import { ApiError } from '../utils/apiError.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const VOUCHER_CLASSES = [
  'Montessori', 'Nursery', 'KG1', 'KG2',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
];

const CLASS_TO_STUDENT_CLASS = {
  KG1: 'KG 1',
  KG2: 'KG 2',
};

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

const toStudentClassName = (displayName) => CLASS_TO_STUDENT_CLASS[displayName] || displayName;

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }

  return String(new Date().getFullYear());
};

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const admissionStartMonthIndex = (student, academicYearNum) => {
  const admissionDate = student.admissionDate || student.createdAt;

  if (!admissionDate) return 0;

  const parsed = new Date(admissionDate);

  if (Number.isNaN(parsed.getTime())) return 0;

  const admissionYear = parsed.getFullYear();

  if (admissionYear > academicYearNum) return MONTHS.length;
  if (admissionYear === academicYearNum) return parsed.getMonth();
  return 0;
};

const generateVouchers = async (data) => {
  const { classes: selectedClasses, month, academicYear: requestedYear, dueDate } = data;

  const currentAcademicYear = await getCurrentAcademicYear();
  const academicYear = requestedYear || currentAcademicYear;

  if (academicYear !== currentAcademicYear) {
    throw new ApiError(400, 'Vouchers can only be generated for the current academic year');
  }

  const monthIndex = MONTHS.indexOf(month);
  const currentMonthIndex = new Date().getMonth();

  if (monthIndex < currentMonthIndex) {
    throw new ApiError(400, 'Previous month vouchers cannot be generated. You can only generate vouchers for the current month.');
  }

  if (monthIndex > currentMonthIndex) {
    throw new ApiError(400, 'Future month vouchers cannot be generated yet. You can only generate vouchers for the current month.');
  }

  const parsedDueDate = new Date(dueDate);
  const currentDate = new Date();
  const startOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  if (
    Number.isNaN(parsedDueDate.getTime()) ||
    parsedDueDate < startOfCurrentMonth ||
    parsedDueDate > endOfCurrentMonth
  ) {
    throw new ApiError(400, 'Voucher due date must be within the current month and not in the past');
  }

  const studentClassNames = selectedClasses.map(toStudentClassName);
  const feeClassNames = studentClassNames.map((name) => CLASS_TO_FEE_CLASS[name] || name);

  const academicYearNum = Number.isNaN(Number(academicYear)) ? new Date().getFullYear() : Number(academicYear);

  const [structures, students, classDocs] = await Promise.all([
    FeeStructure.find({ className: { $in: feeClassNames }, academicYear, isDeleted: { $ne: true }, status: 'Active' }).lean(),
    Student.find({ status: 'Active', $or: studentClassNames.map((className) => ({
      $or: [
        { class: className, academicYear, enrollments: { $exists: false } },
        { class: className, academicYear, enrollments: { $size: 0 } },
        {
          enrollments: {
            $elemMatch: {
              academicYear,
              class: className,
              status: { $in: ['Active', 'Historical'] },
            },
          },
        },
      ],
    })) }).select('studentId fullName fatherName class admissionDate createdAt').lean(),
    Class.find({ className: { $in: studentClassNames } }).select('_id className').lean(),
  ]);

  const structureByFeeClass = new Map(structures.map((structure) => [structure.className, structure]));
  const classIdByStudentClass = new Map(classDocs.map((cls) => [cls.className, String(cls._id)]));

  const skippedClasses = [];

  for (const className of selectedClasses) {
    const feeClassName = CLASS_TO_FEE_CLASS[toStudentClassName(className)] || toStudentClassName(className);
    const structure = structureByFeeClass.get(feeClassName);

    if (!structure || Number(structure.monthlyFee) <= 0) {
      skippedClasses.push(className);
    }
  }

  const studentIds = students.map((student) => student._id);

  const existingVouchers = studentIds.length > 0
    ? await FeeCollection.find({
      student: { $in: studentIds },
      academicYear,
      feeType: 'Monthly',
      month,
      voucherId: { $ne: null },
    }).select('student').lean()
    : [];

  const existingVoucherStudents = new Set(existingVouchers.map((v) => String(v.student)));

  const candidates = [];
  let alreadyGenerated = 0;

  for (const student of students) {
    const feeClassName = CLASS_TO_FEE_CLASS[student.class] || student.class;
    const structure = structureByFeeClass.get(feeClassName);

    if (!structure || Number(structure.monthlyFee) <= 0) continue;

    if (admissionStartMonthIndex(student, academicYearNum) > monthIndex) continue;

    if (existingVoucherStudents.has(String(student._id))) {
      alreadyGenerated += 1;
      continue;
    }

    candidates.push({ student, currentFee: Number(structure.monthlyFee) || 0 });
  }

  const candidateIds = candidates.map((candidate) => candidate.student._id);
  let previousOutstandingByStudent = new Map();

  if (candidateIds.length > 0 && monthIndex > 0) {
    const priorMonths = MONTHS.slice(0, monthIndex);
    const priorPayments = await FeeCollection.find({
      student: { $in: candidateIds },
      academicYear,
      feeType: 'Monthly',
      month: { $in: priorMonths },
      voucherId: null,
    }).select('student month baseAmount amountPaid discount lateFine').lean();

    const outstandingMap = new Map();

    for (const payment of priorPayments) {
      const key = String(payment.student);
      const monthKey = payment.month;

      if (!outstandingMap.has(key)) outstandingMap.set(key, new Map());

      const monthData = outstandingMap.get(key);

      if (!monthData.has(monthKey)) {
        monthData.set(monthKey, { base: Number(payment.baseAmount) || 0, paid: 0, discount: 0, fine: 0 });
      }

      const data = monthData.get(monthKey);
      data.paid += Number(payment.amountPaid) || 0;
      data.discount += Number(payment.discount) || 0;
      data.fine += Number(payment.lateFine) || 0;
    }

    for (const [key, monthData] of outstandingMap) {
      let total = 0;

      for (const data of monthData.values()) {
        total += Math.max(0, data.base - data.paid + data.fine - data.discount);
      }

      previousOutstandingByStudent.set(key, round(total));
    }
  }

  const now = new Date();
  const issueDate = now;
  const generatedAt = now;
  const voucherDocs = [];
  let endSequence = 0;

  if (candidates.length > 0) {
    endSequence = await Counter.incrementBy('feeVoucher', candidates.length);
  }

  const startSequence = endSequence - candidates.length + 1;

  candidates.forEach((candidate, index) => {
    const { student, currentFee } = candidate;
    const studentIdString = String(student._id);
    const previousOutstanding = previousOutstandingByStudent.get(studentIdString) || 0;
    const totalPayable = round(currentFee + previousOutstanding);
    const voucherNumber = `VCH-${academicYear}-${String(startSequence + index).padStart(4, '0')}`;

    voucherDocs.push({
      receiptId: voucherNumber,
      voucherId: voucherNumber,
      student: student._id,
      studentId: student.studentId,
      studentName: student.fullName,
      fatherName: student.fatherName,
      className: student.class,
      classId: classIdByStudentClass.get(student.class) || null,
      academicYear,
      feeType: 'Monthly',
      month,
      exam: null,
      baseAmount: currentFee,
      discount: 0,
      lateFine: 0,
      totalPayable,
      amountPaid: 0,
      remainingAmount: totalPayable,
      paymentMethod: 'Voucher',
      issueDate,
      dueDate,
      currentFee,
      previousOutstanding,
      voucherStatus: 'Generated',
      generatedAt,
    });
  });

  let createdVouchers = [];
  let failed = 0;

  if (voucherDocs.length > 0) {
    try {
      createdVouchers = await FeeCollection.insertMany(voucherDocs, { ordered: false });
    } catch (error) {
      const writeErrors = error?.writeErrors ? [...error.writeErrors] : [];
      const partialInserted = error?.insertedDocs || error?.result?.insertedDocs || [];

      if (!writeErrors.length && partialInserted.length === 0) {
        throw error;
      }

      createdVouchers = partialInserted;
      failed = writeErrors.length || voucherDocs.length - partialInserted.length;
    }
  }

  return {
    summary: {
      classesSelected: selectedClasses.length,
      studentsFound: candidates.length + alreadyGenerated,
      vouchersGenerated: createdVouchers.length,
      alreadyGenerated,
      failed,
    },
    vouchers: createdVouchers,
    academicYear,
    skippedClasses,
  };
};

const getVouchers = async ({ academicYear, month, className, voucherStatus, studentId } = {}) => {
  const effectiveYear = academicYear || (await getCurrentAcademicYear());
  const filter = { voucherId: { $ne: null }, academicYear: effectiveYear };

  if (month) filter.month = month;

  if (className) filter.className = toStudentClassName(className);

  if (voucherStatus) filter.voucherStatus = voucherStatus;

  if (studentId) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new ApiError(400, 'Valid student ID is required');
    }
    filter.student = studentId;
  }

  const vouchers = await FeeCollection.find(filter).sort({ generatedAt: -1, createdAt: -1 }).limit(500).lean();

  return { vouchers, academicYear: effectiveYear };
};

const getVoucher = async (voucherId) => {
  const voucher = await FeeCollection.findOne({ voucherId: String(voucherId).trim() });

  if (!voucher) {
    throw new ApiError(404, 'Voucher not found');
  }

  return { voucher };
};

export default { generateVouchers, getVouchers, getVoucher };