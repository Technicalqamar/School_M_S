import mongoose from 'mongoose';
import Leave from '../models/leave.model.js';
import Student from '../models/student.model.js';
import Teacher from '../models/teacher.model.js';
import { ApiError } from '../utils/apiError.js';
import notificationEngine from './notificationEngine.service.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_RECIPIENT_ROLES,
  NOTIFICATION_FANOUT_TARGETS,
} from '../constants/notification.constants.js';

const VALID_LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected'];
const ACTIVE_STATUSES = ['Pending', 'Approved'];

const normalizeDateStr = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

// Resolves a person reference (ObjectId or human-readable studentId/teacherId string)
// to the real Student/Teacher document and its key fields.
const resolvePerson = async (type, payload = {}) => {
  if (type === 'Student') {
    const ref = payload.student || payload.studentId;
    if (!ref || (typeof ref === 'string' && !ref.trim())) {
      throw new ApiError(400, 'Student reference (student or studentId) is required for a Student leave');
    }

    const person = mongoose.isValidObjectId(String(ref))
      ? await Student.findById(ref).lean()
      : await Student.findOne({ studentId: String(ref).trim() }).lean();

    if (!person) {
      throw new ApiError(404, `Student not found for ID: ${ref}`);
    }

    return {
      person,
      field: 'student',
      personId: person._id,
      personIdString: person.studentId || '',
      fullName: person.fullName || '',
      class: person.class || '',
      academicYear: person.academicYear || '',
      status: person.status || '',
    };
  }

  const ref = payload.teacher || payload.teacherId;
  if (!ref || (typeof ref === 'string' && !ref.trim())) {
    throw new ApiError(400, 'Teacher reference (teacher or teacherId) is required for a Teacher leave');
  }

  const person = mongoose.isValidObjectId(String(ref))
    ? await Teacher.findById(ref).lean()
    : await Teacher.findOne({ teacherId: String(ref).trim() }).lean();

  if (!person) {
    throw new ApiError(404, `Teacher not found for ID: ${ref}`);
  }

  return {
    person,
    field: 'teacher',
    personId: person._id,
    personIdString: person.teacherId || '',
    fullName: person.fullName || '',
    class: '',
    academicYear: person.academicYear || '',
    status: person.status || '',
  };
};

// Academic-year rule: person must be Active and belong to the requested academic year,
// and the leave range must fall inside that academic year (prevents future/invalid
// academic-year combinations).
const validatePersonAndDates = ({ type, person, personIdString, academicYear, fromDate, toDate }) => {
  if (person.status !== 'Active') {
    throw new ApiError(400, `${type} ${personIdString} (${person.fullName}) is not active`);
  }

  if (person.academicYear !== academicYear) {
    throw new ApiError(400,
      `${type} ${personIdString} belongs to academic year ${person.academicYear}, not ${academicYear}`,
    );
  }

  const from = normalizeDateStr(fromDate);
  const to = normalizeDateStr(toDate);
  if (!from || !to) {
    throw new ApiError(400, 'Valid from date and to date are required');
  }
  if (to < from) {
    throw new ApiError(400, 'To date cannot be before from date');
  }

  const year = parseInt(academicYear, 10);
  if (new Date(`${from}T00:00:00`).getFullYear() !== year
    || new Date(`${to}T00:00:00`).getFullYear() !== year) {
    throw new ApiError(400, 'Leave dates must fall within the selected academic year');
  }

  return { from, to };
};

