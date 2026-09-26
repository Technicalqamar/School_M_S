import mongoose from 'mongoose';
import ExamSubject from '../models/examSubject.model.js';
import Exam from '../models/exam.model.js';
import Subject from '../models/subject.model.js';
import Class from '../models/class.model.js';
import { ApiError } from '../utils/apiError.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validateId = (id, label = 'Exam subject') => {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    throw new ApiError(400, `Invalid ${label.toLowerCase()} id`);
  }
};

const validateExamContext = async (examId, academicYear, className) => {
  const exam = await Exam.findById(examId);
  if (!exam) throw new ApiError(404, 'Exam not found');

  if (String(exam.academicYear) !== String(academicYear)) {
    throw new ApiError(400, 'Academic year does not match the selected exam');
  }

  const examClasses = exam.classes || [];
  if (!examClasses.includes(className)) {
    throw new ApiError(400, `Class "${className}" is not configured for this exam`);
  }

  return exam;
};

const validateSubject = async (subjectId, className, academicYear) => {
  const subject = await Subject.findById(subjectId);
  if (!subject) throw new ApiError(404, 'Subject not found');

  const classDoc = await Class.findOne({ className, academicYear, isDeleted: { $ne: true } });
  if (classDoc && Array.isArray(classDoc.assignedSubjects) && classDoc.assignedSubjects.length > 0) {
    const sId = String(subjectId);
    if (!classDoc.assignedSubjects.some((id) => String(id) === sId)) {
      throw new ApiError(400, 'Subject is not assigned to the selected class');
    }
  }

  return subject;
};

const createExamSubject = async (data) => {
  const exam = await validateExamContext(data.examId, data.academicYear, data.className);
  await validateSubject(data.subjectId, data.className, data.academicYear);

  const existing = await ExamSubject.findOne({
    examId: data.examId,
    subjectId: data.subjectId,
    className: data.className,
    academicYear: data.academicYear,
  });
  if (existing) {
    throw new ApiError(409, 'This subject is already configured for the selected exam and class');
  }

  try {
    const config = await ExamSubject.create(data);
    return config;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'This subject is already configured for the selected exam and class');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getAllExamSubjects = async (query) => {
  const { page: rawPage, limit: rawLimit, search, examId, subjectId, className, academicYear, status } = query;

  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};
  if (examId) {
    if (!mongoose.Types.ObjectId.isValid(String(examId))) throw new ApiError(400, 'Invalid exam id');
    filter.examId = examId;
  }
  if (subjectId) {
    if (!mongoose.Types.ObjectId.isValid(String(subjectId))) throw new ApiError(400, 'Invalid subject id');
    filter.subjectId = subjectId;
  }
  if (className) filter.className = className;
  if (academicYear) filter.academicYear = academicYear;
  if (status) filter.status = status;

  const isSearch = search && String(search).trim();
  const subjectPattern = isSearch ? new RegExp(escapeRegex(String(search).trim()), 'i') : null;

  if (isSearch) {
    const matchedSubjects = await Subject.find({ subjectName: subjectPattern }).select('_id');
    const ids = matchedSubjects.map((s) => s._id);
    filter.$or = [{ subjectId: { $in: ids } }];
    if (mongoose.Types.ObjectId.isValid(String(search).trim())) {
      filter.$or.push({ _id: String(search).trim() });
    }
  }

  const [items, total] = await Promise.all([
    ExamSubject.find(filter)
      .populate('examId', 'name type academicYear')
      .populate('subjectId', 'subjectName subjectCode')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ExamSubject.countDocuments(filter),
  ]);

  return {
    examSubjects: items,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};

const getExamSubjectById = async (id) => {
  validateId(id);
  const item = await ExamSubject.findById(id)
    .populate('examId', 'name type academicYear')
    .populate('subjectId', 'subjectName subjectCode');
  if (!item) throw new ApiError(404, 'Exam subject configuration not found');
  return item;
};

const updateExamSubject = async (id, data) => {
  validateId(id);
  const existing = await ExamSubject.findById(id);
  if (!existing) throw new ApiError(404, 'Exam subject configuration not found');

  const examId = data.examId || existing.examId;
  const subjectId = data.subjectId || existing.subjectId;
  const academicYear = data.academicYear || existing.academicYear;
  const className = data.className || existing.className;

  const changedContext =
    (data.examId && String(data.examId) !== String(existing.examId)) ||
    (data.subjectId && String(data.subjectId) !== String(existing.subjectId)) ||
    (data.academicYear && String(data.academicYear) !== String(existing.academicYear)) ||
    (data.className && data.className !== existing.className);

  if (changedContext) {
    await validateExamContext(examId, academicYear, className);
    await validateSubject(subjectId, className, academicYear);
    const dup = await ExamSubject.findOne({
      examId,
      subjectId,
      className,
      academicYear,
      _id: { $ne: existing._id },
    });
    if (dup) {
      throw new ApiError(409, 'This subject is already configured for the selected exam and class');
    }
  }

  if (data.totalMarks !== undefined && data.passingMarks === undefined) {
    if (data.totalMarks < existing.passingMarks) {
      throw new ApiError(400, 'Passing marks cannot exceed total marks');
    }
  }
  if (data.passingMarks !== undefined && data.totalMarks === undefined) {
    if (data.passingMarks > existing.totalMarks) {
      throw new ApiError(400, 'Passing marks cannot exceed total marks');
    }
  }

  try {
    const updated = await ExamSubject.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
      .populate('examId', 'name type academicYear')
      .populate('subjectId', 'subjectName subjectCode');
    return updated;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'This subject is already configured for the selected exam and class');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const deleteExamSubject = async (id) => {
  validateId(id);
  const existing = await ExamSubject.findById(id);
  if (!existing) throw new ApiError(404, 'Exam subject configuration not found');
  await ExamSubject.findByIdAndDelete(id);
  return existing;
};

export default {
  createExamSubject,
  getAllExamSubjects,
  getExamSubjectById,
  updateExamSubject,
  deleteExamSubject,
};