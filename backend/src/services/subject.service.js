import Subject from '../models/subject.model.js';
import Class from '../models/class.model.js';
import Teacher from '../models/teacher.model.js';
import Timetable from '../models/timetable.model.js';
import { ApiError } from '../utils/apiError.js';

const createSubject = async (data) => {
  const { subjectName, status, description } = data;

  const existing = await Subject.findOne({ subjectName });

  if (existing) {
    throw new ApiError(409, 'Subject with this name already exists');
  }

  try {
    const subject = await Subject.create({ subjectName, status: status || 'Active', description: description || '' });

    return subject;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Subject with this name already exists');
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const getAllSubjects = async () => {
  const subjects = await Subject.find().sort({ createdAt: -1 }).lean();

  return subjects;
};

const getSubjectById = async (id) => {
  const subject = await Subject.findById(id);

  if (!subject) {
    throw new ApiError(404, 'Subject not found');
  }

  return subject;
};

const updateSubject = async (id, data) => {
  const existing = await Subject.findById(id);

  if (!existing) {
    throw new ApiError(404, 'Subject not found');
  }

  if (data.subjectName) {
    const duplicate = await Subject.findOne({
      _id: { $ne: id },
      subjectName: data.subjectName,
    });

    if (duplicate) {
      throw new ApiError(409, 'Subject with this name already exists');
    }
  }

  try {
    const updated = await Subject.findByIdAndUpdate(id, data, { new: true, runValidators: true });

    return updated;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Subject with this name already exists');
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }

    throw error;
  }
};

const deleteSubject = async (id) => {
  const existing = await Subject.findById(id);

  if (!existing) {
    throw new ApiError(404, 'Subject not found');
  }

  const subjectId = existing._id;

  await Subject.findByIdAndDelete(id);

  const [classesWithSubject, teachersWithSubject] = await Promise.all([
    Class.find({ assignedSubjects: subjectId, isDeleted: { $ne: true } }),
    Teacher.find({ assignedSubjects: subjectId }),
  ]);

  for (const cls of classesWithSubject) {
    cls.assignedSubjects.pull(subjectId);
    await cls.save();
  }

  for (const teacher of teachersWithSubject) {
    teacher.assignedSubjects.pull(subjectId);
    await teacher.save();
  }

  await Promise.all([
    updateAssignmentCounts(),
    Timetable.updateMany(
      { 'periods.subjectId': subjectId },
      { $set: { 'periods.$[elem].subjectId': null } },
      { arrayFilters: [{ 'elem.subjectId': subjectId }] },
    ),
  ]);
};

const assignSubjectsToClass = async (className, academicYear, subjectIds) => {
  const classDoc = await Class.findOne({ className, academicYear, isDeleted: { $ne: true } });

  if (!classDoc) {
    throw new ApiError(404, 'Class not found');
  }

  if (!Array.isArray(subjectIds)) {
    throw new ApiError(400, 'subjectIds must be an array');
  }

  const validSubjects = await Subject.find({ _id: { $in: subjectIds } });

  if (validSubjects.length !== subjectIds.length) {
    throw new ApiError(400, 'One or more subjects not found');
  }

  const currentIds = (classDoc.assignedSubjects || []).map((id) => id.toString());
  const desiredIds = subjectIds.map((id) => id.toString());

  const toAdd = desiredIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !desiredIds.includes(id));

  if (toAdd.length === 0 && toRemove.length === 0) {
    throw new ApiError(409, 'No changes detected');
  }

  classDoc.assignedSubjects = desiredIds;
  await classDoc.save();

  await updateAssignmentCounts();

  return { classDoc, added: toAdd.length, removed: toRemove.length };
};

const getClassAssignments = async (className, academicYear) => {
  const classDoc = await Class.findOne({ className, academicYear, isDeleted: { $ne: true } }).populate('assignedSubjects');

  if (!classDoc) {
    throw new ApiError(404, 'Class not found');
  }

  const allSubjects = await Subject.find().lean();

  return {
    class: classDoc,
    assignedSubjects: classDoc.assignedSubjects || [],
    allSubjects,
  };
};

const getClassAssignmentAcademicYears = async () => {
  const years = await Class.distinct('academicYear', { isDeleted: { $ne: true } });

  return years.sort();
};

const updateAssignmentCounts = async () => {
  const allSubjects = await Subject.find();

  for (const subject of allSubjects) {
    const classesCount = await Class.countDocuments({ assignedSubjects: subject._id, isDeleted: { $ne: true } });
    const teachersCount = await Teacher.countDocuments({ assignedSubjects: subject._id });

    if (subject.assignedClassesCount !== classesCount || subject.assignedTeachersCount !== teachersCount) {
      await Subject.findByIdAndUpdate(subject._id, {
        assignedClassesCount: classesCount,
        assignedTeachersCount: teachersCount,
      });
    }
  }
};

export default {
  createSubject,
  getAllSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  assignSubjectsToClass,
  getClassAssignments,
  getClassAssignmentAcademicYears,
};
