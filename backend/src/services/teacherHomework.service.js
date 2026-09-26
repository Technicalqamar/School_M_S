import mongoose from 'mongoose';
import Teacher from '../models/teacher.model.js';
import Admin from '../models/admin.model.js';
import Class from '../models/class.model.js';
import Assignment from '../models/assignment.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import { getTeacherClassScope } from './teacherScope.service.js';

const VALID_STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'];
const MONTH_STRING_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }

  return String(new Date().getFullYear());
};

const resolveTeacherProfile = async (user) => {
  if (user.referenceId && user.referenceModel === 'Teacher') {
    const teacher = await Teacher.findById(user.referenceId);
    if (!teacher) {
      throw new ApiError(404, 'Linked teacher profile not found');
    }
    return teacher;
  }

  if (user.role === 'teacher') {
    const teacher = await Admin.findById(user._id).select('assignedSubjects teacherId fullName status');
    if (!teacher) {
      throw new ApiError(404, 'Teacher profile not found');
    }
    return teacher;
  }

  throw new ApiError(403, 'Only teachers can access this resource');
};

const assertActiveTeacher = (teacher) => {
  if (teacher.status !== 'Active') {
    throw new ApiError(403, 'Your teacher profile is inactive. Contact the administration.');
  }
};

const assertValidObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `${label} must be a valid ID`);
  }
};

const validatePayloadFields = ({ title, description, dueDate, status }) => {
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      throw new ApiError(400, 'Assignment title is required');
    }
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      throw new ApiError(400, 'Description must be a string');
    }
  }

  if (dueDate !== undefined) {
    if (typeof dueDate !== 'string' || !MONTH_STRING_REGEX.test(dueDate)) {
      throw new ApiError(400, 'Due date must be a valid date (YYYY-MM-DD)');
    }
    const parsed = new Date(`${dueDate}T23:59:59.999Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(400, 'Due date must be a valid date');
    }
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      throw new ApiError(400, `Status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
  }
};

/**
 * Verifies the assignment target (class + subject) belongs to this teacher's
 * current-year assignments. Throws 403/404/400 on any violation.
 */
const assertAssignmentTarget = async (teacher, { classId, subjectId }) => {
  assertValidObjectId(classId, 'Class ID');
  assertValidObjectId(subjectId, 'Subject ID');

  const academicYear = await getCurrentAcademicYear();

  const cls = await Class.findById(classId).select('className academicYear status isDeleted assignedSubjects').lean();

  if (!cls) {
    throw new ApiError(404, 'Class not found');
  }

  if (cls.academicYear !== academicYear) {
    throw new ApiError(403, 'You can only create assignments for your current-year assigned classes.');
  }

  if (cls.status !== 'Active' || cls.isDeleted) {
    throw new ApiError(403, 'This class is not active for assignments.');
  }

  const { teacherSubjectSet } = await getTeacherClassScope(teacher, cls);

  if (!teacherSubjectSet.has(String(subjectId))) {
    throw new ApiError(403, 'You are not assigned to this subject, so you cannot create assignments for it.');
  }

  const classSubjectIds = (cls.assignedSubjects || []).map((id) => String(id._id || id));

  if (!classSubjectIds.includes(String(subjectId))) {
    throw new ApiError(400, 'This subject is not assigned to the selected class.');
  }

  return { cls, academicYear };
};

