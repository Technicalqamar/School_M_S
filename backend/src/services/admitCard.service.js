import mongoose from 'mongoose';
import Student from '../models/student.model.js';
import Exam from '../models/exam.model.js';
import ExamSubject from '../models/examSubject.model.js';
import ExamSchedule from '../models/examSchedule.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';

const VALID_CLASS_NAMES = [
  'Montessori',
  'Nursery',
  'KG 1',
  'KG 2',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
];

const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();
  if (settings?.currentAcademicYear && ACADEMIC_YEAR_REGEX.test(String(settings.currentAcademicYear))) {
    return String(settings.currentAcademicYear);
  }
  return String(new Date().getFullYear());
};

const resolveAcademicYear = async (requestedYear) => {
  if (requestedYear) {
    const trimmed = String(requestedYear).trim();
    if (!ACADEMIC_YEAR_REGEX.test(trimmed)) {
      throw new ApiError(400, 'Academic year must be a valid year (e.g. 2025)');
    }
    return trimmed;
  }
  return getCurrentAcademicYear();
};

const getStudent = async (rawStudentId) => {
  const studentId = String(rawStudentId || '').trim();
  if (!studentId) {
    return null;
  }

  let student = null;
  if (mongoose.Types.ObjectId.isValid(studentId)) {
    student = await Student.findById(studentId);
  }
  if (!student) {
    student = await Student.findOne({
      studentId: new RegExp(`^${escapeRegex(studentId)}$`, 'i'),
    });
  }
  return student;
};

const buildAdmitCard = (student, exam, className, academicYear, examSubjects, publishedSchedules) => ({
  student: {
    studentId: student.studentId,
    fullName: student.fullName,
    fatherName: student.fatherName,
    studentImage: student.studentImage || '',
    className,
    academicYear: String(student.academicYear),
  },
  exam: {
    name: exam.name,
    type: exam.type,
    academicYear: String(exam.academicYear),
  },
  className,
  academicYear: String(academicYear),
  examSubjects: examSubjects.map((es) => ({
    subjectName: es.subjectId?.subjectName || '-',
    totalMarks: es.totalMarks,
    passingMarks: es.passingMarks,
  })),
  schedules: publishedSchedules.map((s) => ({
    subjectName: s.subjectId?.subjectName || '-',
    examDate: s.examDate,
    startTime: s.startTime,
    endTime: s.endTime,
    room: s.room || '',
    notes: s.notes || '',
  })),
});

const getAdmitCard = async (query = {}) => {
  const {
    academicYear: rawAcademicYear,
    examId: rawExamId,
    className: rawClassName,
    studentId: rawStudentId,
  } = query;

  const academicYear = await resolveAcademicYear(rawAcademicYear);

  const className = String(rawClassName || '').trim();
  if (!className) {
    throw new ApiError(400, 'Class is required');
  }
  if (!VALID_CLASS_NAMES.includes(className)) {
    throw new ApiError(400, `"${className}" is not a valid class name`);
  }

  const examId = String(rawExamId || '').trim();
  if (!examId || !mongoose.Types.ObjectId.isValid(examId)) {
    throw new ApiError(400, 'Invalid exam id');
  }

  const exam = await Exam.findOne({ _id: examId, status: 'Active' });
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }
  if (String(exam.academicYear) !== String(academicYear)) {
    throw new ApiError(400, 'The exam does not belong to the selected academic year');
  }

  const examClasses = Array.isArray(exam.classes) ? exam.classes.map(String) : [];
  if (!examClasses.includes(className)) {
    throw new ApiError(400, `Class "${className}" is not configured for this exam`);
  }

  const [examSubjects, schedules] = await Promise.all([
    ExamSubject.find({
      examId,
      className,
      academicYear: String(academicYear),
      status: 'Active',
    })
      .populate('subjectId', 'subjectName')
      .sort({ subjectId: 1 })
      .lean(),
    ExamSchedule.find({
      examId,
      className,
      academicYear: String(academicYear),
      status: 'Active',
    })
      .populate('subjectId', 'subjectName')
      .sort({ examDate: 1, startTime: 1 })
      .lean(),
  ]);

  const configuredSubjectIds = new Set(
    examSubjects.map((es) => (es.subjectId ? String(es.subjectId._id) : '')).filter((id) => id !== ''),
  );

  const publishedSchedules = schedules.filter(
    (s) => s.subjectId && configuredSubjectIds.has(String(s.subjectId._id)),
  );

  if (publishedSchedules.length === 0) {
    throw new ApiError(404, 'No exam schedule has been published for this exam and class yet');
  }

  const studentId = String(rawStudentId || '').trim();
  if (studentId) {
    const student = await getStudent(studentId);
    if (!student) {
      throw new ApiError(404, 'Student not found');
    }
    if (String(student.class) !== className) {
      throw new ApiError(400, 'Student does not belong to the selected class');
    }
    if (String(student.academicYear) !== String(academicYear)) {
      throw new ApiError(400, 'Student is not enrolled for the selected academic year');
    }

    return {
      mode: 'individual',
      admitCard: buildAdmitCard(student, exam, className, academicYear, examSubjects, publishedSchedules),
    };
  }

  const students = await Student.find({
    class: className,
    academicYear: String(academicYear),
    status: 'Active',
  })
    .sort({ studentId: 1 })
    .lean();

  if (students.length === 0) {
    throw new ApiError(404, 'No active students found in the selected class for the selected academic year');
  }

  return {
    mode: 'class',
    admitCards: students.map((student) =>
      buildAdmitCard(student, exam, className, academicYear, examSubjects, publishedSchedules),
    ),
    totalStudents: students.length,
  };
};

export default {
  getAdmitCard,
};