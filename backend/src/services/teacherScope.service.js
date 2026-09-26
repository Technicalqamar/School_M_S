import Class from '../models/class.model.js';
import ClassTeacherAssignment from '../models/classTeacherAssignment.model.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Returns the teacher's subject ids scoped to the given class.
 * Source of truth: ClassTeacherAssignment (Class + Teacher + Subject).
 * Falls back to the legacy derivation (teacher.assignedSubjects ∩ class.assignedSubjects)
 * only when no ClassTeacherAssignment rows exist for this teacher + class.
 */
const getTeacherClassScope = async (teacher, cls) => {
  const assignments = await ClassTeacherAssignment.find({
    teacher: teacher._id,
    class: cls._id,
    academicYear: cls.academicYear,
  })
    .select('subject')
    .lean();

  const assignedIds = (assignments || []).map((a) => String(a.subject));

  if (assignedIds.length > 0) {
    return {
      teacherSubjectIds: assignedIds,
      teacherSubjectSet: new Set(assignedIds),
    };
  }

  const teacherSubjectIds = (teacher.assignedSubjects || []).map((id) => String(id));
  const classSubjectIds = (cls.assignedSubjects || []).map((s) => String(s._id || s));
  const scoped = teacherSubjectIds.filter((id) => classSubjectIds.includes(id));

  return {
    teacherSubjectIds: scoped,
    teacherSubjectSet: new Set(scoped),
  };
};

/**
 * Returns the teacher's per-class scope for the current academic year:
 * [{ classId, className, academicYear, status, subjects: [{ id, subjectName, subjectCode }] }]
 * Source of truth: ClassTeacherAssignment. Falls back to the legacy derivation
 * only when the teacher has no assignment rows at all.
 */
const getTeacherScope = async (teacher, academicYear) => {
  const assignments = await ClassTeacherAssignment.find({
    teacher: teacher._id,
    academicYear,
  })
    .populate({ path: 'class', select: 'className academicYear status isDeleted' })
    .populate({ path: 'subject', select: 'subjectName subjectCode' })
    .lean();

  if (assignments.length > 0) {
    const result = [];
    const index = new Map();

    for (const assignment of assignments) {
      const cls = assignment.class;
      if (!cls || cls.status !== 'Active' || cls.isDeleted) continue;

      const key = String(cls._id);
      if (!index.has(key)) {
        const entry = {
          classId: cls._id,
          className: cls.className,
          academicYear: cls.academicYear,
          status: cls.status,
          subjects: [],
        };
        index.set(key, entry);
        result.push(entry);
      }

      const subject = assignment.subject;
      if (!subject) continue;

      const existing = index.get(key).subjects;
      if (!existing.some((s) => String(s.id) === String(subject._id))) {
        existing.push({
          id: subject._id,
          subjectName: subject.subjectName,
          subjectCode: subject.subjectCode || '',
        });
      }
    }

    return result;
  }

  const teacherSubjectIds = (teacher.assignedSubjects || []).map((id) => String(id));

  if (teacherSubjectIds.length === 0) {
    return [];
  }

  const classes = await Class.find({
    academicYear,
    status: 'Active',
    isDeleted: { $ne: true },
    assignedSubjects: { $in: teacherSubjectIds },
  })
    .populate({ path: 'assignedSubjects', select: 'subjectName subjectCode' })
    .lean();

  return (classes || []).map((cls) => ({
    classId: cls._id,
    className: cls.className,
    academicYear: cls.academicYear,
    status: cls.status,
    subjects: (cls.assignedSubjects || [])
      .filter((s) => teacherSubjectIds.includes(String(s._id)))
      .map((s) => ({
        id: s._id,
        subjectName: s.subjectName,
        subjectCode: s.subjectCode || '',
      })),
  }));
};

const validateScopeResources = (scope, { label = 'class' } = {}) => {
  if (!Array.isArray(scope)) {
    throw new ApiError(500, `Invalid ${label} scope`);
  }
  return scope;
};

export { getTeacherClassScope, getTeacherScope, validateScopeResources };