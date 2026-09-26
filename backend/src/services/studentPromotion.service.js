import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import StudentPromotion from '../models/studentPromotion.model.js';
import AuditLog from '../models/auditLog.model.js';
import { ApiError } from '../utils/apiError.js';
import classValidation from './classValidation.service.js';

const filterStudentsForPromotion = async (query) => {
  const { class: className, academicYear } = query;

  if (!className) {
    throw new ApiError(400, 'Class filter is required');
  }

  const filter = { status: 'Active' };
  if (className) filter.class = className;
  if (academicYear) filter.academicYear = academicYear;

  const students = await Student.find(filter)
    .select('studentId studentImage fullName fatherName class academicYear status')
    .sort({ fullName: 1 });

  return students;
};

const toEnrollmentObject = (e) => (e && typeof e.toObject === 'function' ? e.toObject() : { ...e });

const buildPromotionEnrollments = (student, fromClass, fromAcademicYear, toClass, toAcademicYear) => {
  let enrollments = (student.enrollments || []).map((e) => toEnrollmentObject(e));

  enrollments = enrollments.filter((e) => !(e.academicYear === toAcademicYear && e.status === 'Reversed'));

  const fromIdx = enrollments.findIndex((e) => e.academicYear === fromAcademicYear);
  if (fromIdx >= 0) {
    enrollments[fromIdx] = { ...enrollments[fromIdx], status: 'Historical', class: fromClass };
  } else {
    enrollments.push({ academicYear: fromAcademicYear, class: fromClass, status: 'Historical', source: 'Promotion' });
  }

  enrollments.push({ academicYear: toAcademicYear, class: toClass, status: 'Active', source: 'Promotion' });

  return enrollments;
};

