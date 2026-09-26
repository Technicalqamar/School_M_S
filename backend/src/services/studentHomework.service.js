import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import Class from '../models/class.model.js';
import Subject from '../models/subject.model.js';
import Assignment from '../models/assignment.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';

const VALID_STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'];

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

const resolveClassDoc = async (student) => {
  if (!student.class) return null;

  const academicYear = student.academicYear || (await getCurrentAcademicYear());

  return Class.findOne({
    className: student.class,
    academicYear,
    status: 'Active',
    isDeleted: { $ne: true },
  })
    .select('_id className academicYear assignedSubjects')
    .lean();
};

const normalizeAssignment = (doc) => ({
  id: doc._id,
  classId: doc.classId?._id || doc.classId || null,
  className: doc.classId?.className || null,
  academicYear: doc.classId?.academicYear || null,
  subjectId: doc.subjectId?._id || null,
  subject: doc.subjectId?.subjectName || null,
  subjectCode: doc.subjectId?.subjectCode || null,
  teacherName: doc.teacherId?.fullName || null,
  teacherCode: doc.teacherId?.teacherId || null,
  title: doc.title,
  description: doc.description,
  dueDate: doc.dueDate,
  status: doc.status,
  assignedDate: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const resolveSubjectsList = async (classDoc) => {
  const subjectIds = (classDoc?.assignedSubjects || []).filter((id) =>
    mongoose.Types.ObjectId.isValid(id),
  );

  if (!subjectIds.length) return [];

  const subjects = await Subject.find({ _id: { $in: subjectIds } })
    .select('subjectName subjectCode')
    .lean();

  return subjects.map((s) => ({
    id: s._id,
    subjectName: s.subjectName,
    subjectCode: s.subjectCode || '',
  }));
};

const getMyAssignments = async (user, { search, subject, status, page = 1, limit = 20 } = {}) => {
  const student = await resolveStudent(user);
  assertActiveStudent(student);

  const classDoc = await resolveClassDoc(student);

  if (!classDoc) {
    return { assignments: [], total: 0, subjects: [], page: 1, limit };
  }

  const filter = { classId: classDoc._id };

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      throw new ApiError(400, `Status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    filter.status = status;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    const orClauses = [{ title: regex }, { description: regex }];

    const subjectIds = await Subject.find({ subjectName: regex }).distinct('_id');

    if (subjectIds.length > 0) {
      orClauses.push({ subjectId: { $in: subjectIds } });
    }

    filter.$or = orClauses;
  }

  if (subject && typeof subject === 'string' && subject.trim()) {
    const subjectDoc = await Subject.findOne({ subjectName: subject.trim() }).select('_id').lean();
    if (!subjectDoc) {
      return { assignments: [], total: 0, subjects: await resolveSubjectsList(classDoc), page: 1, limit };
    }
    filter.subjectId = subjectDoc._id;
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [total, assignments] = await Promise.all([
    Assignment.countDocuments(filter),
    Assignment.find(filter)
      .populate({ path: 'classId', select: 'className academicYear' })
      .populate({ path: 'subjectId', select: 'subjectName subjectCode' })
      .populate({ path: 'teacherId', select: 'fullName teacherId' })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  return {
    assignments: assignments.map(normalizeAssignment),
    total,
    subjects: await resolveSubjectsList(classDoc),
    page: pageNum,
    limit: limitNum,
  };
};

const getMyAssignment = async (user, id) => {
  const student = await resolveStudent(user);
  assertActiveStudent(student);

  const classDoc = await resolveClassDoc(student);

  assertValidObjectId(id, 'Assignment ID');

  const assignment = await Assignment.findById(id)
    .populate({ path: 'classId', select: 'className academicYear' })
    .populate({ path: 'subjectId', select: 'subjectName subjectCode' })
    .populate({ path: 'teacherId', select: 'fullName teacherId' })
    .lean();

  if (!assignment) {
    throw new ApiError(404, 'Assignment not found');
  }

  if (!classDoc || String(assignment.classId?._id) !== String(classDoc._id)) {
    throw new ApiError(403, 'You can only view assignments for your own class');
  }

  return normalizeAssignment(assignment);
};

export default {
  getMyAssignments,
  getMyAssignment,
};