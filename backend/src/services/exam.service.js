import mongoose from 'mongoose';
import Exam from '../models/exam.model.js';
import { ApiError } from '../utils/apiError.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const validateId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid exam id');
  }
};

const createExam = async (data) => {
  const name = String(data.name || '').trim();
  const academicYear = String(data.academicYear || '').trim();

  const pattern = new RegExp(`^${escapeRegex(name)}$`, 'i');
  const existing = await Exam.findOne({ name: pattern, academicYear });
  if (existing) {
    throw new ApiError(409, 'An exam with this name already exists for the selected academic year');
  }

  try {
    const exam = await Exam.create(data);
    return exam;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'An exam with this name already exists for the selected academic year');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getAllExams = async (query) => {
  const { page: rawPage, limit: rawLimit, search, academicYear, type, status } = query;

  const page = Math.max(1, parseInt(rawPage, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(rawLimit, 10) || 10));
  const skip = (page - 1) * limit;

  const filter = {};

  if (academicYear) filter.academicYear = String(academicYear).trim();
  if (type) filter.type = String(type).trim();
  if (status) filter.status = String(status).trim();

  if (search && String(search).trim()) {
    const term = String(search).trim();
    filter.name = new RegExp(escapeRegex(term), 'i');
  }

  const [exams, totalExams] = await Promise.all([
    Exam.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Exam.countDocuments(filter),
  ]);

  return {
    exams,
    totalExams,
    totalPages: Math.ceil(totalExams / limit),
    currentPage: page,
  };
};

const getExamById = async (id) => {
  validateId(id);
  const exam = await Exam.findById(id);
  if (!exam) throw new ApiError(404, 'Exam not found');
  return exam;
};

const updateExam = async (id, data) => {
  validateId(id);
  const existing = await Exam.findById(id);
  if (!existing) throw new ApiError(404, 'Exam not found');

  if (data.name || data.academicYear) {
    const name = data.name || existing.name;
    const academicYear = data.academicYear || existing.academicYear;
    const dup = await Exam.findOne({
      _id: { $ne: new mongoose.Types.ObjectId(id) },
      name: new RegExp(`^${escapeRegex(String(name))}$`, 'i'),
      academicYear: String(academicYear),
    });
    if (dup) {
      throw new ApiError(409, 'An exam with this name already exists for the selected academic year');
    }
  }

  const checkStart = data.startDate || existing.startDate;
  const checkEnd = data.endDate || existing.endDate;
  const s = toDateOnly(checkStart);
  const e = toDateOnly(checkEnd);
  if (s && e && e.getTime() < s.getTime()) {
    throw new ApiError(400, 'End date must be after start date');
  }

  try {
    const updated = await Exam.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true },
    );
    return updated;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'An exam with this name already exists for the selected academic year');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const deleteExam = async (id) => {
  validateId(id);
  const existing = await Exam.findById(id);
  if (!existing) throw new ApiError(404, 'Exam not found');
  await Exam.findByIdAndDelete(id);
  return existing;
};

export default {
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
};