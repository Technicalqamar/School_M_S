import crypto from 'crypto';
import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import IdCardManagement from '../models/idCardManagement.model.js';
import Counter from '../models/counter.model.js';
import { ApiError } from '../utils/apiError.js';

const CARD_STATUSES = ['Pending', 'Generated', 'Printed'];

// ─── Helpers ────────────────────────────────────────────────────────

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const buildStudentFilter = ({ academicYear, className, search, studentIds } = {}) => {
  const filter = { status: 'Active' };

  if (academicYear) {
    filter.academicYear = academicYear;
  }

  if (className && className !== 'All Classes') {
    filter.class = className;
  }

  if (search && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { fullName: { $regex: q, $options: 'i' } },
      { studentId: { $regex: q, $options: 'i' } },
    ];
  }

  if (Array.isArray(studentIds) && studentIds.length > 0) {
    filter._id = { $in: studentIds.map((id) => new mongoose.Types.ObjectId(id)) };
  }

  return filter;
};

const getCardMap = async (studentIds) => {
  const cards = await IdCardManagement.find({ student: { $in: studentIds } }).lean();
  const map = {};
  cards.forEach((card) => {
    map[card.student.toString()] = card;
  });
  return map;
};

const deriveCardStatus = (card) => {
  if (!card) return 'Pending';
  if (card.status === 'Printed') return 'Printed';
  if (card.qrValue) return 'Generated';
  return 'Pending';
};

const generateQRValue = (student) =>
  `QR-${student.studentId}-${crypto.randomBytes(8).toString('hex')}`;

const serializeCard = (card) => {
  if (!card) return null;
  return {
    qrValue: card.qrValue || '',
    cardStatus: card.status,
    template: card.template,
    frontDesign: card.frontDesign || null,
    backDesign: card.backDesign || null,
    generatedAt: card.generatedAt || null,
    printedAt: card.printedAt || null,
  };
};

// ─── Queries ────────────────────────────────────────────────────────

const getStudentsWithCards = async (filters = {}) => {
  const filter = buildStudentFilter(filters);
  const students = await Student.find(filter)
    .select('_id studentId fullName studentImage class academicYear status')
    .sort({ fullName: 1 })
    .lean();

  if (students.length === 0) {
    return {
      students: [],
      stats: { total: 0, generated: 0, printed: 0, pending: 0 },
    };
  }

  const cardMap = await getCardMap(students.map((s) => s._id));

  let list = students.map((s) => {
    const card = cardMap[s._id.toString()] || null;
    return {
      _id: s._id,
      studentId: s.studentId,
      fullName: s.fullName,
      studentImage: s.studentImage || '',
      class: s.class,
      academicYear: s.academicYear,
      status: s.status,
      cardStatus: deriveCardStatus(card),
      card: serializeCard(card),
    };
  });

  if (filters.status && filters.status !== 'All') {
    list = list.filter((s) => s.cardStatus === filters.status);
  }

  return {
    students: list,
    stats: {
      total: list.length,
      generated: list.filter((s) => s.cardStatus === 'Generated').length,
      printed: list.filter((s) => s.cardStatus === 'Printed').length,
      pending: list.filter((s) => s.cardStatus === 'Pending').length,
    },
  };
};

// ─── QR Code Generation ─────────────────────────────────────────────

