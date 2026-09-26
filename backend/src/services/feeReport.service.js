import Student from '../models/student.model.js';
import FeeStructure from '../models/feeStructure.model.js';
import FeeCollection from '../models/feeCollection.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import feeOutstandingService from './feeOutstanding.service.js';

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

const CLASS_OPTIONS = [
  'Montessori', 'Nursery', 'KG1', 'KG2',
  '1', '2', '3', '4', '5',
  '6', '7', '8', '9', '10',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EXAMS = ['First Term', 'Mid Term', 'Final Term'];

const EXAM_MONTHS = {
  'First Term': 'March',
  'Mid Term': 'July',
  'Final Term': 'November',
};

const FEE_TYPE_LABELS = {
  Admission: 'Admission Fee',
  Monthly: 'Monthly Fee',
  Examination: 'Examination Fee',
};

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }

  return String(new Date().getFullYear());
};

const formatDate = (date) => {
  if (!date) return '';

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) return '';

  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const lineGroupKey = (type, month, exam) => {
  if (type === 'Examination') return `Exam|${exam || ''}`;
  if (type === 'Admission') return 'Admission';
  return `${type}|${month || ''}`;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolveFeeType = (feeType) => {
  if (feeType === 'All Fees' || !feeType) return 'All';
  if (feeType === 'Monthly Fee') return 'Monthly';
  if (feeType === 'Admission Fee') return 'Admission';
  return 'Examination';
};

const feeTypeToLabel = (canonical) => (canonical === 'All' ? 'All Fees' : FEE_TYPE_LABELS[canonical]);

const enumerateLines = ({ studentPayments, structure, canonicalFeeType, fromStr, toStr, monthStartIndex = 0, monthEndIndex = MONTHS.length - 1, examStartIndex = 0, examEndIndex = MONTHS.length - 1 }) => {
  const groups = new Map();

  for (const payment of studentPayments) {
    const key = lineGroupKey(payment.feeType, payment.month, payment.exam);

    if (!groups.has(key)) {
      groups.set(key, { records: [], base: Number(payment.baseAmount) || 0 });
    }

    groups.get(key).records.push(payment);
  }

  const applicableFee = {
    Monthly: Number(structure?.monthlyFee) || 0,
    Admission: Number(structure?.admissionFee) || 0,
    Examination: Number(structure?.examFee) || 0,
  };

  const lines = [];
  const lineIds = new Set();

  const buildLine = (type, month, exam) => {
    const label = FEE_TYPE_LABELS[type];
    const group = groups.get(lineGroupKey(type, month, exam));
    const base = group ? round(group.base) : round(applicableFee[type]);

    if (base <= 0) return;

    let paid = 0;
    let discount = 0;
    let fine = 0;
    let transactions = 0;
    let lastDate = '';

    if (group) {
      for (const record of group.records) {
        const date = formatDate(record.paymentDate);

        if (fromStr && date < fromStr) continue;
        if (toStr && date > toStr) continue;

        paid += Number(record.amountPaid) || 0;
        discount += Number(record.discount) || 0;
        fine += Number(record.lateFine) || 0;
        transactions += 1;
        if (date && (!lastDate || date > lastDate)) lastDate = date;
      }

      if (!lastDate) {
        for (const record of group.records) {
          const date = formatDate(record.paymentDate);
          if (date && (!lastDate || date > lastDate)) lastDate = date;
        }
      }
    }

    const due = round(Math.max(0, base - paid + fine - discount));
    let status;

    if (due <= 0) {
      status = 'Paid';
    } else if (paid > 0) {
      status = 'Partially Paid';
    } else {
      status = 'Due';
    }

    let id = `${label}-${month || exam || ''}`;
    let counter = 1;

    while (lineIds.has(id)) {
      counter += 1;
      id = `${label}-${month || exam || ''}-${counter}`;
    }

    lineIds.add(id);

    lines.push({
      id,
      month,
      exam: exam || null,
      feeType: label,
      expected: base,
      paid: round(paid),
      discount: round(discount),
      fine: round(fine),
      netPaid: round(paid - discount + fine),
      due,
      status,
      date: lastDate,
      transactions,
    });
  };

  if (canonicalFeeType === 'All' || canonicalFeeType === 'Admission') {
    buildLine('Admission', 'January', null);
  }

  if (canonicalFeeType === 'All' || canonicalFeeType === 'Monthly') {
    for (let i = monthStartIndex; i <= monthEndIndex; i++) {
      if (i < 0 || i >= MONTHS.length) continue;
      buildLine('Monthly', MONTHS[i], null);
    }
  }

  if (canonicalFeeType === 'All' || canonicalFeeType === 'Examination') {
    for (const exam of EXAMS) {
      const examMonthIndex = MONTHS.indexOf(EXAM_MONTHS[exam]);

      if (examMonthIndex < examStartIndex || examMonthIndex > examEndIndex) continue;

      buildLine('Examination', EXAM_MONTHS[exam], exam);
    }
  }

  return lines;
};

const rollupLines = (lines) => {
  let expected = 0;
  let collected = 0;
  let due = 0;
  let discount = 0;
  let fine = 0;
  let transactions = 0;
  let paidMonths = 0;
  let dueMonths = 0;

  for (const line of lines) {
    expected += line.expected;
    collected += line.paid;
    due += line.due;
    discount += line.discount;
    fine += line.fine;
    transactions += line.transactions;

    if (line.feeType === 'Monthly Fee') {
      if (line.due <= 0) paidMonths += 1;
      else dueMonths += 1;
    }
  }

  return {
    expected: round(expected),
    collected: round(collected),
    due: round(due),
    discount: round(discount),
    fine: round(fine),
    transactions,
    paidMonths,
    dueMonths,
  };
};

const buildClassReport = ({ className, students, structure, paymentsByStudent, canonicalFeeType, fromStr, toStr, academicYear }) => {
  const rows = [];

  for (const student of students) {
    const feeClassName = CLASS_TO_FEE_CLASS[student.class] || student.class;

    if (feeClassName !== className) continue;

    const studentPayments = paymentsByStudent.get(String(student._id)) || [];
    const lines = enumerateLines({ studentPayments, structure, canonicalFeeType, fromStr, toStr });
    const totals = rollupLines(lines);

    rows.push({
      id: student.studentId,
      name: student.fullName,
      class: student.class,
      expected: totals.expected,
      collected: totals.collected,
      due: totals.due,
      paidMonths: totals.paidMonths,
      dueMonths: totals.dueMonths,
      status: totals.due <= 0 ? 'Paid' : totals.collected > 0 ? 'Partial' : 'Pending',
      transactions: totals.transactions,
    });
  }

  let totalExpected = 0;
  let totalCollected = 0;
  let totalDue = 0;
  let paidStudents = 0;
  let pendingStudents = 0;
  let totalTransactions = 0;

  for (const row of rows) {
    totalExpected += row.expected;
    totalCollected += row.collected;
    totalDue += row.due;
    totalTransactions += row.transactions;
    if (row.status === 'Paid') paidStudents += 1;
    else pendingStudents += 1;
  }

  return {
    scope: 'Class',
    academicYear,
    feeType: feeTypeToLabel(canonicalFeeType),
    className,
    totalStudents: rows.length,
    totalExpected: round(totalExpected),
    totalCollected: round(totalCollected),
    totalDue: round(totalDue),
    paidStudents,
    pendingStudents,
    totalTransactions,
    students: rows.map(({ transactions, ...student }) => student),
  };
};

const buildOverallReport = ({ students, structureByFeeClass, paymentsByStudent, canonicalFeeType, fromStr, toStr, academicYear }) => {
  const classSummaries = [];
  let totalStudents = 0;
  let totalExpected = 0;
  let totalCollected = 0;
  let totalDue = 0;
  let paidStudents = 0;
  let pendingStudents = 0;
  let totalTransactions = 0;

  for (const className of CLASS_OPTIONS) {
    const structure = structureByFeeClass.get(className);
    const classReport = buildClassReport({
      className,
      students,
      structure,
      paymentsByStudent,
      canonicalFeeType,
      fromStr,
      toStr,
      academicYear,
    });

    if (classReport.totalStudents === 0) continue;

    classSummaries.push({
      className,
      totalStudents: classReport.totalStudents,
      totalExpected: classReport.totalExpected,
      totalCollected: classReport.totalCollected,
      totalDue: classReport.totalDue,
      paidStudents: classReport.paidStudents,
      pendingStudents: classReport.pendingStudents,
      totalTransactions: classReport.totalTransactions,
    });

    totalStudents += classReport.totalStudents;
    totalExpected += classReport.totalExpected;
    totalCollected += classReport.totalCollected;
    totalDue += classReport.totalDue;
    paidStudents += classReport.paidStudents;
    pendingStudents += classReport.pendingStudents;
    totalTransactions += classReport.totalTransactions;
  }

  return {
    scope: 'Overall',
    academicYear,
    feeType: feeTypeToLabel(canonicalFeeType),
    totalStudents,
    totalExpected: round(totalExpected),
    totalCollected: round(totalCollected),
    totalDue: round(totalDue),
    paidStudents,
    pendingStudents,
    totalTransactions,
    classSummaries,
  };
};

const buildStudentReport = async ({ studentId, students, structureByFeeClass, paymentsByStudent, canonicalFeeType, fromStr, toStr, academicYear, respectAdmission = false }) => {
  const student = students.find((item) => String(item._id) === String(studentId));

  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  const structure = structureByFeeClass.get(CLASS_TO_FEE_CLASS[student.class] || student.class);
  const studentPayments = paymentsByStudent.get(String(student._id)) || [];

  // Monthly fee cycle always starts at the student's actual admission month
  // (reusing the central dues rule) and never runs past the actual current
  // month — no hard-coded month/year. Older students admitted in previous
  // years keep the full year so genuine historical dues stay visible.
  const admissionDate = student.admissionDate || student.createdAt;
  const monthStartIndex = feeOutstandingService.computeDuesStartMonthIndex(admissionDate, academicYear);
  const monthEndIndex = Math.min(new Date().getMonth(), MONTHS.length - 1);

  // Examination window keeps its existing behaviour: window-filtered only when
  // the caller explicitly opts in (student profile), full range otherwise.
  const examStartIndex = respectAdmission ? monthStartIndex : 0;
  const examEndIndex = respectAdmission ? monthEndIndex : MONTHS.length - 1;

  const lines = enumerateLines({ studentPayments, structure, canonicalFeeType, fromStr, toStr, monthStartIndex, monthEndIndex, examStartIndex, examEndIndex });
  const totals = rollupLines(lines);

  return {
    scope: 'Student',
    academicYear,
    feeType: feeTypeToLabel(canonicalFeeType),
    dateFrom: fromStr || null,
    dateTo: toStr || null,
    student: {
      id: student.studentId,
      name: student.fullName,
      class: student.class,
    },
    totalExpected: totals.expected,
    totalPaid: totals.collected,
    totalDue: totals.due,
    totalDiscount: totals.discount,
    totalFine: totals.fine,
    totalTransactions: totals.transactions,
    paidStudents: totals.due <= 0 ? 1 : 0,
    pendingStudents: totals.due > 0 ? 1 : 0,
    paidMonths: lines.filter((line) => line.feeType === 'Monthly Fee' && line.due <= 0).map((line) => line.month),
    dueMonths: lines.filter((line) => line.feeType === 'Monthly Fee' && line.due > 0).map((line) => line.month),
    breakdown: lines,
  };
};

const getReport = async ({ scope, academicYear, className, studentId, feeType, dateFrom, dateTo, respectAdmission = false }) => {
  const effectiveYear = academicYear || (await getCurrentAcademicYear());
  const canonicalFeeType = resolveFeeType(feeType);
  const fromStr = dateFrom || '';
  const toStr = dateTo || '';

  const [structures, students, payments] = await Promise.all([
    FeeStructure.find({ academicYear: effectiveYear, isDeleted: { $ne: true }, status: 'Active' }),
    Student.find({ status: 'Active' }),
    FeeCollection.find({ academicYear: effectiveYear, voucherId: null }),
  ]);

  const structureByFeeClass = new Map(structures.map((structure) => [structure.className, structure]));

  const paymentsByStudent = new Map();

  for (const payment of payments) {
    const key = String(payment.student);

    if (!paymentsByStudent.has(key)) {
      paymentsByStudent.set(key, []);
    }

    paymentsByStudent.get(key).push(payment);
  }

  if (scope === 'Student') {
    const report = await buildStudentReport({
      studentId,
      students,
      structureByFeeClass,
      paymentsByStudent,
      canonicalFeeType,
      fromStr,
      toStr,
      academicYear: effectiveYear,
      respectAdmission,
    });

    return { report };
  }

  if (scope === 'Class') {
    const structure = structureByFeeClass.get(className);

    const report = buildClassReport({
      className,
      students,
      structure,
      paymentsByStudent,
      canonicalFeeType,
      fromStr,
      toStr,
      academicYear: effectiveYear,
    });

    return { report };
  }

  const report = buildOverallReport({
    students,
    structureByFeeClass,
    paymentsByStudent,
    canonicalFeeType,
    fromStr,
    toStr,
    academicYear: effectiveYear,
  });

  return { report };
};

const searchStudents = async (query) => {
  const term = String(query || '').trim();

  if (!term) {
    throw new ApiError(400, 'Search query is required');
  }

  const pattern = new RegExp(escapeRegex(term), 'i');

  const students = await Student.find({
    status: 'Active',
    $or: [
      { studentId: pattern },
      { fullName: pattern },
      { fatherName: pattern },
    ],
  }).limit(20).lean();

  return {
    students: students.map((student) => ({
      _id: String(student._id),
      id: student.studentId,
      name: student.fullName,
      fatherName: student.fatherName || '',
      class: student.class,
    })),
  };
};

export default { getReport, searchStudents };