const promoteStudents = async (studentIds, fromClass, toClass, fromAcademicYear, toAcademicYear, remarks, adminId, adminName) => {
  const students = await Student.find({ studentId: { $in: studentIds } }).select('_id studentId studentImage admissionNumber fullName fatherName class academicYear status enrollments');

  if (students.length !== studentIds.length) {
    const foundIds = students.map((s) => s.studentId);
    const missing = studentIds.filter((id) => !foundIds.includes(id));
    throw new ApiError(404, `Students not found: ${missing.join(', ')}`);
  }

  const errors = [];
  for (const s of students) {
    if (s.status !== 'Active') errors.push(`${s.studentId} is ${s.status}`);
    if (s.class !== fromClass) errors.push(`${s.studentId} class is ${s.class}, expected ${fromClass}`);
    if (s.academicYear !== fromAcademicYear) errors.push(`${s.studentId} academic year is ${s.academicYear}, expected ${fromAcademicYear}`);
    const alreadyInYear = (s.enrollments || []).some((e) => e.academicYear === toAcademicYear && e.status !== 'Reversed');
    if (alreadyInYear) errors.push(`${s.studentId} is already enrolled in academic year ${toAcademicYear}`);
  }
  if (errors.length > 0) {
    throw new ApiError(400, `Validation failed: ${errors.join('; ')}`);
  }

  const studentObjectIds = students.map((s) => s._id);

  const existingPromotions = await StudentPromotion.find({
    studentId: { $in: studentObjectIds },
    toClass,
    toAcademicYear,
    status: 'Promoted',
  }).select('studentId');
  const existingIds = new Set(existingPromotions.map((p) => p.studentId.toString()));
  const alreadyPromoted = students.filter((s) => existingIds.has(s._id.toString()));
  if (alreadyPromoted.length > 0) {
    throw new ApiError(409, `Already promoted to ${toClass} (${toAcademicYear}): ${alreadyPromoted.map((s) => s.studentId).join(', ')}`);
  }

  await classValidation.validateClassExists(toClass, toAcademicYear);

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    for (const s of students) {
      await Student.updateOne(
        { _id: s._id },
        {
          $set: {
            class: toClass,
            academicYear: toAcademicYear,
            enrollments: buildPromotionEnrollments(s, fromClass, fromAcademicYear, toClass, toAcademicYear),
          },
        },
        { session },
      );
    }

    const logs = students.map((s) => ({
      studentId: s._id,
      studentSnapshot: {
        studentId: s.studentId,
        fullName: s.fullName,
        fatherName: s.fatherName,
      },
      studentCode: s.studentId,
      studentImage: s.studentImage,
      admissionNumber: s.admissionNumber,
      studentName: s.fullName,
      fromClass,
      toClass,
      fromAcademicYear,
      toAcademicYear,
      status: 'Promoted',
      promotedBy: adminId,
      promotedByName: adminName,
      promotedAt: new Date(),
      remarks: remarks || null,
    }));

    await StudentPromotion.insertMany(logs, { session });

    await AuditLog.create([{
      action: 'PROMOTE',
      module: 'PROMOTION',
      entityId: `bulk-${studentIds.length}-students`,
      entityType: 'Student',
      performedBy: adminId,
      details: {
        count: students.length,
        fromClass,
        toClass,
        fromAcademicYear,
        toAcademicYear,
        studentIds: students.map((s) => s.studentId),
      },
    }], { session });

    await session.commitTransaction();
    return { updatedCount: students.length };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const enrichPromotions = async (promotions) => {
  if (!promotions || promotions.length === 0) return promotions;

  const studentIds = [...new Set(promotions.map(p => p.studentId).filter(Boolean))];
  if (studentIds.length === 0) return promotions;

  const students = await Student.find({ _id: { $in: studentIds } })
    .select('fullName fatherName studentImage studentId admissionNumber')
    .lean();

  const studentMap = {};
  students.forEach(s => { studentMap[s._id.toString()] = s; });

  return promotions.map(p => {
    const sid = p.studentId?.toString();
    const s = studentMap[sid];
    if (s) {
      return {
        ...p,
        studentName: s.fullName,
        studentCode: s.studentId,
        studentImage: s.studentImage,
        admissionNumber: s.admissionNumber,
        studentSnapshot: {
          ...p.studentSnapshot,
          fullName: s.fullName,
          fatherName: s.fatherName,
        },
      };
    }
    return p;
  });
};

const getPromotionHistory = async (query) => {
  const { studentId, fromClass, toClass, fromAcademicYear, toAcademicYear } = query;

  const filter = {};
  if (studentId) filter.studentId = studentId;
  if (fromClass) filter.fromClass = fromClass;
  if (toClass) filter.toClass = toClass;
  if (fromAcademicYear) filter.fromAcademicYear = fromAcademicYear;
  if (toAcademicYear) filter.toAcademicYear = toAcademicYear;

  let promotions = await StudentPromotion.find(filter)
    .populate('promotedBy', 'fullName email')
    .sort({ promotedAt: -1 })
    .lean();

  promotions = await enrichPromotions(promotions);

  const now = new Date();
  const currentYear = String(now.getFullYear());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const total = await StudentPromotion.countDocuments(filter);
  const thisYear = filter.toAcademicYear
    ? promotions.filter((p) => String(p.toAcademicYear) === currentYear).length
    : await StudentPromotion.countDocuments({ ...filter, toAcademicYear: currentYear });
  const thisMonth = await StudentPromotion.countDocuments({
    ...filter,
    promotedAt: { $gte: startOfMonth },
  });
  const latest = promotions.length > 0 ? promotions[0].studentName : 'N/A';

  return {
    promotions,
    cards: { total, thisYear, thisMonth, latest },
  };
};

const getStudentPromotions = async (query) => {
  const filter = {};
  if (query.fromClass) filter.fromClass = query.fromClass;
  if (query.toClass) filter.toClass = query.toClass;
  if (query.fromAcademicYear) filter.fromAcademicYear = query.fromAcademicYear;
  if (query.toAcademicYear) filter.toAcademicYear = query.toAcademicYear;

  let promotions = await StudentPromotion.find(filter)
    .populate('promotedBy', 'fullName')
    .select('studentId studentCode studentName studentImage fromClass toClass fromAcademicYear toAcademicYear promotedAt promotedBy promotedByName status reversed reversedAt')
    .sort({ promotedAt: -1 })
    .lean();

  promotions = await enrichPromotions(promotions);

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const total = await StudentPromotion.countDocuments(filter);
  const thisYear = await StudentPromotion.countDocuments({
    ...filter,
    promotedAt: { $gte: startOfYear },
  });
  const thisMonth = await StudentPromotion.countDocuments({
    ...filter,
    promotedAt: { $gte: startOfMonth },
  });

  let latest = 'N/A';
  if (promotions.length > 0) {
    const d = new Date(promotions[0].promotedAt);
    latest = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return {
    promotions,
    cards: { total, thisYear, thisMonth, latest },
  };
};

const deleteStudentPromotion = async (id) => {
  const promotion = await StudentPromotion.findByIdAndDelete(id);
  if (!promotion) {
    throw new ApiError(404, 'Promotion history not found');
  }
  return promotion;
};

const reversePromotion = async (id, adminId, adminName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(404, 'Promotion history not found');
  }

  const promotion = await StudentPromotion.findById(id);
  if (!promotion) {
    throw new ApiError(404, 'Promotion history not found');
  }
  if (promotion.status !== 'Promoted') {
    throw new ApiError(400, 'Only completed promotions can be reversed');
  }
  if (promotion.reversed) {
    throw new ApiError(409, 'This promotion has already been reversed');
  }

  const student = await Student.findById(promotion.studentId);
  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  const latest = await StudentPromotion.findOne({
    studentId: student._id,
    status: 'Promoted',
    reversed: { $ne: true },
  }).sort({ promotedAt: -1 });

  if (!latest || latest._id.toString() !== promotion._id.toString()) {
    throw new ApiError(400, 'Only the most recent promotion can be reversed. Please reverse later promotions first.');
  }

  if (student.class !== promotion.toClass || student.academicYear !== promotion.toAcademicYear) {
    throw new ApiError(400, "The student's current enrollment does not match this promotion. Reversal is not possible.");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const updated = await StudentPromotion.findByIdAndUpdate(
      id,
      { reversed: true, reversedAt: new Date(), reversedBy: adminId },
      { new: true, session },
    );

    const studentDoc = await Student.findById(student._id).session(session);
    let enrollments = (studentDoc.enrollments || []).map((e) => toEnrollmentObject(e));

    enrollments = enrollments.map((e) => {
      if (e.academicYear === promotion.toAcademicYear && e.status === 'Active') {
        return { ...e, status: 'Reversed' };
      }
      return e;
    });

    const fromIdx = enrollments.findIndex(
      (e) => e.academicYear === promotion.fromAcademicYear && e.class === promotion.fromClass,
    );
    if (fromIdx >= 0) {
      enrollments[fromIdx] = { ...enrollments[fromIdx], status: 'Active' };
    } else {
      enrollments.push({
        academicYear: promotion.fromAcademicYear,
        class: promotion.fromClass,
        status: 'Active',
        source: 'Reversal',
      });
    }

    await Student.updateOne(
      { _id: student._id },
      { $set: { class: promotion.fromClass, academicYear: promotion.fromAcademicYear, enrollments } },
      { session },
    );

    await AuditLog.create([{
      action: 'REVERSE_PROMOTION',
      module: 'PROMOTION',
      entityId: promotion._id.toString(),
      entityType: 'Student',
      performedBy: adminId,
      details: {
        studentId: student.studentId,
        fromClass: promotion.fromClass,
        toClass: promotion.toClass,
        fromAcademicYear: promotion.fromAcademicYear,
        toAcademicYear: promotion.toAcademicYear,
        reversedBy: adminName || adminId,
      },
    }], { session });

    await session.commitTransaction();
    return updated;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export default { filterStudentsForPromotion, promoteStudents, getPromotionHistory, getStudentPromotions, deleteStudentPromotion, reversePromotion };
