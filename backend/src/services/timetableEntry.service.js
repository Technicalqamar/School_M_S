import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';
import Class from '../models/class.model.js';
import TimeSlot from '../models/timeSlot.model.js';
import Subject from '../models/subject.model.js';
import ClassTeacherAssignment from '../models/classTeacherAssignment.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import TimetableEntry from '../models/timetableEntry.model.js';

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;
const VALID_GROUPS = [1, 2, 3];

// Groups are derived from the existing Class data (the fixed class name enum).
// Group 1: Montessori, Nursery, KG 1, KG 2
// Group 2: Class 1 - Class 5
// Group 3: Class 6 - Class 10
const GROUP_MAP = [
  { group: 1, names: ['Montessori', 'Nursery', 'KG 1', 'KG 2'] },
  { group: 2, names: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'] },
  { group: 3, names: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'] },
];

const normalizeName = (value) => String(value || '').toLowerCase().replace(/\s+/g, '');

const deriveGroup = (className) => {
  const key = normalizeName(className);

  for (const entry of GROUP_MAP) {
    if (entry.names.some((name) => normalizeName(name) === key)) {
      return entry.group;
    }
  }

  // Safety fallback for names outside the fixed enum: infer from the numeric
  // suffix (e.g. "Class 11" -> 2 for 1-5 else 3) so unknown classes never crash.
  const numeric = String(className || '').match(/(\d+)/);
  if (numeric) {
    const n = parseInt(numeric[1], 10);
    if (n >= 1 && n <= 5) return 2;
    if (n >= 6 && n <= 10) return 3;
  }

  throw new ApiError(400, `Unable to determine timetable group for class "${className}"`);
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value));

// Central/default academic year straight from school settings (never hard-coded).
const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear).trim();
  }

  return String(new Date().getFullYear());
};

const resolveAcademicYear = async (value) => {
  if (value === undefined || value === null || !String(value).trim()) {
    return getCurrentAcademicYear();
  }

  const year = String(value).trim();
  if (!ACADEMIC_YEAR_REGEX.test(year)) {
    throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
  }
  return year;
};

// Time strings are HH:mm zero-padded, so lexicographic comparison equals
// chronological order. Half-open [start, end): adjacent ranges do not overlap.
const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

const POPULATE_OPTIONS = [
  { path: 'classId', select: 'className academicYear status' },
  { path: 'timeSlotId', select: 'startTime endTime type label academicYear status' },
  { path: 'subjectId', select: 'subjectName subjectCode' },
  { path: 'teacherId', select: 'fullName teacherId email status' },
];

// Validates class/time slot/subject and resolves the teacher from the existing
// Class Management assignment. Returns everything needed to persist an entry.
// Rules 1-5 of the Timetable Management spec:
//   1. classId must be a real existing class.
//   2. timeSlotId must be a real existing Time Slot.
//   3. subjectId must be assigned to that class.
//   4. The subject must have a Teacher assigned within that class.
//   5. Resolve and save the correct teacherId automatically.
// Plus rule 9 (Break slots cannot receive Class/Subject/Teacher entries).
const assertValidEntryRefs = async ({ year, classId, timeSlotId, subjectId }) => {
  const classDoc = await Class.findOne({ _id: classId, isDeleted: { $ne: true } });
  if (!classDoc) {
    throw new ApiError(404, 'Class not found');
  }
  if (classDoc.academicYear !== year) {
    throw new ApiError(400, `Class "${classDoc.className}" belongs to academic year ${classDoc.academicYear}, not ${year}`);
  }

  const timeSlot = await TimeSlot.findById(timeSlotId).lean();
  if (!timeSlot) {
    throw new ApiError(404, 'Time slot not found');
  }
  if (timeSlot.academicYear !== year) {
    throw new ApiError(400, `Time slot (${timeSlot.startTime} - ${timeSlot.endTime}) belongs to academic year ${timeSlot.academicYear}, not ${year}`);
  }
  if (timeSlot.type === 'BREAK') {
    throw new ApiError(400, 'Break time slots cannot be scheduled with a class, subject or teacher');
  }

  const subject = await Subject.findById(subjectId).lean();
  if (!subject) {
    throw new ApiError(404, 'Subject not found');
  }

  const assignedSubjectIds = (classDoc.assignedSubjects || []).map((id) => String(id));
  if (!assignedSubjectIds.includes(String(subjectId))) {
    throw new ApiError(400, `Subject "${subject.subjectName}" is not assigned to class "${classDoc.className}"`);
  }

  // Source of truth: the teacher comes from the Class Management Class → Teacher
  // → Subject assignment. Teacher is NEVER manually assigned by this module.
  const assignment = await ClassTeacherAssignment.findOne({
    class: classDoc._id,
    subject: subject._id,
    academicYear: year,
  }).lean();

  if (!assignment) {
    throw new ApiError(400, `No teacher is assigned to subject "${subject.subjectName}" for class "${classDoc.className}"`);
  }

  return {
    classDoc,
    className: classDoc.className,
    timeSlot,
    subject,
    teacherId: assignment.teacher,
    group: deriveGroup(classDoc.className),
  };
};

