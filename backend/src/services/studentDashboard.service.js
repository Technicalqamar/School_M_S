import Student from '../models/student.model.js';
import Admin from '../models/admin.model.js';
import Class from '../models/class.model.js';
import Assignment from '../models/assignment.model.js';
import Exam from '../models/exam.model.js';
import ExamSchedule from '../models/examSchedule.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import feeOutstandingService from './feeOutstanding.service.js';
import portalAccessService from './portalAccess.service.js';

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();

  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }

  return String(new Date().getFullYear());
};

const resolveStudent = async (user) => {
  if (user.referenceId && user.referenceModel === 'Student') {
    const student = await Student.findById(user.referenceId);
    if (!student) {
      throw new ApiError(404, 'Linked student profile not found');
    }
    return student;
  }

  if (user.role === 'student') {
    const student = user.referenceId
      ? await Student.findById(user.referenceId)
      : await Student.findOne({ studentId: user.loginId || user.studentId });
    if (!student) {
      throw new ApiError(404, 'Student profile not found');
    }
    return student;
  }

  throw new ApiError(403, 'Only students can access the student dashboard');
};

// Resolves the student whose dashboard is being requested.
//
// Normal student sessions resolve the student from the authenticated
// account. Administrator-authorized portal access resolves the SELECTED
// student only from the portal access context embedded in the token
// (accessType + accessStudentId); if the authenticated account is itself a
// student account (portal token), it must be linked to the very same selected
// student, so no other student's data can ever be returned.
const resolveStudentForRequest = async (user, context = {}) => {
  if (context.accessType === portalAccessService.ACCESS_TYPE) {
    if (user?.role === 'student' && user.referenceId && user.referenceModel === 'Student') {
      const linked = await Student.findById(user.referenceId);
      if (!linked || (context.accessStudentId && String(linked.studentId) !== String(context.accessStudentId))) {
        throw new ApiError(403, 'Portal access could not be verified for this student');
      }
      return linked;
    }

    if (context.accessStudentId) {
      const selected = await Student.findOne({ studentId: context.accessStudentId });
      if (!selected) {
        throw new ApiError(404, 'Selected student not found');
      }
      return selected;
    }

    throw new ApiError(403, 'Portal access could not be verified for this student');
  }

  return resolveStudent(user);
};

const assertActiveStudent = (student) => {
  if (String(student.status).toLowerCase() !== 'active') {
    throw new ApiError(403, 'Your student profile is inactive. Contact the administration.');
  }
};

const buildProfile = (student) => ({
  id: student._id,
  studentId: student.studentId,
  fullName: student.fullName,
  fatherName: student.fatherName || '',
  gender: student.gender || '',
  dateOfBirth: student.dateOfBirth || null,
  className: student.class || '',
  academicYear: student.academicYear || '',
  image: student.studentImage || '',
  status: student.status || '',
});

const buildAssignment = (doc) => ({
  id: doc._id,
  title: doc.title,
  description: doc.description,
  subjectId: doc.subjectId?._id,
  subjectName: doc.subjectId?.subjectName || null,
  subjectCode: doc.subjectId?.subjectCode || null,
  teacherName: doc.teacherId?.fullName || null,
  teacherCode: doc.teacherId?.teacherId || null,
  dueDate: doc.dueDate,
  status: doc.status,
  createdAt: doc.createdAt,
});

const buildExam = (doc) => ({
  id: doc._id,
  name: doc.name,
  type: doc.type,
  startDate: doc.startDate,
  endDate: doc.endDate,
  description: doc.description,
});

const getStudentDashboardData = async (user, context = {}) => {
  const student = await resolveStudentForRequest(user, context);
  assertActiveStudent(student);

  const academicYear = student.academicYear || (await getCurrentAcademicYear());

  const [classDoc, fee] = await Promise.all([
    student.class ? Class.findOne({ className: student.class }).select('className academicYear status isDeleted').lean() : Promise.resolve(null),
    feeOutstandingService.getStudentOutstandingDues(student._id, academicYear),
  ]);

  let homework = { total: 0, assignments: [] };

  if (classDoc && !classDoc.isDeleted && classDoc.status === 'Active') {
    const [total, assignments] = await Promise.all([
      Assignment.countDocuments({ classId: classDoc._id }),
      Assignment.find({ classId: classDoc._id })
        .populate({ path: 'subjectId', select: 'subjectName subjectCode' })
        .populate({ path: 'teacherId', select: 'fullName teacherId' })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ]);

    homework = { total, assignments: assignments.map(buildAssignment) };
  }

  const now = new Date();

  const [exams, scheduledPapers] = await Promise.all([
    Exam.find({
      classes: student.class,
      academicYear,
      status: 'Active',
      endDate: { $gte: now },
    })
      .select('name type startDate endDate description')
      .sort({ startDate: 1 })
      .limit(6)
      .lean(),
    classDoc && !classDoc.isDeleted && classDoc.status === 'Active'
      ? ExamSchedule.countDocuments({ className: student.class, academicYear, status: 'Active', examDate: { $gte: now } })
      : Promise.resolve(0),
  ]);

  return {
    student: buildProfile(student),
    class: classDoc
      ? { id: classDoc._id, className: classDoc.className, academicYear: classDoc.academicYear }
      : null,
    academicYear,
    fee,
    homework,
    examinations: {
      total: exams.length,
      scheduledPapers,
      list: exams.map(buildExam),
    },
  };
};

export default {
  getStudentDashboardData,
  buildProfile,
};