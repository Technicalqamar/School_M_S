import mongoose from 'mongoose';
import ExamSchedule from '../models/examSchedule.model.js';
import Exam from '../models/exam.model.js';
import Subject from '../models/subject.model.js';
import Class from '../models/class.model.js';
import { ApiError } from '../utils/apiError.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validateId = (id, label = 'Exam schedule') => {
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

const createExamSchedule = async (data) => {
  const exam = await validateExamContext(data.examId, data.academicYear, data.className);
  await validateSubject(data.subjectId, data.className, data.academicYear);

  const existing = await ExamSchedule.findOne({
    examId: data.examId,
    className: data.className,
    subjectId: data.subjectId,
    academicYear: data.academicYear,
  });
  if (existing) {
    throw new ApiError(409, 'A schedule already exists for this exam, class, and subject');
  }

  try {
    const schedule = await ExamSchedule.create(data);
    return schedule;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'A schedule already exists for this exam, class, and subject');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getAllExamSchedules = async (query) => {
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
  if (isSearch) {
    const pattern = new RegExp(escapeRegex(String(search).trim()), 'i');
    const matchedSubjects = await Subject.find({ subjectName: pattern }).select('_id');
    const ids = matchedSubjects.map((s) => s._id);
    filter.$or = [{ subjectId: { $in: ids } }, { room: pattern }];
    if (mongoose.Types.ObjectId.isValid(String(search).trim())) {
      filter.$or.push({ _id: String(search).trim() });
    }
  }

  const [items, total] = await Promise.all([
    ExamSchedule.find(filter)
      .populate('examId', 'name type academicYear')
      .populate('subjectId', 'subjectName subjectCode')
      .skip(skip)
      .limit(limit)
      .sort({ examDate: 1, startTime: 1 }),
    ExamSchedule.countDocuments(filter),
  ]);

  return {
    schedules: items,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};

const getExamScheduleById = async (id) => {
  validateId(id);
  const item = await ExamSchedule.findById(id)
    .populate('examId', 'name type academicYear')
    .populate('subjectId', 'subjectName subjectCode');
  if (!item) throw new ApiError(404, 'Exam schedule not found');
  return item;
};

const updateExamSchedule = async (id, data) => {
  validateId(id);
  const existing = await ExamSchedule.findById(id);
  if (!existing) throw new ApiError(404, 'Exam schedule not found');

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
    const dup = await ExamSchedule.findOne({
      examId,
      className,
      subjectId,
      academicYear,
      _id: { $ne: existing._id },
    });
    if (dup) {
      throw new ApiError(409, 'A schedule already exists for this exam, class, and subject');
    }
  }

  if (data.startTime !== undefined && data.endTime === undefined) {
    if (data.startTime >= existing.endTime) {
      throw new ApiError(400, 'End time must be after start time');
    }
  }
  if (data.endTime !== undefined && data.startTime === undefined) {
    if (data.endTime <= existing.startTime) {
      throw new ApiError(400, 'End time must be after start time');
    }
  }

  try {
    const updated = await ExamSchedule.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
      .populate('examId', 'name type academicYear')
      .populate('subjectId', 'subjectName subjectCode');
    return updated;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'A schedule already exists for this exam, class, and subject');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const deleteExamSchedule = async (id) => {
  validateId(id);
  const existing = await ExamSchedule.findById(id);
  if (!existing) throw new ApiError(404, 'Exam schedule not found');
  await ExamSchedule.findByIdAndDelete(id);
  return existing;
};

export default {
  createExamSchedule,
  getAllExamSchedules,
  getExamScheduleById,
  updateExamSchedule,
  deleteExamSchedule,
};