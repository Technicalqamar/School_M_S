import Class from '../models/class.model.js';
import Teacher from '../models/teacher.model.js';
import Subject from '../models/subject.model.js';
import ClassTeacherAssignment from '../models/classTeacherAssignment.model.js';
import { ApiError } from '../utils/apiError.js';

const getClassTeacherAssignments = async (classId) => {
  const classDoc = await Class.findOne({ _id: classId, isDeleted: { $ne: true } }).populate('assignedSubjects');

  if (!classDoc) {
    throw new ApiError(404, 'Class not found');
  }

  const assignments = await ClassTeacherAssignment.find({ class: classId })
    .populate({ path: 'teacher', select: 'teacherId fullName teacherImage status' })
    .populate({ path: 'subject', select: 'subjectName subjectCode' })
    .lean();

  const grouped = [];
  const index = new Map();

  for (const assignment of assignments) {
    const teacherId = assignment.teacher?._id?.toString();

    if (!teacherId) continue;

    if (!index.has(teacherId)) {
      const entry = { teacher: assignment.teacher, subjects: [] };
      index.set(teacherId, entry);
      grouped.push(entry);
    }

    if (assignment.subject) {
      index.get(teacherId).subjects.push(assignment.subject);
    }
  }

  return {
    classInfo: {
      _id: classDoc._id,
      className: classDoc.className,
      academicYear: classDoc.academicYear,
      status: classDoc.status,
    },
    classSubjects: (classDoc.assignedSubjects || []).map((s) => ({
      _id: s._id,
      subjectName: s.subjectName,
      subjectCode: s.subjectCode,
    })),
    teacherAssignments: grouped,
    totalTeachers: grouped.length,
  };
};

const assignTeacherSubject = async (classId, teacherId, subjectId) => {
  const classDoc = await Class.findOne({ _id: classId, isDeleted: { $ne: true } });

  if (!classDoc) {
    throw new ApiError(404, 'Class not found');
  }

  const teacher = await Teacher.findById(teacherId);

  if (!teacher) {
    throw new ApiError(404, 'Teacher not found');
  }

  const subject = await Subject.findById(subjectId);

  if (!subject) {
    throw new ApiError(404, 'Subject not found');
  }

  const subjectString = subject._id.toString();
  const classSubjectIds = (classDoc.assignedSubjects || []).map((id) => id.toString());

  if (!classSubjectIds.includes(subjectString)) {
    throw new ApiError(400, 'Subject is not assigned to this class');
  }

  const existing = await ClassTeacherAssignment.findOne({
    class: classDoc._id,
    teacher: teacher._id,
    subject: subject._id,
  });

  if (existing) {
    throw new ApiError(409, 'Teacher is already assigned to this subject for this class');
  }

  const takenByOther = await ClassTeacherAssignment.findOne({
    class: classDoc._id,
    subject: subject._id,
    teacher: { $ne: teacher._id },
  }).populate('teacher', 'fullName').lean();

  if (takenByOther) {
    const holderName = takenByOther.teacher?.fullName || 'another teacher';
    throw new ApiError(409, `Subject "${subject.subjectName}" is already assigned to ${holderName} for this class`);
  }

  try {
    const assignment = await ClassTeacherAssignment.create({
      class: classDoc._id,
      teacher: teacher._id,
      subject: subject._id,
      academicYear: classDoc.academicYear,
    });

    await resyncTeacherAssignedSubjects(teacher._id);

    return assignment;
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Subject can only be assigned to one teacher for this class');
    }

    throw error;
  }
};

const removeTeacherSubject = async (classId, teacherId, subjectId) => {
  const assignment = await ClassTeacherAssignment.findOneAndDelete({
    class: classId,
    teacher: teacherId,
    subject: subjectId,
  });

  if (!assignment) {
    throw new ApiError(404, 'Teacher subject assignment not found for this class');
  }

  await resyncTeacherAssignedSubjects(teacherId);

  return assignment;
};

const resyncTeacherAssignedSubjects = async (teacherId) => {
  const subjectIds = await ClassTeacherAssignment.find({ teacher: teacherId }).distinct('subject');

  await Teacher.updateOne({ _id: teacherId }, { $set: { assignedSubjects: subjectIds } });
};

export default {
  getClassTeacherAssignments,
  assignTeacherSubject,
  removeTeacherSubject,
  resyncTeacherAssignedSubjects,
};