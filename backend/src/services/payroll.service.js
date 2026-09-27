import Payroll from '../models/payroll.model.js';
import Teacher from '../models/teacher.model.js';
import TeacherAttendance from '../models/teacherAttendance.model.js';
import Leave from '../models/leave.model.js';
import Holiday from '../models/holiday.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import attendanceRules from './attendanceRules.service.js';
import { ApiError } from '../utils/apiError.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Local-timezone date string (YYYY-MM-DD) for a Date. Avoids the UTC shift that
// Date#toISOString introduces for servers in positive timezones, keeping payroll
// period arithmetic aligned with attendance dates (stored as local midnights).
const toDateStr = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const parseDateStr = (value) => {
  const [y, m, d] = String(value).split('-').map((part) => parseInt(part, 10));
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

const round2 = (value) => Math.round(value * 100) / 100;

// Salary structure documents only store the teacherId reference. Teacher profile
// data (name/image) is joined here at read time — never duplicated into payroll.
const enrichWithTeacher = async (records) => {
  if (!records.length) return records;

  const teacherIds = [...new Set(records.map((record) => record.teacherId))];
  const teachers = await Teacher.find({ teacherId: { $in: teacherIds } })
    .select('_id teacherId fullName teacherImage')
    .lean();

  const teacherById = new Map(teachers.map((teacher) => [teacher.teacherId, teacher]));

  return records.map((record) => {
    const teacher = teacherById.get(record.teacherId);
    return {
      ...record,
      teacher: teacher
        ? { _id: teacher._id, teacherId: teacher.teacherId, fullName: teacher.fullName, teacherImage: teacher.teacherImage }
        : null,
    };
  });
};

const assertTeacherExists = async (teacherId) => {
  const teacher = await Teacher.findOne({ teacherId }).select('_id teacherId').lean();

  if (!teacher) {
    throw new ApiError(404, 'Teacher not found. Salary structure must reference an existing teacher.');
  }

  return teacher;
};

const assertNoActiveStructure = async (teacherId, excludeId = null) => {
  const filter = {
    teacherId,
    recordType: 'salary-structure',
    status: 'Active',
    isDeleted: { $ne: true },
  };

  if (excludeId) filter._id = { $ne: excludeId };

  const active = await Payroll.findOne(filter).lean();

  if (active) {
    throw new ApiError(409, 'An active salary structure already exists for this teacher');
  }
};

const createSalaryStructure = async (data) => {
  const teacherId = data.teacherId.trim();

  await assertTeacherExists(teacherId);
  await assertNoActiveStructure(teacherId);

  try {
    const structure = await Payroll.create({
      teacherId,
      salaryType: data.salaryType,
      basicSalary: data.basicSalary,
      effectiveFrom: data.effectiveFrom,
      status: data.status,
      recordType: 'salary-structure',
    });

    const [enriched] = await enrichWithTeacher([structure.toObject()]);
    return enriched;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'An active salary structure already exists for this teacher');
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const getSalaryStructures = async (query = {}) => {
  const { search, teacherId, status, recordType = 'salary-structure' } = query;

  const filter = { recordType, isDeleted: { $ne: true } };

  if (teacherId && teacherId.trim()) {
    filter.teacherId = teacherId.trim();
  } else if (search && search.trim()) {
    // Follows the project search convention for teacher ID/name.
    const pattern = new RegExp(escapeRegex(search.trim()), 'i');
    const matchedTeachers = await Teacher.find({
      $or: [{ fullName: pattern }, { teacherId: pattern }],
    })
      .select('teacherId')
      .lean();

    filter.teacherId = { $in: matchedTeachers.map((teacher) => teacher.teacherId) };
  }

  if (status && status.trim()) {
    filter.status = status.trim();
  }

  const structures = await Payroll.find(filter)
    .sort({ effectiveFrom: -1, createdAt: -1 })
    .lean();

  const enriched = await enrichWithTeacher(structures);

  return {
    structures: enriched,
    statistics: {
      totalStructures: structures.length,
      activeStructures: structures.filter((structure) => structure.status === 'Active').length,
      inactiveStructures: structures.filter((structure) => structure.status === 'Inactive').length,
    },
  };
};

const getSalaryStructureById = async (id) => {
  const structure = await Payroll.findOne({ _id: id, recordType: 'salary-structure', isDeleted: { $ne: true } }).lean();

  if (!structure) {
    throw new ApiError(404, 'Salary structure not found');
  }

  const [enriched] = await enrichWithTeacher([structure]);
  return enriched;
};

const updateSalaryStructure = async (id, data) => {
  const existing = await Payroll.findOne({ _id: id, recordType: 'salary-structure', isDeleted: { $ne: true } });

  if (!existing) {
    throw new ApiError(404, 'Salary structure not found');
  }

  const teacherId = data.teacherId !== undefined ? data.teacherId.trim() : existing.teacherId;
  const status = data.status !== undefined ? data.status : existing.status;

  if (data.teacherId !== undefined) {
    await assertTeacherExists(teacherId);
  }

  // One active structure per teacher: re-check when the teacher changes or the
  // record becomes Active.
  if (teacherId !== existing.teacherId || (status === 'Active' && existing.status !== 'Active')) {
    await assertNoActiveStructure(teacherId, id);
  }

  try {
    const updated = await Payroll.findByIdAndUpdate(
      id,
      {
        ...(data.teacherId !== undefined ? { teacherId } : {}),
        ...(data.salaryType !== undefined ? { salaryType: data.salaryType } : {}),
        ...(data.basicSalary !== undefined ? { basicSalary: data.basicSalary } : {}),
        ...(data.effectiveFrom !== undefined ? { effectiveFrom: data.effectiveFrom } : {}),
        ...(data.status !== undefined ? { status } : {}),
      },
      { new: true, runValidators: true },
    );

    const [enriched] = await enrichWithTeacher([updated.toObject()]);
    return enriched;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'An active salary structure already exists for this teacher');
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const deleteSalaryStructure = async (id) => {
  const existing = await Payroll.findOne({ _id: id, recordType: 'salary-structure', isDeleted: { $ne: true } });

  if (!existing) {
    throw new ApiError(404, 'Salary structure not found');
  }

  await Payroll.findByIdAndUpdate(id, { isDeleted: true });

  return existing;
};

// ─── Payroll generation ───────────────────────────────────────────────

// The active salary structure effective for the payroll period. Only status
// "Active" (server-enforced single-active-per-teacher) can back a payroll run.
const getActiveStructureForPeriod = async (teacherId, periodEnd) => {
  const structure = await Payroll.findOne({
    teacherId,
    recordType: 'salary-structure',
    status: 'Active',
    isDeleted: { $ne: true },
    effectiveFrom: { $lte: periodEnd },
  })
    .sort({ effectiveFrom: -1 })
    .lean();

  return structure;
};

// Working days for the period = calendar days minus the school's configured
// weekend days (School Settings) minus official holidays (appliesTo All or
// Teachers) — the same schedule the attendance module enforces, so no school
// timings are hard-coded here.
const buildWorkingDays = async (year, month, countEnd, firstDate) => {
  const settings = await SchoolSettings.getSettings();
  const weekendDays = settings.weekendEnabled ? settings.weekendDays : [];

  const holidays = await Holiday.find({
    startDate: { $lte: toDateStr(countEnd) },
    endDate: { $gte: toDateStr(firstDate) },
    $or: [{ appliesTo: 'All' }, { appliesTo: 'Teachers' }],
  })
    .select('startDate endDate')
    .lean();

  const holidayDates = new Set();
  holidays.forEach((holiday) => {
    let cursor = parseDateStr(holiday.startDate);
    let holidayEnd = parseDateStr(holiday.endDate);
    if (cursor < firstDate) cursor = new Date(firstDate);
    if (holidayEnd > countEnd) holidayEnd = new Date(countEnd);
    while (cursor <= holidayEnd) {
      holidayDates.add(toDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const workingDays = [];
  const cursor = new Date(firstDate);
  while (cursor <= countEnd) {
    const dayName = cursor.toLocaleDateString('en-US', { weekday: 'long' });
    if (!weekendDays.includes(dayName) && !holidayDates.has(toDateStr(cursor))) {
      workingDays.push(toDateStr(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return workingDays;
};

// Effective check-out for an attended day that never checked out: the existing
// attendance auto-checkout policy closes such a day at the configured School End
// Time once it has passed. Mirrors teacherAttendanceService.settleAutoCheckouts
// so working hours are preserved for reporting even when no check-out exists.
const resolveDefaultCheckOut = async (record) => {
  if (record.checkOut) return new Date(record.checkOut);
  if (!record.checkIn) return null;

  const settings = await SchoolSettings.getSettings();
  const endStr = settings.schoolEndTime?.trim();
  if (!endStr) return null;

  const endMin = attendanceRules.parseTime(endStr);
  if (endMin === null) return null;

  const cutoff = parseDateStr(toDateStr(record.date));
  cutoff.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
  if (cutoff.getTime() > Date.now()) return null;

  const checkInTime = new Date(record.checkIn).getTime();
  if (checkInTime > cutoff.getTime()) return null;

  return cutoff;
};

const assertNotFuturePeriod = (periodEndOfMonth) => {
  const now = new Date();
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (periodEndOfMonth > currentMonthEnd) {
    throw new ApiError(400, 'Payroll cannot be generated for a future payroll period');
  }
};

const generatePayroll = async (data = {}) => {
  const teacherId = String(data.teacherId || '').trim();
  const month = Number(data.month);
  const year = Number(data.year);

  const teacher = await Teacher.findOne({ teacherId })
    .select('_id teacherId fullName academicYear')
    .lean();
  if (!teacher) {
    throw new ApiError(404, `Teacher not found for ID: ${teacherId}`);
  }

  const periodStart = new Date(year, month - 1, 1);
  const periodEndOfMonth = new Date(year, month, 0);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  assertNotFuturePeriod(periodEndOfMonth);

  // Current-month runs only count the days elapsed so far — future dates are
  // never counted as worked or as absent.
  const countEnd = periodEndOfMonth < today ? periodEndOfMonth : today;

  const structure = await getActiveStructureForPeriod(teacherId, periodEndOfMonth);
  if (!structure) {
    throw new ApiError(
      400,
      `No active salary structure exists for teacher ${teacherId} effective on or before ${toDateStr(periodEndOfMonth)}. `,
    );
  }
  const basicSalary = Number(structure.basicSalary);

  const workingDays = await buildWorkingDays(year, month, countEnd, periodStart);
  if (workingDays.length === 0) {
    throw new ApiError(400, `The payroll period ${month}/${year} has no working days`);
  }

  // Attendance records for the teacher within the month.
  const nextMonth = new Date(year, month, 1);
  const attendanceRecords = await TeacherAttendance.find({
    teacher: teacher._id,
    date: { $gte: periodStart, $lt: nextMonth },
  })
    .select('date status checkIn checkOut')
    .lean();

  const recordByDate = new Map();
  attendanceRecords.forEach((record) => recordByDate.set(toDateStr(record.date), record));

  // Approved leave covering any day of the period. Days in this set are Leave
  // days (zero salary deduction) even when no attendance record was marked.
  const leaves = await Leave.find({
    type: 'Teacher',
    teacher: teacher._id,
    status: 'Approved',
    fromDate: { $lte: toDateStr(countEnd) },
    toDate: { $gte: toDateStr(periodStart) },
  })
    .select('fromDate toDate reason')
    .lean();

  const leaveDates = new Set();
  leaves.forEach((leave) => {
    let cursor = parseDateStr(leave.fromDate);
    let leaveEnd = parseDateStr(leave.toDate);
    if (cursor < periodStart) cursor = new Date(periodStart);
    if (leaveEnd > countEnd) leaveEnd = new Date(countEnd);
    while (cursor <= leaveEnd) {
      leaveDates.add(toDateStr(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  // Handle months with no attendance/leave data safely: refuse rather than
  // generating a payroll that silently treats every working day as absent.
  if (attendanceRecords.length === 0 && leaveDates.size === 0) {
    throw new ApiError(
      400,
      `No attendance or approved leave records found for teacher ${teacherId} in ${month}/${year}. Mark attendance before generating payroll.`,
    );
  }

  let presentDaysCount = 0;
  let lateDaysCount = 0;
  let leaveDaysCount = 0;
  let absentDaysCount = 0;
  let totalWorkingHours = 0;

  for (const day of workingDays) {
    const record = recordByDate.get(day);

    if (record) {
      if (record.status === 'Present') {
        presentDaysCount += 1;
      } else if (record.status === 'Late') {
        presentDaysCount += 1;
        lateDaysCount += 1;
      } else if (record.status === 'Leave') {
        leaveDaysCount += 1;
      } else if (record.status === 'Absent') {
        absentDaysCount += 1;
      }

      if (['Present', 'Late'].includes(record.status)) {
        const checkIn = new Date(record.checkIn);
        const checkOut = await resolveDefaultCheckOut(record);
        if (checkOut) {
          const hours = (checkOut.getTime() - checkIn.getTime()) / 3600000;
          if (hours > 0) totalWorkingHours += hours;
        }
      }
    } else if (leaveDates.has(day)) {
      leaveDaysCount += 1;
    } else {
      // A working day with no attendance record counts as absent: no record of
      // work means the day was not worked. Approved leave is the only non-attendance
      // status that keeps a day out of the deduction (leaveDays).
      absentDaysCount += 1;
    }
  }

  // Salary: deduction is proportional to absent days against the month's actual
  // working-day count; Leave days never reduce salary.
  const perDayRate = basicSalary / workingDays.length;
  const salaryDeduction = round2(perDayRate * absentDaysCount);
  const netSalary = round2(basicSalary - salaryDeduction);

  try {
    const payroll = await Payroll.create({
      teacherId,
      salaryStructureId: String(structure._id),
      payrollMonth: month,
      payrollYear: year,
      basicSalary,
      workingDays: workingDays.length,
      presentDays: presentDaysCount,
      absentDays: absentDaysCount,
      leaveDays: leaveDaysCount,
      lateDays: lateDaysCount,
      totalWorkingHours: round2(totalWorkingHours),
      salaryDeduction,
      netSalary,
      status: 'Generated',
      generatedAt: new Date(),
      recordType: 'payroll',
    });

    const [enriched] = await enrichWithTeacher([payroll.toObject()]);
    return enriched;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, `Payroll already exists for teacher ${teacherId} for ${month}/${year}`);
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getPayrolls = async (query = {}) => {
  const { search, teacherId, month, year, status } = query;

  const filter = { recordType: 'payroll', isDeleted: { $ne: true } };

  if (teacherId && teacherId.trim()) {
    filter.teacherId = teacherId.trim();
  } else if (search && search.trim()) {
    // Follows the project search convention for teacher ID/name.
    const pattern = new RegExp(escapeRegex(search.trim()), 'i');
    const matchedTeachers = await Teacher.find({
      $or: [{ fullName: pattern }, { teacherId: pattern }],
    })
      .select('teacherId')
      .lean();

    filter.teacherId = { $in: matchedTeachers.map((teacher) => teacher.teacherId) };
  }

  if (month !== undefined && month !== '') {
    filter.payrollMonth = Number(month);
  }
  if (year !== undefined && year !== '') {
    filter.payrollYear = Number(year);
  }
  if (status && status.trim()) {
    filter.status = status.trim();
  }

  const payrolls = await Payroll.find(filter)
    .sort({ payrollYear: -1, payrollMonth: -1, createdAt: -1 })
    .lean();

  const enriched = await enrichWithTeacher(payrolls);

  return {
    payrolls: enriched,
    statistics: {
      totalPayrolls: payrolls.length,
      generatedPayrolls: payrolls.filter((payroll) => payroll.status === 'Generated').length,
      paidPayrolls: payrolls.filter((payroll) => payroll.status === 'Paid').length,
      totalNetSalary: round2(payrolls.reduce((sum, payroll) => sum + (payroll.netSalary || 0), 0)),
    },
  };
};

const getPayrollById = async (id) => {
  const payroll = await Payroll.findOne({ _id: id, recordType: 'payroll', isDeleted: { $ne: true } }).lean();

  if (!payroll) {
    throw new ApiError(404, 'Payroll record not found');
  }

  const [enriched] = await enrichWithTeacher([payroll]);
  return enriched;
};

const deletePayroll = async (id) => {
  const payroll = await Payroll.findOne({ _id: id, recordType: 'payroll', isDeleted: { $ne: true } });

  if (!payroll) {
    throw new ApiError(404, 'Payroll record not found');
  }

  await Payroll.findByIdAndUpdate(id, { isDeleted: true });

  return payroll;
};

// ─── Salary History / Payments ─────────────────────────────────────

// Attaches the teacher profile plus a lightweight snapshot of the settled
// payroll run to each payment record so history views never need extra calls.
const enrichPayments = async (records) => {
  if (!records.length) return records;

  const teacherEnriched = await enrichWithTeacher(records);

  const payrollIds = [...new Set(teacherEnriched.map((record) => record.payrollId).filter(Boolean))];

  const payrolls = payrollIds.length
    ? await Payroll.find({ _id: { $in: payrollIds }, recordType: 'payroll', isDeleted: { $ne: true } })
        .select('teacherId basicSalary salaryDeduction netSalary status payrollMonth payrollYear salaryStructureId')
        .lean()
    : [];

  const payrollById = new Map(payrolls.map((payroll) => [String(payroll._id), payroll]));

  return teacherEnriched.map((record) => ({
    ...record,
    payroll: record.payrollId ? payrollById.get(String(record.payrollId)) || null : null,
  }));
};

const findPayrollForPayment = async (payrollId) => {
  const payroll = await Payroll.findOne({ _id: payrollId, recordType: 'payroll', isDeleted: { $ne: true } }).lean();

  if (!payroll) {
    throw new ApiError(404, 'Payroll record not found. A payment must reference an existing payroll record.');
  }

  return payroll;
};

const assertPaymentDateNotFuture = (paymentDate) => {
  const now = new Date();
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (paymentDate >= startOfTomorrow) {
    throw new ApiError(400, 'Payment date cannot be in the future');
  }
};

const assertPaymentAmount = (amountPaid, payroll) => {
  const netSalary = Number(payroll.netSalary);

  if (!Number.isFinite(netSalary) || netSalary <= 0) {
    throw new ApiError(400, 'Linked payroll record has no net salary to pay against');
  }

  if (amountPaid > netSalary) {
    throw new ApiError(400, `Payment amount (${amountPaid}) cannot exceed the payroll net salary (${netSalary})`);
  }
};

const assertNoExistingPayment = async (payrollId) => {
  const existing = await Payroll.findOne({
    payrollId,
    recordType: 'payment',
    isDeleted: { $ne: true },
  }).lean();

  if (existing) {
    throw new ApiError(409, 'A payment record already exists for this payroll');
  }
};

const createPayment = async (data) => {
  const payrollId = String(data.payrollId);
  const payroll = await findPayrollForPayment(payrollId);

  if (payroll.status === 'Paid') {
    throw new ApiError(409, 'Payroll is already marked as paid');
  }

  await assertNoExistingPayment(payroll._id);
  assertPaymentAmount(data.amountPaid, payroll);
  assertPaymentDateNotFuture(data.paymentDate);

  const status = data.status === undefined ? 'Paid' : data.status;

  try {
    const payment = await Payroll.create({
      payrollId: payroll._id,
      teacherId: payroll.teacherId,
      payrollMonth: payroll.payrollMonth,
      payrollYear: payroll.payrollYear,
      basicSalary: payroll.basicSalary,
      amountPaid: data.amountPaid,
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference || '',
      status,
      recordType: 'payment',
    });

    // Settling the payroll is tied to the payment being actually paid: a
    // Pending payment records the obligation without flipping payroll status.
    if (status === 'Paid' && payroll.status !== 'Paid') {
      await Payroll.findByIdAndUpdate(payroll._id, { status: 'Paid' });
    }

    const [enriched] = await enrichPayments([payment.toObject()]);
    return enriched;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'A payment record already exists for this payroll');
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const getPayments = async (query = {}) => {
  const {
    search,
    teacherId,
    month,
    year,
    status,
    paymentMethod,
    fromDate,
    toDate,
    page = 1,
    limit = 10,
  } = query;

  const filter = { recordType: 'payment', isDeleted: { $ne: true } };

  if (teacherId && teacherId.trim()) {
    filter.teacherId = teacherId.trim();
  } else if (search && search.trim()) {
    // Follows the project search convention for teacher ID/name.
    const pattern = new RegExp(escapeRegex(search.trim()), 'i');
    const matchedTeachers = await Teacher.find({
      $or: [{ fullName: pattern }, { teacherId: pattern }],
    })
      .select('teacherId')
      .lean();

    filter.teacherId = { $in: matchedTeachers.map((teacher) => teacher.teacherId) };
  }

  if (month !== undefined && month !== '') {
    filter.payrollMonth = Number(month);
  }
  if (year !== undefined && year !== '') {
    filter.payrollYear = Number(year);
  }
  if (status && status.trim()) {
    filter.status = status.trim();
  }
  if (paymentMethod && paymentMethod.trim()) {
    filter.paymentMethod = paymentMethod.trim();
  }

  if (fromDate || toDate) {
    filter.paymentDate = {};
    if (fromDate) {
      const start = parseDateStr(String(fromDate).slice(0, 10));
      filter.paymentDate.$gte = start;
    }
    if (toDate) {
      const end = parseDateStr(String(toDate).slice(0, 10));
      end.setHours(23, 59, 59, 999);
      filter.paymentDate.$lte = end;
    }
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [payments, totalItems] = await Promise.all([
    Payroll.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    Payroll.countDocuments(filter),
  ]);

  const enriched = await enrichPayments(payments);

  return {
    payments: enriched,
    pagination: {
      currentPage,
      totalPages: Math.max(1, Math.ceil(totalItems / itemsPerPage)),
      totalItems,
      limit: itemsPerPage,
    },
  };
};

const getPaymentById = async (id) => {
  const payment = await Payroll.findOne({ _id: id, recordType: 'payment', isDeleted: { $ne: true } }).lean();

  if (!payment) {
    throw new ApiError(404, 'Payment record not found');
  }

  const [enriched] = await enrichPayments([payment]);
  return enriched;
};

const updatePayment = async (id, data) => {
  const existing = await Payroll.findOne({ _id: id, recordType: 'payment', isDeleted: { $ne: true } });

  if (!existing) {
    throw new ApiError(404, 'Payment record not found');
  }

  const payroll = await findPayrollForPayment(existing.payrollId);

  // Once a payment is Paid it is the payroll's settlement record; reverting it
  // to Pending would leave the payroll Paid with no valid payment behind it.
  if (existing.status === 'Paid' && data.status !== undefined && data.status !== 'Paid') {
    throw new ApiError(400, 'A paid payment cannot be reverted to Pending');
  }

  if (data.amountPaid !== undefined) {
    assertPaymentAmount(data.amountPaid, payroll);
  }
  if (data.paymentDate !== undefined) {
    assertPaymentDateNotFuture(data.paymentDate);
  }

  try {
    const updated = await Payroll.findByIdAndUpdate(
      id,
      {
        ...(data.amountPaid !== undefined ? { amountPaid: data.amountPaid } : {}),
        ...(data.paymentDate !== undefined ? { paymentDate: data.paymentDate } : {}),
        ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod } : {}),
        ...(data.paymentReference !== undefined ? { paymentReference: data.paymentReference } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      { new: true, runValidators: true },
    );

    if (updated.status === 'Paid' && payroll.status !== 'Paid') {
      await Payroll.findByIdAndUpdate(payroll._id, { status: 'Paid' });
    }

    const [enriched] = await enrichPayments([updated.toObject()]);
    return enriched;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'A payment record already exists for this payroll');
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const deletePayment = async (id) => {
  const payment = await Payroll.findOne({ _id: id, recordType: 'payment', isDeleted: { $ne: true } });

  if (!payment) {
    throw new ApiError(404, 'Payment record not found');
  }

  await Payroll.findByIdAndUpdate(id, { isDeleted: true });

  // Deleting the payment undoes its settlement: the payroll returns to the
  // pre-payment Pending state so it can be paid again.
  if (payment.status === 'Paid' && payment.payrollId) {
    const payroll = await Payroll.findOne({
      _id: payment.payrollId,
      recordType: 'payroll',
      isDeleted: { $ne: true },
    }).lean();

    if (payroll && payroll.status === 'Paid') {
      await Payroll.findByIdAndUpdate(payroll._id, { status: 'Pending' });
    }
  }

  return payment;
};

export default {
  createSalaryStructure,
  getSalaryStructures,
  getSalaryStructureById,
  updateSalaryStructure,
  deleteSalaryStructure,
  generatePayroll,
  getPayrolls,
  getPayrollById,
  deletePayroll,
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
};