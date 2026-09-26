import FeeStructure from '../models/feeStructure.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';

const CLASS_ORDER = [
  'Montessori', 'Nursery', 'KG1', 'KG2',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
];

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }

  return String(new Date().getFullYear());
};

const createFeeStructure = async (data) => {
  const { className, academicYear, monthlyFee, admissionFee, examFee, status } = data;
  const year = academicYear || (await getCurrentAcademicYear());

  const existing = await FeeStructure.findOne({ className, academicYear: year, isDeleted: { $ne: true } });

  if (existing) {
    throw new ApiError(409, 'Fee structure already exists for this class in the selected academic year');
  }

  const deleted = await FeeStructure.findOne({ className, academicYear: year, isDeleted: true });

  try {
    if (deleted) {
      deleted.isDeleted = false;
      deleted.className = className;
      deleted.academicYear = year;
      deleted.monthlyFee = monthlyFee;
      deleted.admissionFee = admissionFee;
      deleted.examFee = examFee;
      deleted.status = status;
      await deleted.save();

      return deleted;
    }

    const newStructure = await FeeStructure.create({
      className,
      academicYear: year,
      monthlyFee,
      admissionFee,
      examFee,
      status,
    });

    return newStructure;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Fee structure already exists for this class in the selected academic year');
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const getAllFeeStructures = async () => {
  const structures = await FeeStructure.find({ isDeleted: { $ne: true } }).lean();

  structures.sort(
    (a, b) => CLASS_ORDER.indexOf(a.className) - CLASS_ORDER.indexOf(b.className),
  );

  return {
    structures,
    statistics: {
      totalStructures: structures.length,
      activeStructures: structures.filter((s) => s.status === 'Active').length,
      inactiveStructures: structures.filter((s) => s.status === 'Inactive').length,
    },
  };
};

const updateFeeStructure = async (id, data) => {
  const existing = await FeeStructure.findOne({ _id: id, isDeleted: { $ne: true } });

  if (!existing) {
    throw new ApiError(404, 'Fee structure not found');
  }

  const className = data.className ?? existing.className;
  const academicYear = data.academicYear ?? existing.academicYear;

  if (className !== existing.className || academicYear !== existing.academicYear) {
    const duplicate = await FeeStructure.findOne({
      _id: { $ne: id },
      className,
      academicYear,
      isDeleted: { $ne: true },
    });

    if (duplicate) {
      throw new ApiError(409, 'Fee structure already exists for this class in the selected academic year');
    }
  }

  try {
    const updated = await FeeStructure.findByIdAndUpdate(
      id,
      {
        className,
        academicYear,
        monthlyFee: data.monthlyFee ?? existing.monthlyFee,
        admissionFee: data.admissionFee ?? existing.admissionFee,
        examFee: data.examFee ?? existing.examFee,
        status: data.status ?? existing.status,
      },
      { new: true, runValidators: true },
    );

    return updated;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Fee structure already exists for this class in the selected academic year');
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const deleteFeeStructure = async (id) => {
  const existing = await FeeStructure.findOne({ _id: id, isDeleted: { $ne: true } });

  if (!existing) {
    throw new ApiError(404, 'Fee structure not found');
  }

  await FeeStructure.findByIdAndUpdate(id, { isDeleted: true });
};

export default { createFeeStructure, getAllFeeStructures, updateFeeStructure, deleteFeeStructure };