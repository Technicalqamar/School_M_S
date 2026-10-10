import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import FeeStructure from '../models/feeStructure.model.js';
import FeeCollection from '../models/feeCollection.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import feeOutstandingService from './feeOutstanding.service.js';
import classService from './class.service.js';

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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }

  return String(new Date().getFullYear());
};

const getDashboardData = async ({ academicYear: requestedYear } = {}) => {
  const academicYear = requestedYear || (await getCurrentAcademicYear());

  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentMonth = MONTHS[currentMonthIndex];

  const currentYearNum = now.getFullYear();
  const monthStart = new Date(currentYearNum, currentMonthIndex, 1);
  const monthEnd = new Date(currentYearNum, currentMonthIndex + 1, 1);

  const [
    classData,
    studentOverviewRows,
    totalTeachers,
    newAdmissions,
    structures,
    feeStudents,
    feePayments,
  ] = await Promise.all([
    classService.getAllClasses(),
    Student.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Teacher.countDocuments(),
    Student.countDocuments({ admissionDate: { $gte: monthStart, $lt: monthEnd } }),
    FeeStructure.find({ academicYear, isDeleted: { $ne: true }, status: 'Active' }),
    // One read of the active students, projected to exactly the fields the
    // dashboard needs: `class` + `admissionDate` for the expected-monthly math,
    // `createdAt` for the fee-due admission-date fallback, `_id` for payment
    // matching. The full active-student documents are no longer loaded here or
    // inside the outstanding-dues engine.
    Student.find({ status: 'Active' }).select('class admissionDate createdAt').lean(),
    // One read of the year's payment records (voucherId null), projected to the
    // fields the due computation and the collected totals use. Previously
    // FeeCollection was scanned twice: once by getOutstandingDues (full
    // documents) and once by the grouped aggregation that produced
    // `feeCollectionRows`.
    FeeCollection.find({ academicYear, voucherId: null })
      .select('student feeType month exam amountPaid discount lateFine baseAmount')
      .lean(),
  ]);

  const activeStudents = studentOverviewRows.find((row) => row._id === 'Active')?.count || 0;
  const inactiveStudents = studentOverviewRows.find((row) => row._id === 'Inactive')?.count || 0;

  const currentYearClasses = (classData.classes || []).filter(
    (cls) => String(cls.academicYear) === String(academicYear),
  );

  const structureByFeeClass = new Map();

  for (const structure of structures) {
    if (!structureByFeeClass.has(structure.className)) {
      structureByFeeClass.set(structure.className, structure);
    }
  }

  // Collected fee totals grouped by fee type + month, equivalent to the
  // aggregation that previously ran as a second FeeCollection scan. Both these
  // totals and the per-student due computation now share the single projected
  // `feePayments` read above.
  const feeCollectionRows = [];
  const collectedByFeeTypeMonth = new Map();

  for (const payment of feePayments) {
    const key = `${payment.feeType}|${payment.month}`;
    collectedByFeeTypeMonth.set(key, (collectedByFeeTypeMonth.get(key) || 0) + (Number(payment.amountPaid) || 0));
  }

  for (const [key, total] of collectedByFeeTypeMonth) {
    const separatorIndex = key.indexOf('|');
    feeCollectionRows.push({
      feeType: key.slice(0, separatorIndex),
      month: key.slice(separatorIndex + 1),
      total,
    });
  }

  const totalFeeCollected = feeCollectionRows.reduce((sum, row) => sum + row.total, 0);

  const collectedByMonth = new Map(
    feeCollectionRows
      .filter((row) => row.feeType === 'Monthly')
      .map((row) => [row.month, row.total]),
  );

  // The outstanding-dues total is the dashboard's only figure derived from the
  // fee-due engine. Compute it from the structures, active students and payment
  // records already loaded above instead of re-running the full report engine
  // (getOutstandingDues re-queries FeeStructure, re-loads every active student
  // in full, and re-scans FeeCollection to build per-student entries that the
  // dashboard then discards).
  const outstandingDuesTotal = round(
    feeOutstandingService.computeOutstandingTotal({
      structures,
      students: feeStudents,
      payments: feePayments,
      academicYear,
    }),
  );

  const monthExpected = new Array(MONTHS.length).fill(0);
  const academicYearNum = Number(academicYear);

  for (const student of feeStudents) {
    const feeClassName = CLASS_TO_FEE_CLASS[student.class] || student.class;
    const structure = structureByFeeClass.get(feeClassName);

    if (!structure) continue;

    const monthlyApplicable = Number(structure.monthlyFee) || 0;

    if (monthlyApplicable <= 0) continue;

    let duesStartMonthIndex = 0;
    const admissionDate = student.admissionDate;

    if (admissionDate) {
      const parsedAdmission = new Date(admissionDate);

      if (!Number.isNaN(parsedAdmission.getTime())) {
        const admissionYear = parsedAdmission.getFullYear();

        if (admissionYear === academicYearNum) {
          duesStartMonthIndex = parsedAdmission.getMonth();
        } else if (admissionYear > academicYearNum) {
          duesStartMonthIndex = MONTHS.length;
        }
      }
    }

    for (let i = duesStartMonthIndex; i <= currentMonthIndex; i++) {
      monthExpected[i] += monthlyApplicable;
    }
  }

  const monthlyCollection = MONTHS.slice(0, currentMonthIndex + 1).map((month) => ({
    month,
    expected: round(monthExpected[MONTHS.indexOf(month)]),
    collected: round(collectedByMonth.get(month) || 0),
  }));

  const feeExpected = round(monthExpected[currentMonthIndex]);
  const feeCollected = round(collectedByMonth.get(currentMonth) || 0);

  return {
    statistics: {
      totalStudents: activeStudents + inactiveStudents,
      totalTeachers,
      totalClasses: currentYearClasses.length,
      totalFeeCollected: round(totalFeeCollected),
      outstandingDues: outstandingDuesTotal,
      newAdmissions,
    },
    studentOverview: {
      active: activeStudents,
      inactive: inactiveStudents,
    },
    feeOverview: {
      month: currentMonth,
      year: academicYear,
      expected: feeExpected,
      collected: feeCollected,
      outstanding: round(Math.max(0, feeExpected - feeCollected)),
    },
    studentsByClass: currentYearClasses.map((cls) => ({
      className: cls.className,
      totalStudents: cls.totalStudents || 0,
    })),
    monthlyCollection,
  };
};

export default { getDashboardData };