const enrichAssignment = async (assignment) => {
  const doc = await Assignment.findById(assignment._id)
    .populate({ path: 'classId', select: 'className academicYear' })
    .populate({ path: 'subjectId', select: 'subjectName subjectCode' })
    .populate({ path: 'teacherId', select: 'teacherId fullName' })
    .lean();

  return {
    id: doc._id,
    teacherId: doc.teacherId?._id,
    teacher: doc.teacherId
      ? { teacherId: doc.teacherId.teacherId, fullName: doc.teacherId.fullName }
      : null,
    classId: doc.classId?._id,
    className: doc.classId?.className || null,
    academicYear: doc.classId?.academicYear || null,
    subjectId: doc.subjectId?._id,
    subjectName: doc.subjectId?.subjectName || null,
    subjectCode: doc.subjectId?.subjectCode || null,
    title: doc.title,
    description: doc.description,
    dueDate: doc.dueDate,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const createAssignment = async (user, payload) => {
  const teacher = await resolveTeacherProfile(user);
  assertActiveTeacher(teacher);

  const { classId, subjectId } = payload;

  await assertAssignmentTarget(teacher, { classId, subjectId });

  validatePayloadFields(payload);

  const sanitized = {
    teacherId: teacher._id,
    classId,
    subjectId,
    title: typeof payload.title === 'string' ? payload.title.trim() : payload.title,
    description: payload.description !== undefined ? payload.description : '',
    dueDate: payload.dueDate !== undefined ? new Date(`${payload.dueDate}T23:59:59.999Z`) : undefined,
    status: payload.status !== undefined ? payload.status : 'Pending',
  };

  const assignment = await Assignment.create(sanitized);

  return enrichAssignment(assignment);
};

const getTeacherAssignments = async (user, { search, status, subjectId, classId, page = 1, limit = 20 } = {}) => {
  const teacher = await resolveTeacherProfile(user);
  assertActiveTeacher(teacher);

  const filter = { teacherId: teacher._id };

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      throw new ApiError(400, `Status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    filter.status = status;
  }

  if (subjectId) {
    assertValidObjectId(subjectId, 'Subject ID');
    filter.subjectId = subjectId;
  }

  if (classId) {
    assertValidObjectId(classId, 'Class ID');
    filter.classId = classId;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ title: regex }, { description: regex }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [total, assignments] = await Promise.all([
    Assignment.countDocuments(filter),
    Assignment.find(filter)
      .populate({ path: 'classId', select: 'className academicYear' })
      .populate({ path: 'subjectId', select: 'subjectName subjectCode' })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  const list = assignments.map((doc) => ({
    id: doc._id,
    classId: doc.classId?._id,
    className: doc.classId?.className || null,
    academicYear: doc.classId?.academicYear || null,
    subjectId: doc.subjectId?._id,
    subjectName: doc.subjectId?.subjectName || null,
    subjectCode: doc.subjectId?.subjectCode || null,
    title: doc.title,
    description: doc.description,
    dueDate: doc.dueDate,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));

  return { assignments: list, total, page: pageNum, limit: limitNum };
};

const getAssignment = async (user, id) => {
  const teacher = await resolveTeacherProfile(user);
  assertActiveTeacher(teacher);

  assertValidObjectId(id, 'Assignment ID');

  const assignment = await Assignment.findOne({ _id: id, teacherId: teacher._id });

  if (!assignment) {
    throw new ApiError(404, 'Assignment not found');
  }

  return enrichAssignment(assignment);
};

const updateAssignment = async (user, id, payload) => {
  const teacher = await resolveTeacherProfile(user);
  assertActiveTeacher(teacher);

  assertValidObjectId(id, 'Assignment ID');

  const existing = await Assignment.findOne({ _id: id, teacherId: teacher._id });

  if (!existing) {
    throw new ApiError(404, 'Assignment not found');
  }

  if (payload.classId !== undefined || payload.subjectId !== undefined) {
    await assertAssignmentTarget(teacher, {
      classId: payload.classId ?? existing.classId.toString(),
      subjectId: payload.subjectId ?? existing.subjectId.toString(),
    });
  }

  validatePayloadFields(payload);

  if (payload.title !== undefined) existing.title = typeof payload.title === 'string' ? payload.title.trim() : payload.title;
  if (payload.description !== undefined) existing.description = payload.description;
  if (payload.dueDate !== undefined) existing.dueDate = new Date(`${payload.dueDate}T23:59:59.999Z`);
  if (payload.status !== undefined) existing.status = payload.status;
  if (payload.classId !== undefined) existing.classId = payload.classId;
  if (payload.subjectId !== undefined) existing.subjectId = payload.subjectId;

  await existing.save();

  return enrichAssignment(existing);
};

const deleteAssignment = async (user, id) => {
  const teacher = await resolveTeacherProfile(user);
  assertActiveTeacher(teacher);

  assertValidObjectId(id, 'Assignment ID');

  const existing = await Assignment.findOneAndDelete({ _id: id, teacherId: teacher._id });

  if (!existing) {
    throw new ApiError(404, 'Assignment not found');
  }

  return { id: existing._id };
};

export default {
  createAssignment,
  getTeacherAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
};