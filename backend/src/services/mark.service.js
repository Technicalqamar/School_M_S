import mongoose from 'mongoose';
import Mark from '../models/mark.model.js';
import Exam from '../models/exam.model.js';
import Subject from '../models/subject.model.js';
import Student from '../models/student.model.js';
import ExamSubject from '../models/examSubject.model.js';
import { ApiError } from '../utils/apiError.js';

const validateId = (id, label = 'Mark') => {
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

const validateStudent = async (studentId, className, academicYear) => {
  const student = await Student.findById(studentId);
  if (!student) throw new ApiError(404, 'Student not found');

  const inactiveEnrollment =
    Array.isArray(student.enrollments) &&
    student.enrollments.length > 0 &&
    !student.enrollments.some((e) => e.academicYear === academicYear && e.class === className && e.status === 'Active');

  if (inactiveEnrollment) {
    throw new ApiError(400, 'Student is not enrolled in the selected class for this academic year');
  }

  if (student.class && String(student.class) !== String(className)) {
    throw new ApiError(400, 'Student class does not match the selected class');
  }

  return student;
};

const validateSubject = async (subjectId, examId, className, academicYear) => {
  const subject = await Subject.findById(subjectId);
  if (!subject) throw new ApiError(404, 'Subject not found');

  const config = await ExamSubject.findOne({ examId, subjectId, className, academicYear, status: 'Active' });
  if (!config) {
    throw new ApiError(400, 'Subject is not configured with marks for the selected exam and class');
  }

  return { subject, config };
};

const createMark = async (data) => {
  await validateExamContext(data.examId, data.academicYear, data.className);
  await validateStudent(data.studentId, data.className, data.academicYear);
  const { config } = await validateSubject(data.subjectId, data.examId, data.className, data.academicYear);

  const totalMarks = data.totalMarks ?? config.totalMarks;
  if (data.obtainedMarks > totalMarks) {
    throw new ApiError(400, 'Obtained marks cannot exceed total marks');
  }

  const existing = await Mark.findOne({
    examId: data.examId,
    studentId: data.studentId,
    subjectId: data.subjectId,
  });
  if (existing) {
    throw new ApiError(409, 'Marks already exist for this student and subject in the exam');
  }

  try {
    const mark = await Mark.create({ ...data, totalMarks });
    return mark;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Marks already exist for this student and subject in the exam');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getAllMarks = async (query) => {
  const { page: rawPage, limit: rawLimit, examId, studentId, subjectId, className, academicYear } = query;

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
  if (studentId) {
    if (!mongoose.Types.ObjectId.isValid(String(studentId))) throw new ApiError(400, 'Invalid student id');
    filter.studentId = studentId;
  }
  if (className) filter.className = className;
  if (academicYear) filter.academicYear = academicYear;

  const [marks, total] = await Promise.all([
    Mark.find(filter)
      .populate('studentId', 'studentId fullName fatherName admissionNumber class academicYear')
      .populate('subjectId', 'subjectName subjectCode')
      .populate('examId', 'name type academicYear')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Mark.countDocuments(filter),
  ]);

  return {
    marks,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
  };
};

const getMarkById = async (id) => {
  validateId(id);
  const mark = await Mark.findById(id)
    .populate('studentId', 'studentId fullName fatherName admissionNumber class academicYear')
    .populate('subjectId', 'subjectName subjectCode')
    .populate('examId', 'name type academicYear');
  if (!mark) throw new ApiError(404, 'Mark record not found');
  return mark;
};

const updateMark = async (id, data) => {
  validateId(id);
  const existing = await Mark.findById(id);
  if (!existing) throw new ApiError(404, 'Mark record not found');

  const examId = data.examId || existing.examId;
  const studentId = data.studentId || existing.studentId;
  const subjectId = data.subjectId || existing.subjectId;
  const academicYear = data.academicYear || existing.academicYear;
  const className = data.className || existing.className;

  const changedContext =
    (data.examId && String(data.examId) !== String(existing.examId)) ||
    (data.studentId && String(data.studentId) !== String(existing.studentId)) ||
    (data.subjectId && String(data.subjectId) !== String(existing.subjectId)) ||
    (data.academicYear && data.academicYear !== existing.academicYear) ||
    (data.className && data.className !== existing.className);

  if (changedContext) {
    await validateExamContext(examId, academicYear, className);
    await validateStudent(studentId, className, academicYear);
    await validateSubject(subjectId, examId, className, academicYear);
    const dup = await Mark.findOne({ examId, studentId, subjectId, _id: { $ne: existing._id } });
    if (dup) throw new ApiError(409, 'Marks already exist for this student and subject in the exam');
  }

  const totalMarks =
    data.totalMarks !== undefined
      ? data.totalMarks ?? null
      : existing.totalMarks;

  const obtained =
    data.obtainedMarks !== undefined ? data.obtainedMarks : existing.obtainedMarks;
  if (totalMarks && obtained > totalMarks) {
    throw new ApiError(400, 'Obtained marks cannot exceed total marks');
  }

  try {
    const updated = await Mark.findByIdAndUpdate(id, { $set: { ...data, totalMarks, academicYear, className } }, { new: true, runValidators: true })
      .populate('studentId', 'studentId fullName fatherName admissionNumber class academicYear')
      .populate('subjectId', 'subjectName subjectCode')
      .populate('examId', 'name type academicYear');
    return updated;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Marks already exist for this student and subject in the exam');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const bulkSaveMarks = async (data) => {
  const { examId, subjectId, academicYear, className, entries } = data;

  await validateExamContext(examId, academicYear, className);
  const { config } = await validateSubject(subjectId, examId, className, academicYear);

  const studentIds = entries.map((e) => e.studentId);
  const students = await Student.find({ _id: { $in: studentIds } });
  const studentMap = new Map(students.map((s) => [String(s._id), s]));

  for (const entry of entries) {
    const student = studentMap.get(entry.studentId);
    if (!student) throw new ApiError(404, 'Student not found');

    const inactiveEnrollment =
      Array.isArray(student.enrollments) &&
      student.enrollments.length > 0 &&
      !student.enrollments.some((e) => e.academicYear === academicYear && e.class === className && e.status === 'Active');

    if (inactiveEnrollment) {
      throw new ApiError(400, `Student ${student.studentId} is not enrolled in the selected class for this academic year`);
    }

    if (student.class && String(student.class) !== String(className)) {
      throw new ApiError(400, `Student ${student.studentId} class does not match the selected class`);
    }

    const totalMarks = entry.totalMarks ?? config.totalMarks;
    if (entry.obtainedMarks > totalMarks) {
      throw new ApiError(400, `Obtained marks cannot exceed total marks for student ${student.studentId}`);
    }
  }

  const ops = entries.map((entry) => ({
    updateOne: {
      filter: { examId, studentId: entry.studentId, subjectId },
      update: {
        $set: {
          examId,
          studentId: entry.studentId,
          subjectId,
          academicYear,
          className,
          obtainedMarks: entry.obtainedMarks,
          totalMarks: entry.totalMarks ?? config.totalMarks,
          remarks: entry.remarks || '',
          status: 'Entered',
        },
      },
      upsert: true,
    },
  }));

  let result;
  try {
    result = await Mark.bulkWrite(ops, { ordered: false });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Duplicate marks entry detected');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }

  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    created: result.upsertedCount,
  };
};

const deleteMark = async (id) => {
  validateId(id);
  const existing = await Mark.findById(id);
  if (!existing) throw new ApiError(404, 'Mark record not found');
  await Mark.findByIdAndDelete(id);
  return existing;
};

export default {
  createMark,
  getAllMarks,
  getMarkById,
  updateMark,
  bulkSaveMarks,
  deleteMark,
};