const validateNoOverlap = async ({ type, personId, from, to, excludeId = null }) => {
  const idField = type === 'Student' ? 'student' : 'teacher';
  const filter = {
    type,
    [idField]: personId,
    status: { $in: ACTIVE_STATUSES },
    fromDate: { $lte: to },
    toDate: { $gte: from },
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const overlap = await Leave.findOne(filter).lean();
  if (overlap) {
    throw new ApiError(409,
      `Leave already exists for ${type} ${personId.toString()} from ${overlap.fromDate} to ${overlap.toDate} (status: ${overlap.status})`,
    );
  }
};

const createLeave = async (data, userId) => {
  const { type, academicYear, status } = data;

  const resolved = await resolvePerson(type, data);

  const { from, to } = validatePersonAndDates({
    type,
    person: resolved.person,
    personIdString: resolved.personIdString,
    academicYear,
    fromDate: data.fromDate,
    toDate: data.toDate,
  });

  // Class is only applicable to students; default to the student's real class.
  let classValue = data.class || '';
  if (type === 'Student') {
    if (classValue && classValue !== resolved.class) {
      throw new ApiError(400, `Class ${classValue} does not match the student's class (${resolved.class})`);
    }
    classValue = resolved.class;
  }

  await validateNoOverlap({
    type,
    personId: resolved.personId,
    from,
    to,
  });

  const requestedStatus = status && VALID_LEAVE_STATUSES.includes(status) ? status : 'Pending';
  const isDecision = ['Approved', 'Rejected'].includes(requestedStatus);

  let leave;
  try {
    leave = await Leave.create({
      type,
      [resolved.field]: resolved.personId,
      class: classValue,
      academicYear,
      fromDate: from,
      toDate: to,
      reason: data.reason,
      status: requestedStatus,
      requestedBy: userId,
      approvedBy: isDecision ? userId : undefined,
      approvedAt: isDecision ? new Date() : undefined,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }

  const mapped = await populateAndMap(leave);

  // A leave created already decided (an admin entering a past decision) is not
  // awaiting review, so only a genuinely pending request alerts the office.
  if (!isDecision) {
    const roleLabel = type === 'Student' ? 'Student' : 'Teacher';
    await notificationEngine.notify({
      type: NOTIFICATION_TYPES.LEAVE_REQUESTED,
      title: 'New leave request',
      message: `${roleLabel} ${mapped.name} (${mapped.personId}) requested leave from ${normalizeDateStr(leave.fromDate)} to ${normalizeDateStr(leave.toDate)}.${mapped.class ? ` Class: ${mapped.class}.` : ''} Reason: ${leave.reason}`,
      fanout: NOTIFICATION_FANOUT_TARGETS.ALL_ADMINS,
      academicYear,
      relatedEntity: { model: 'Leave', id: leave._id, label: mapped.personId },
    });
  }

  return mapped;
};

const mapLeave = (leave) => {
  const isStudent = leave.type === 'Student';
  const person = isStudent ? leave.student : leave.teacher;

  return {
    id: String(leave._id || ''),
    type: leave.type,
    name: person?.fullName || '',
    personId: isStudent ? (person?.studentId || '') : (person?.teacherId || ''),
    personRef: person?._id ? String(person._id) : '',
    class: leave.class || (person?.class || ''),
    academicYear: leave.academicYear,
    fromDate: leave.fromDate,
    toDate: leave.toDate,
    reason: leave.reason,
    status: leave.status,
    requestedBy: leave.requestedBy?.fullName || '',
    approvedBy: leave.approvedBy?.fullName || '',
    approvedAt: leave.approvedAt || null,
    createdAt: leave.createdAt,
    updatedAt: leave.updatedAt,
  };
};

const POPULATE_PATHS = [
  { path: 'student', select: 'studentId fullName class academicYear' },
  { path: 'teacher', select: 'teacherId fullName academicYear' },
  { path: 'requestedBy', select: 'fullName' },
  { path: 'approvedBy', select: 'fullName' },
];

// Populates a mongoose document (create/update/approve/reject paths) and
// converts it to the same shape used by the list and get-by-id responses.
const populateAndMap = async (doc) => {
  if (!doc) return null;
  const populated = await doc.populate(POPULATE_PATHS);
  return mapLeave(populated.toObject ? populated.toObject() : populated);
};

const buildPersonIdFilter = async (type, search) => {
  if (!search) return null;

  const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  if (type === 'Student') {
    const students = await Student.find({ $or: [{ fullName: pattern }, { studentId: pattern }] })
      .select('_id').lean();
    return { student: { $in: students.map((s) => s._id) } };
  }

  if (type === 'Teacher') {
    const teachers = await Teacher.find({ $or: [{ fullName: pattern }, { teacherId: pattern }] })
      .select('_id').lean();
    return { teacher: { $in: teachers.map((t) => t._id) } };
  }

  const [students, teachers] = await Promise.all([
    Student.find({ $or: [{ fullName: pattern }, { studentId: pattern }] }).select('_id').lean(),
    Teacher.find({ $or: [{ fullName: pattern }, { teacherId: pattern }] }).select('_id').lean(),
  ]);

  return {
    $or: [
      { student: { $in: students.map((s) => s._id) } },
      { teacher: { $in: teachers.map((t) => t._id) } },
    ],
  };
};

const getAllLeaves = async (filters = {}) => {
  const {
    type,
    status,
    academicYear,
    class: classFilter,
    search,
    fromDate,
    toDate,
    page = 1,
    limit = 10,
  } = filters;

  const filter = {};

  if (type) filter.type = type;
  if (status && status !== 'All') filter.status = status;
  if (academicYear) filter.academicYear = academicYear;
  if (classFilter && classFilter !== 'All Classes') filter.class = classFilter;

  // Date-range filter: leaves that overlap the requested range.
  if (fromDate) filter.toDate = { $gte: fromDate };
  if (toDate) filter.fromDate = { $lte: toDate };

  const personFilter = await buildPersonIdFilter(type, search);
  if (personFilter) {
    Object.assign(filter, personFilter);
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
  const skip = (currentPage - 1) * itemsPerPage;

  const [leaves, totalItems] = await Promise.all([
    Leave.find(filter)
      .populate({ path: 'student', select: 'studentId fullName class academicYear' })
      .populate({ path: 'teacher', select: 'teacherId fullName academicYear' })
      .populate({ path: 'requestedBy', select: 'fullName' })
      .populate({ path: 'approvedBy', select: 'fullName' })
      .sort({ fromDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean(),
    Leave.countDocuments(filter),
  ]);

  return {
    leaves: leaves.map(mapLeave),
    pagination: {
      currentPage,
      totalPages: Math.max(1, Math.ceil(totalItems / itemsPerPage)),
      totalItems,
    },
  };
};

const getLeaveById = async (id) => {
  const leave = await Leave.findById(id)
    .populate({ path: 'student', select: 'studentId fullName class academicYear' })
    .populate({ path: 'teacher', select: 'teacherId fullName academicYear' })
    .populate({ path: 'requestedBy', select: 'fullName' })
    .populate({ path: 'approvedBy', select: 'fullName' })
    .lean();

  if (!leave) {
    throw new ApiError(404, 'Leave not found');
  }

  return mapLeave(leave);
};

const updateLeave = async (id, data, userId) => {
  const existing = await Leave.findById(id);
  if (!existing) {
    throw new ApiError(404, 'Leave not found');
  }

  const type = data.type || existing.type;
  const academicYear = data.academicYear || existing.academicYear;
  const fromDate = data.fromDate || existing.fromDate;
  const toDate = data.toDate || existing.toDate;

  const updateData = { ...data };
  delete updateData.status;

  let resolved = null;
  if (data.type || data.student || data.studentId || data.teacher || data.teacherId) {
    resolved = await resolvePerson(type, { ...data, student: data.student, teacher: data.teacher });
    updateData[resolved.field] = resolved.personId;
    // Keep only the person field that matches the current type.
    if (resolved.field === 'student') delete updateData.teacher;
    else delete updateData.student;
  }

  const personForValidation = resolved
    || {
      person: type === 'Student'
        ? await Student.findById(existing.student).lean()
        : await Teacher.findById(existing.teacher).lean(),
      personIdString: '',
    };

  const { person } = personForValidation;
  if (!person) {
    throw new ApiError(404, `${type} no longer exists for this leave`);
  }

  const { from, to } = validatePersonAndDates({
    type,
    person,
    personIdString: personForValidation.personIdString
      || (type === 'Student' ? person.studentId : person.teacherId),
    academicYear,
    fromDate,
    toDate,
  });

  updateData.fromDate = from;
  updateData.toDate = to;

  if (type === 'Student' && !updateData.class) {
    updateData.class = person.class || '';
  }

  const personId = person._id;

  await validateNoOverlap({
    type,
    personId,
    from,
    to,
    excludeId: id,
  });

  if (data.status !== undefined) {
    if (['Approved', 'Rejected'].includes(data.status)) {
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    } else if (data.status === 'Pending') {
      updateData.approvedBy = null;
      updateData.approvedAt = null;
    }
  }

  try {
    const updated = await Leave.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    return await populateAndMap(updated);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      throw new ApiError(400, messages.join('. '));
    }
    throw error;
  }
};

const decideLeave = async (id, status, userId) => {
  const leave = await Leave.findById(id);
  if (!leave) {
    throw new ApiError(404, 'Leave not found');
  }

  if (!VALID_LEAVE_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid leave status. Allowed: ${VALID_LEAVE_STATUSES.join(', ')}`);
  }

  leave.status = status;
  if (['Approved', 'Rejected'].includes(status)) {
    leave.approvedBy = userId;
    leave.approvedAt = new Date();
  }

  // Read before populateAndMap: populating rewrites `leave.student`/`leave.teacher`
  // into full profile documents, which is no longer a usable recipient id.
  const isStudentLeave = leave.type === 'Student';
  const requesterProfileId = isStudentLeave ? leave.student : leave.teacher;

  await leave.save();

  const mapped = await populateAndMap(leave);

  // The decision goes to the actual requester — the profile the leave record
  // points at, never an id taken from the request body.
  if ((status === 'Approved' || status === 'Rejected') && requesterProfileId) {
    const decision = status.toLowerCase();
    await notificationEngine.notify({
      type: status === 'Approved'
        ? NOTIFICATION_TYPES.LEAVE_APPROVED
        : NOTIFICATION_TYPES.LEAVE_REJECTED,
      title: `Leave ${decision}`,
      message: `Your leave request from ${normalizeDateStr(leave.fromDate)} to ${normalizeDateStr(leave.toDate)} has been ${decision} by the administration.`,
      recipient: {
        role: isStudentLeave
          ? NOTIFICATION_RECIPIENT_ROLES.STUDENT
          : NOTIFICATION_RECIPIENT_ROLES.TEACHER,
        profileId: requesterProfileId,
      },
      actor: userId,
      academicYear: leave.academicYear,
      relatedEntity: { model: 'Leave', id: leave._id, label: mapped.personId },
    });
  }

  return mapped;
};

const approveLeave = (id, userId) => decideLeave(id, 'Approved', userId);
const rejectLeave = (id, userId) => decideLeave(id, 'Rejected', userId);

const deleteLeave = async (id) => {
  const leave = await Leave.findById(id);
  if (!leave) {
    throw new ApiError(404, 'Leave not found');
  }

  await Leave.findByIdAndDelete(id);
  return leave;
};

// ─── Attendance integration ───────────────────────────────────────────
// Approved leave is the source of daily "Leave" attendance: attendance
// determines whether a selected Student/Teacher has approved leave for a date.

const checkApprovedLeave = async ({ type, personId, date }) => {
  if (!['Student', 'Teacher'].includes(type)) {
    throw new ApiError(400, 'Leave type must be Student or Teacher');
  }
  if (!personId) {
    throw new ApiError(400, 'personId is required');
  }

  const dateStr = normalizeDateStr(date);
  if (!dateStr) {
    throw new ApiError(400, 'A valid date is required');
  }

  const idField = type === 'Student' ? 'student' : 'teacher';

  let personObjectId = personId;
  if (!mongoose.isValidObjectId(String(personId))) {
    const model = type === 'Student' ? Student : Teacher;
    const field = type === 'Student' ? 'studentId' : 'teacherId';
    const person = await model.findOne({ [field]: String(personId).trim() }).select('_id').lean();
    if (!person) {
      throw new ApiError(404, `${type} not found with ID ${personId}`);
    }
    personObjectId = person._id;
  }

  const leave = await Leave.findOne({
    type,
    status: 'Approved',
    [idField]: personObjectId,
    fromDate: { $lte: dateStr },
    toDate: { $gte: dateStr },
  })
    .select('student teacher class academicYear fromDate toDate reason status')
    .lean();

  return {
    onLeave: !!leave,
    type,
    date: dateStr,
    personId: String(personId),
    leave: leave
      ? {
        id: leave._id.toString(),
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        reason: leave.reason,
        class: leave.class || '',
        academicYear: leave.academicYear,
      }
      : null,
  };
};

// Bulk lookup used by the attendance services: maps personId -> approved leave
// covering the requested date (only Approved leaves count).
const getApprovedLeaveCoverage = async ({ type, personIds, date }) => {
  const dateStr = normalizeDateStr(date);
  if (!dateStr || !Array.isArray(personIds) || personIds.length === 0) {
    return {};
  }

  const idField = type === 'Student' ? 'student' : 'teacher';

  const leaves = await Leave.find({
    type,
    status: 'Approved',
    [idField]: { $in: personIds },
    fromDate: { $lte: dateStr },
    toDate: { $gte: dateStr },
  })
    .select('student teacher fromDate toDate reason')
    .lean();

  const coverage = {};
  leaves.forEach((leave) => {
    const pid = leave[idField] ? leave[idField].toString() : '';
    if (!pid || coverage[pid]) return;
    coverage[pid] = {
      id: leave._id.toString(),
      reason: leave.reason || '',
      fromDate: leave.fromDate,
      toDate: leave.toDate,
    };
  });

  return coverage;
};

export default {
  createLeave,
  getAllLeaves,
  getLeaveById,
  updateLeave,
  approveLeave,
  rejectLeave,
  deleteLeave,
  checkApprovedLeave,
  getApprovedLeaveCoverage,
};