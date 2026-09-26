import Timetable from '../models/timetable.model.js';
import Class from '../models/class.model.js';
import Teacher from '../models/teacher.model.js';
import Subject from '../models/subject.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import ClassTeacherAssignment from '../models/classTeacherAssignment.model.js';
import AuditLog from '../models/auditLog.model.js';
import { ApiError } from '../utils/apiError.js';

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const timeToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
};

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();
  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear);
  }
  return String(new Date().getFullYear());
};

const validateYear = (value, label = 'academicYear') => {
  const trimmed = String(value ?? '').trim();
  if (!ACADEMIC_YEAR_REGEX.test(trimmed)) {
    throw new ApiError(400, `${label} must be a valid year (e.g. 2026)`);
  }
  return trimmed;
};

const validateClassExists = async (classId) => {
  const cls = await Class.findById(classId).populate('assignedSubjects');
  if (!cls) throw new ApiError(404, 'Class not found');
  return cls;
};

const getAvailableSubjectsForClass = async (classId) => {
  const cls = await Class.findById(classId).populate({
    path: 'assignedSubjects',
    select: 'subjectName',
  });

  if (!cls) throw new ApiError(404, 'Class not found');

  return cls.assignedSubjects.map((s) => ({
    id: s._id,
    name: s.subjectName,
  }));
};