const generateQRCodes = async (data = {}, userId) => {
  const { academicYear, className, studentIds, regenerate = false } = data;

  if (!academicYear && !(Array.isArray(studentIds) && studentIds.length > 0)) {
    throw new ApiError(400, 'Either academic year or student IDs are required');
  }

  const filter = buildStudentFilter({ academicYear, className, studentIds });
  const students = await Student.find(filter)
    .select('_id studentId fullName class academicYear status')
    .sort({ studentId: 1 })
    .lean();

  if (students.length === 0) {
    throw new ApiError(404, 'No active students found for the selected filters');
  }

  const cardMap = await getCardMap(students.map((s) => s._id));

  const generated = [];
  const skipped = [];

  for (const student of students) {
    const existing = cardMap[student._id.toString()] || null;

    if (existing?.qrValue && !regenerate) {
      skipped.push({
        studentId: student.studentId,
        fullName: student.fullName,
        qrValue: existing.qrValue,
      });
      continue;
    }

    let cardNumber = existing?.cardNumber || null;
    if (!cardNumber) {
      const seq = await Counter.increment('idCard');
      cardNumber = `CRD-${String(seq).padStart(6, '0')}`;
    }

    const qrValue = generateQRValue(student);

    const update = {
      $set: {
        student: student._id,
        cardNumber,
        qrValue,
        status: 'Generated',
        generatedAt: new Date(),
        generatedBy: userId,
        template: existing?.template || 'vertical',
      },
    };
    if (existing?.frontDesign) update.$set.frontDesign = existing.frontDesign;
    if (existing?.backDesign) update.$set.backDesign = existing.backDesign;
    if (existing?.printedAt) update.$unset = { printedAt: '' };

    const card = await IdCardManagement.findOneAndUpdate(
      { student: student._id },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    generated.push({
      studentId: student.studentId,
      fullName: student.fullName,
      class: student.class,
      academicYear: student.academicYear,
      qrValue: card.qrValue,
      cardStatus: card.status,
    });
  }

  return {
    totalStudents: students.length,
    generatedCount: generated.length,
    skippedCount: skipped.length,
    generated,
    skipped,
  };
};

const regenerateQRCode = async (studentId, userId) => {
  if (!isValidObjectId(studentId)) {
    throw new ApiError(400, 'Invalid student ID');
  }

  const student = await Student.findById(studentId)
    .select('_id studentId fullName class academicYear status')
    .lean();

  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  const qrValue = generateQRValue(student);

  const card = await IdCardManagement.findOneAndUpdate(
    { student: student._id },
    {
      $set: {
        qrValue,
        status: 'Generated',
        generatedAt: new Date(),
        generatedBy: userId,
      },
      $unset: { printedAt: '' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  return {
    studentId: student.studentId,
    fullName: student.fullName,
    class: student.class,
    academicYear: student.academicYear,
    cardNumber: card.cardNumber,
    qrValue: card.qrValue,
    cardStatus: card.status,
  };
};

// ─── Card Status / Design ───────────────────────────────────────────

const markAsPrinted = async (studentIds, userId) => {
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new ApiError(400, 'Student IDs are required');
  }

  const validIds = studentIds.filter((id) => isValidObjectId(id));
  if (validIds.length === 0) {
    throw new ApiError(400, 'No valid student IDs provided');
  }

  const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));

  const cards = await IdCardManagement.find({ student: { $in: objectIds } }).select('qrValue').lean();
  if (cards.some((c) => !c.qrValue)) {
    throw new ApiError(400, 'Cannot mark cards as printed before QR code generation');
  }

  const result = await IdCardManagement.updateMany(
    { student: { $in: objectIds } },
    { $set: { status: 'Printed', printedAt: new Date() } },
  );

  return { updatedCount: result.modifiedCount, updatedById: userId };
};

const updateCardDesign = async (studentId, data = {}, userId) => {
  if (!isValidObjectId(studentId)) {
    throw new ApiError(400, 'Invalid student ID');
  }

  const { template, frontDesign, backDesign } = data;

  if (!template && !frontDesign && !backDesign) {
    throw new ApiError(400, 'Provide at least one of template, frontDesign or backDesign');
  }

  const update = { $set: {} };
  if (template) update.$set.template = template;
  if (frontDesign && typeof frontDesign === 'object') update.$set.frontDesign = frontDesign;
  if (backDesign && typeof backDesign === 'object') update.$set.backDesign = backDesign;

  const card = await IdCardManagement.findOneAndUpdate(
    { student: new mongoose.Types.ObjectId(studentId) },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  const student = await Student.findById(studentId).select('studentId fullName').lean();

  return {
    studentId: student?.studentId || studentId,
    fullName: student?.fullName || '',
    cardStatus: card.status,
    template: card.template,
    frontDesign: card.frontDesign,
    backDesign: card.backDesign,
    updatedById: userId,
  };
};

export default {
  getStudentsWithCards,
  generateQRCodes,
  regenerateQRCode,
  markAsPrinted,
  updateCardDesign,
};