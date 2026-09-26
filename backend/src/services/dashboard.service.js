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
    outstandingResult,
    studentOverviewRows,
    totalTeachers,
    newAdmissions,
    structures,
    feeStudents,
    feeCollectionRows,
  ] = await Promise.all([
    classService.getAllClasses(),
    feeOutstandingService.getOutstandingDues({ academicYear }),
    Student.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Teacher.countDocuments(),
    Student.countDocuments({ admissionDate: { $gte: monthStart, $lt: monthEnd } }),
    FeeStructure.find({ academicYear, isDeleted: { $ne: true }, status: 'Active' }),
    Student.find({ status: 'Active' }).select('class admissionDate').lean(),
    FeeCollection.aggregate([
      { $match: { academicYear, voucherId: null } },
      { $group: { _id: { feeType: '$feeType', month: '$month' }, total: { $sum: '$amountPaid' } } },
    ]).then((rows) => rows.map((row) => ({ feeType: row._id.feeType, month: row._id.month, total: Number(row.total) || 0 }))),
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

  const totalFeeCollected = feeCollectionRows.reduce((sum, row) => sum + row.total, 0);

  const collectedByMonth = new Map(
    feeCollectionRows
      .filter((row) => row.feeType === 'Monthly')
      .map((row) => [row.month, row.total]),
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
      outstandingDues: round(
        (outstandingResult.entries || []).reduce((sum, entry) => sum + entry.totalOutstanding, 0),
      ),
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