const getAvailableTeachersForSubject = async (subjectId) => {
  const assignmentTeachers = await ClassTeacherAssignment.find({
    subject: subjectId,
  })
    .populate({ path: 'teacher', select: 'fullName status' })
    .lean();

  const fromAssignments = (assignmentTeachers || [])
    .map((a) => a.teacher)
    .filter((teacher) => teacher && teacher.status === 'Active')
    .map((teacher) => ({ id: teacher._id, name: teacher.fullName }));

  if (fromAssignments.length > 0) {
    const seen = new Set();
    return fromAssignments.filter((t) => {
      const key = String(t.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const teachers = await Teacher.find({ assignedSubjects: subjectId, status: 'Active' })
    .select('fullName')
    .lean();

  return teachers.map((t) => ({
    id: t._id,
    name: t.fullName,
  }));
};

/**
 * Source of truth: Class Management (ClassTeacherAssignment: Class + Teacher + Subject).
 * A teaching period is only valid when the exact (class, subjectId, teacherId) combination
 * is actually assigned in Class Management for that class.
 */
const validateTimetableAssignments = async (periods, classId) => {
  const cls = await Class.findById(classId)
    .populate({ path: 'assignedSubjects', select: 'subjectName' })
    .lean();

  if (!cls) throw new ApiError(404, 'Class not found');

  const classSubjectIds = new Set((cls.assignedSubjects || []).map((s) => s._id.toString()));
  const subjectNames = {};
  for (const s of cls.assignedSubjects || []) {
    subjectNames[s._id.toString()] = s.subjectName;
  }

  const teachingPeriods = periods.filter((p) => p.type === 'teaching');

  const teacherIds = [...new Set(teachingPeriods.map((p) => p.teacherId?.toString()).filter(Boolean))];
  const subjectIds = [...new Set(teachingPeriods.map((p) => p.subjectId?.toString()).filter(Boolean))];

  const [teachers, subjects, assignments] = await Promise.all([
    Teacher.find({ _id: { $in: teacherIds } }).select('_id fullName').lean(),
    Subject.find({ _id: { $in: subjectIds } }).select('_id subjectName').lean(),
    ClassTeacherAssignment.find({
      class: classId,
      teacher: { $in: teacherIds },
      subject: { $in: subjectIds },
    })
      .select('teacher subject')
      .lean(),
  ]);

  const teacherName = new Map(teachers.map((t) => [t._id.toString(), t.fullName || String(t._id)]));
  const subjectName = new Map(subjects.map((s) => [s._id.toString(), s.subjectName || String(s._id)]));
  const validCombos = new Set((assignments || []).map((a) => `${a.teacher.toString()}:${a.subject.toString()}`));

  for (const p of teachingPeriods) {
    const subjectId = p.subjectId?.toString();
    const teacherId = p.teacherId?.toString();

    if (!classSubjectIds.has(subjectId)) {
      throw new ApiError(400, `${subjectName.get(subjectId) || subjectId} is not assigned to the selected class`);
    }

    if (!teacherName.has(teacherId)) {
      throw new ApiError(400, `Teacher with ID ${teacherId} not found`);
    }

    if (!validCombos.has(`${teacherId}:${subjectId}`)) {
      throw new ApiError(
        400,
        `${teacherName.get(teacherId)} is not assigned to teach ${subjectName.get(subjectId) || subjectId} in ${cls.className} for this academic year`,
      );
    }
  }
};

const checkConflicts = async (periods, classId, excludeTimetableId, academicYear) => {
  const conflicts = [];
  const teachingPeriods = periods.filter((p) => p.type === 'teaching');

  // --- Teacher Conflict ---
  // Find all timetables (excluding current, same academic year) that share any teacher
  const teacherIds = [...new Set(teachingPeriods.map((p) => p.teacherId?.toString()).filter(Boolean))];

  if (teacherIds.length > 0) {
    const otherTimetables = await Timetable.find({
      _id: { $ne: excludeTimetableId || null },
      academicYear,
      'periods.teacherId': { $in: teacherIds },
      'periods.type': 'teaching',
    })
      .populate({ path: 'classId', select: 'className' })
      .populate({ path: 'periods.teacherId', select: 'fullName' })
      .lean();

    const teacherPeriodsMap = {};
    for (const tt of otherTimetables) {
      for (const pp of tt.periods) {
        if (pp.type !== 'teaching' || !pp.teacherId) continue;
        const tObj = pp.teacherId;
        const tid = tObj._id?.toString() || tObj.toString();
        if (!teacherPeriodsMap[tid]) teacherPeriodsMap[tid] = [];
        teacherPeriodsMap[tid].push({
          startTime: pp.startTime,
          endTime: pp.endTime,
          className: tt.classId?.className || 'Unknown',
          teacherName: tObj.fullName || '',
        });
      }
    }

    for (const p of teachingPeriods) {
      const tid = p.teacherId?.toString();
      if (!tid || !teacherPeriodsMap[tid]) continue;

      const teacherName = teacherPeriodsMap[tid][0]?.teacherName || 'Teacher';
      for (const existing of teacherPeriodsMap[tid]) {
        if (rangesOverlap(p.startTime, p.endTime, existing.startTime, existing.endTime)) {
          conflicts.push({
            type: 'TEACHER_CONFLICT',
            message: `${teacherName} is already assigned to ${existing.className} during ${p.startTime} - ${p.endTime}`,
          });
          break;
        }
      }
    }
  }

  // --- Class Conflict ---
  // Check for overlapping periods within the same timetable
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const a = periods[i];
      const b = periods[j];
      if (rangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
        conflicts.push({
          type: 'CLASS_CONFLICT',
          message: `Class already has a period during ${a.startTime} - ${a.endTime}`,
        });
        break;
      }
    }
    if (conflicts.some((c) => c.type === 'CLASS_CONFLICT')) break;
  }

  // --- Subject Frequency Warnings ---
  const subjectCount = {};
  for (const p of teachingPeriods) {
    const sid = p.subjectId?.toString();
    if (sid) subjectCount[sid] = (subjectCount[sid] || 0) + 1;
  }

  const subjectIds = Object.keys(subjectCount);
  const subjectMap = {};
  if (subjectIds.length > 0) {
    const subjects = await Subject.find({ _id: { $in: subjectIds } }).select('subjectName').lean();
    for (const s of subjects) {
      subjectMap[s._id.toString()] = s.subjectName;
    }
  }

  // --- Duplicate schedule guard ---
  // Same Class + Subject + Teacher must not be scheduled twice in the same period slot.
  const slotKeys = new Set();
  for (const p of teachingPeriods) {
    const key = `${p.periodNo}:${p.startTime}-${p.endTime}:${p.subjectId?.toString()}:${p.teacherId?.toString()}`;
    if (slotKeys.has(key)) {
      conflicts.push({
        type: 'DUPLICATE_SCHEDULE',
        message: `Duplicate schedule detected for ${(subjectMap[p.subjectId?.toString()] || p.subjectId)} during period ${p.periodNo} (${p.startTime} - ${p.endTime}) in the same class timetable`,
      });
      break;
    }
    slotKeys.add(key);
  }

  const warnings = [];
  for (const [sid, count] of Object.entries(subjectCount)) {
    if (count >= 5) {
      const name = subjectMap[sid] || sid;
      warnings.push(`${name} appears ${count} times in this timetable.`);
    }
  }

  return { conflicts, warnings };
};

const createTimetable = async (data, userId) => {
  const { academicYear, classId, periods, periodStartTime, periodEndTime } = data;

  const resolvedAcademicYear = validateYear(academicYear || (await getCurrentAcademicYear()));

  await validateClassExists(classId);
  await validateTimetableAssignments(periods, classId);

  const existing = await Timetable.findOne({ academicYear: resolvedAcademicYear, classId });
  if (existing) {
    throw new ApiError(409, 'A timetable already exists for this class and academic year');
  }

  const { conflicts, warnings } = await checkConflicts(periods, classId, null, resolvedAcademicYear);

  if (conflicts.length > 0) {
    throw new ApiError(409, 'Timetable conflicts detected', conflicts);
  }

  try {
    const timetable = await Timetable.create({
      academicYear: resolvedAcademicYear,
      classId,
      periods,
      periodStartTime: periodStartTime || '',
      periodEndTime: periodEndTime || '',
      createdBy: userId,
      updatedBy: userId,
    });

    await AuditLog.create({
      action: 'CREATE',
      module: 'TIMETABLE',
      entityId: timetable._id.toString(),
      entityType: 'Timetable',
      performedBy: userId,
      details: { academicYear: resolvedAcademicYear, classId },
    });

    return { timetable, warnings };
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'A timetable already exists for this class and academic year');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const getAllTimetables = async () => {
  const timetables = await Timetable.find()
    .populate({ path: 'classId', select: 'className academicYear' })
    .populate({ path: 'periods.teacherId', select: 'fullName teacherId' })
    .populate({ path: 'periods.subjectId', select: 'subjectName' })
    .populate({ path: 'createdBy', select: 'fullName' })
    .populate({ path: 'updatedBy', select: 'fullName' })
    .sort({ createdAt: -1 })
    .lean();

  return timetables;
};

const getTimetableByClass = async (classId) => {
  const timetables = await Timetable.find({ classId })
    .populate({ path: 'classId', select: 'className academicYear' })
    .populate({ path: 'periods.teacherId', select: 'fullName teacherId' })
    .populate({ path: 'periods.subjectId', select: 'subjectName' })
    .populate({ path: 'createdBy', select: 'fullName' })
    .populate({ path: 'updatedBy', select: 'fullName' })
    .sort({ createdAt: -1 })
    .lean();

  return timetables;
};

const getTimetableById = async (id) => {
  const timetable = await Timetable.findById(id)
    .populate({ path: 'classId', select: 'className academicYear' })
    .populate({ path: 'periods.teacherId', select: 'fullName teacherId' })
    .populate({ path: 'periods.subjectId', select: 'subjectName' })
    .populate({ path: 'createdBy', select: 'fullName' })
    .populate({ path: 'updatedBy', select: 'fullName' })
    .lean();

  if (!timetable) throw new ApiError(404, 'Timetable not found');

  return timetable;
};

const updateTimetable = async (id, data, userId) => {
  const existing = await Timetable.findById(id);
  if (!existing) throw new ApiError(404, 'Timetable not found');

  const { academicYear, classId, periods, periodStartTime, periodEndTime } = data;

  if (classId) await validateClassExists(classId);

  const resolvedAcademicYear = academicYear ? validateYear(academicYear) : existing.academicYear;
  const resolvedClassId = classId || existing.classId;

  if (academicYear || classId) {
    const duplicate = await Timetable.findOne({
      _id: { $ne: id },
      academicYear: resolvedAcademicYear,
      classId: resolvedClassId,
    });
    if (duplicate) {
      throw new ApiError(409, 'A timetable already exists for this class and academic year');
    }
  }

  let warnings = [];
  const updateFields = {};

  if (periods) {
    await validateTimetableAssignments(periods, resolvedClassId);
    const result = await checkConflicts(periods, resolvedClassId, id, resolvedAcademicYear);
    if (result.conflicts.length > 0) {
      throw new ApiError(409, 'Timetable conflicts detected', result.conflicts);
    }
    warnings = result.warnings;
    updateFields.periods = periods;
  }

  if (academicYear) updateFields.academicYear = resolvedAcademicYear;
  if (classId) updateFields.classId = classId;
  if (periodStartTime !== undefined) updateFields.periodStartTime = periodStartTime;
  if (periodEndTime !== undefined) updateFields.periodEndTime = periodEndTime;
  if (userId) updateFields.updatedBy = userId;

  try {
    const updated = await Timetable.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    await AuditLog.create({
      action: 'UPDATE',
      module: 'TIMETABLE',
      entityId: id,
      entityType: 'Timetable',
      performedBy: userId,
      details: { academicYear: resolvedAcademicYear, classId: resolvedClassId },
    });

    return { timetable: updated, warnings };
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'A timetable already exists for this class and academic year');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const deleteTimetable = async (id, userId) => {
  const existing = await Timetable.findById(id);
  if (!existing) throw new ApiError(404, 'Timetable not found');

  await Timetable.findByIdAndDelete(id);

  await AuditLog.create({
    action: 'DELETE',
    module: 'TIMETABLE',
    entityId: id,
    entityType: 'Timetable',
    performedBy: userId,
    details: { academicYear: existing.academicYear, classId: existing.classId },
  });
};

export default {
  createTimetable,
  getAllTimetables,
  getTimetableByClass,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
  getAvailableSubjectsForClass,
  getAvailableTeachersForSubject,
  validateTimetableAssignments,
  checkConflicts,
};