// Rule 7: a teacher cannot teach two different classes during overlapping time
// ranges. Rule 8: overlap is detected from the Time Slot start/end values, not
// only from identical slot ids (half-open [start, end) convention, matching the
// Time Slots backend).
const assertNoTeacherConflict = async ({ year, teacherId, startTime, endTime, excludeEntryId = null }) => {
  const filter = { academicYear: year, teacherId };
  if (excludeEntryId) {
    filter._id = { $ne: excludeEntryId };
  }

  const entries = await TimetableEntry.find(filter)
    .select('classId timeSlotId')
    .populate('classId', 'className')
    .populate('timeSlotId', 'startTime endTime')
    .lean();

  for (const entry of entries) {
    const otherSlot = entry.timeSlotId;
    if (!otherSlot?.startTime || !otherSlot?.endTime) continue;

    if (rangesOverlap(startTime, endTime, otherSlot.startTime, otherSlot.endTime)) {
      const otherClass = entry.classId?.className || 'another class';
      throw new ApiError(
        409,
        `Teacher is already teaching ${otherClass} during ${otherSlot.startTime} - ${otherSlot.endTime}. Please choose another time slot`,
      );
    }
  }
};

const mapCreateErrors = (error, duplicateMessage) => {
  if (error.code === 11000) {
    return new ApiError(409, duplicateMessage);
  }
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((e) => e.message);
    return new ApiError(400, messages.join('. '));
  }
  return error;
};

const createTimetableEntry = async (data, userId) => {
  const year = await resolveAcademicYear(data.academicYear);

  const refs = await assertValidEntryRefs({
    year,
    classId: data.classId,
    timeSlotId: data.timeSlotId,
    subjectId: data.subjectId,
  });

  // Rule 6 & 10: duplicate protection — a class occupies each time slot once.
  const existing = await TimetableEntry.findOne({
    academicYear: year,
    classId: refs.classDoc._id,
    timeSlotId: refs.timeSlot._id,
  }).lean();

  if (existing) {
    throw new ApiError(409, 'A timetable entry already exists for this class in this time slot');
  }

  await assertNoTeacherConflict({
    year,
    teacherId: refs.teacherId,
    startTime: refs.timeSlot.startTime,
    endTime: refs.timeSlot.endTime,
  });

  try {
    return await TimetableEntry.create({
      academicYear: year,
      group: refs.group,
      classId: refs.classDoc._id,
      timeSlotId: refs.timeSlot._id,
      subjectId: refs.subject._id,
      teacherId: refs.teacherId,
      createdBy: userId,
    });
  } catch (error) {
    throw mapCreateErrors(error, 'A timetable entry already exists for this class in this time slot');
  }
};

const getAllTimetableEntries = async (filters = {}) => {
  const { academicYear, group, classId, timeSlotId, subjectId, teacherId, page = 1, limit = 10 } = filters;

  const filter = {};

  if (academicYear !== undefined && academicYear !== null && String(academicYear).trim()) {
    const year = String(academicYear).trim();
    if (!ACADEMIC_YEAR_REGEX.test(year)) {
      throw new ApiError(400, 'Invalid academic year format. Use a valid year (e.g. 2025)');
    }
    filter.academicYear = year;
  } else {
    // Open on the central/default academic year when no filter is supplied.
    filter.academicYear = await getCurrentAcademicYear();
  }

  if (group !== undefined && group !== null && String(group).trim()) {
    const groupNumber = Number(group);
    if (!VALID_GROUPS.includes(groupNumber)) {
      throw new ApiError(400, 'Invalid group. Allowed: 1, 2, 3');
    }
    filter.group = groupNumber;
  }

  const idFilters = [
    { key: 'classId', value: classId },
    { key: 'timeSlotId', value: timeSlotId },
    { key: 'subjectId', value: subjectId },
    { key: 'teacherId', value: teacherId },
  ];

  for (const { key, value } of idFilters) {
    if (value !== undefined && value !== null && String(value).trim()) {
      if (!isValidObjectId(value)) {
        throw new ApiError(400, `Invalid ${key.replace('Id', '').toLowerCase()} filter`);
      }
      filter[key] = String(value).trim();
    }
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [entries, totalItems] = await Promise.all([
    TimetableEntry.find(filter).populate(POPULATE_OPTIONS).skip(skip).limit(itemsPerPage).lean(),
    TimetableEntry.countDocuments(filter),
  ]);

  // Deterministic, readable order: class name, then slot start time.
  entries.sort((a, b) => {
    const classNameOrder = String(a.classId?.className || '').localeCompare(String(b.classId?.className || ''));
    if (classNameOrder !== 0) return classNameOrder;
    return String(a.timeSlotId?.startTime || '').localeCompare(String(b.timeSlotId?.startTime || ''));
  });

  return {
    timetableEntries: entries,
    pagination: {
      currentPage,
      totalPages: Math.ceil(totalItems / itemsPerPage),
      totalItems,
    },
  };
};

const getTimetableEntryById = async (id) => {
  const entry = await TimetableEntry.findById(id).populate(POPULATE_OPTIONS).lean();

  if (!entry) {
    throw new ApiError(404, 'Timetable entry not found');
  }

  return entry;
};

const updateTimetableEntry = async (id, data, userId) => {
  const existing = await TimetableEntry.findById(id);
  if (!existing) {
    throw new ApiError(404, 'Timetable entry not found');
  }

  const year =
    data.academicYear !== undefined && data.academicYear !== null && String(data.academicYear).trim()
      ? await resolveAcademicYear(data.academicYear)
      : existing.academicYear;

  const classId = data.classId !== undefined ? data.classId : existing.classId;
  const timeSlotId = data.timeSlotId !== undefined ? data.timeSlotId : existing.timeSlotId;
  const subjectId = data.subjectId !== undefined ? data.subjectId : existing.subjectId;

  const refs = await assertValidEntryRefs({ year, classId, timeSlotId, subjectId });

  const duplicate = await TimetableEntry.findOne({
    academicYear: year,
    classId: refs.classDoc._id,
    timeSlotId: refs.timeSlot._id,
    _id: { $ne: id },
  }).lean();

  if (duplicate) {
    throw new ApiError(409, 'A timetable entry already exists for this class in this time slot');
  }

  await assertNoTeacherConflict({
    year,
    teacherId: refs.teacherId,
    startTime: refs.timeSlot.startTime,
    endTime: refs.timeSlot.endTime,
    excludeEntryId: id,
  });

  try {
    return await TimetableEntry.findByIdAndUpdate(
      id,
      {
        academicYear: year,
        group: refs.group,
        classId: refs.classDoc._id,
        timeSlotId: refs.timeSlot._id,
        subjectId: refs.subject._id,
        teacherId: refs.teacherId,
        updatedBy: userId,
      },
      { new: true, runValidators: true },
    );
  } catch (error) {
    throw mapCreateErrors(error, 'A timetable entry already exists for this class in this time slot');
  }
};

const deleteTimetableEntry = async (id) => {
  const entry = await TimetableEntry.findById(id);
  if (!entry) {
    throw new ApiError(404, 'Timetable entry not found');
  }

  await TimetableEntry.findByIdAndDelete(id);

  return entry;
};

export default {
  createTimetableEntry,
  getAllTimetableEntries,
  getTimetableEntryById,
  updateTimetableEntry,
  deleteTimetableEntry,
};