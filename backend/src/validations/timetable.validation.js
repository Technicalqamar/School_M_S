import mongoose from 'mongoose';
import { ApiError } from '../utils/apiError.js';

const TIMESLOT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const timeToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const parsePeriods = (raw) => {
  if (!Array.isArray(raw)) throw new ApiError(400, 'periods must be an array');
  if (raw.length === 0) throw new ApiError(400, 'At least one period is required');

  const seenNos = new Set();
  const parsed = [];

  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    const idx = i + 1;

    if (p.periodNo === undefined || p.periodNo === null) {
      throw new ApiError(400, `period[${idx}].periodNo is required`);
    }
    const periodNo = Number(p.periodNo);
    if (!Number.isInteger(periodNo) || periodNo < 1) {
      throw new ApiError(400, `period[${idx}].periodNo must be a positive integer`);
    }
    if (seenNos.has(periodNo)) {
      throw new ApiError(400, `Duplicate period number ${periodNo}`);
    }
    seenNos.add(periodNo);

    if (!p.type) throw new ApiError(400, `period[${idx}].type is required`);
    if (!['teaching', 'break'].includes(p.type)) {
      throw new ApiError(400, `period[${idx}].type must be teaching or break`);
    }

    if (!p.startTime) throw new ApiError(400, `period[${idx}].startTime is required`);
    if (!TIMESLOT_REGEX.test(p.startTime)) {
      throw new ApiError(400, `period[${idx}].startTime must be in HH:mm format`);
    }

    if (!p.endTime) throw new ApiError(400, `period[${idx}].endTime is required`);
    if (!TIMESLOT_REGEX.test(p.endTime)) {
      throw new ApiError(400, `period[${idx}].endTime must be in HH:mm format`);
    }

    const startMin = timeToMinutes(p.startTime);
    const endMin = timeToMinutes(p.endTime);

    if (endMin <= startMin) {
      throw new ApiError(400, `period[${idx}]: endTime must be after startTime`);
    }

    if (p.type === 'teaching') {
      if (!p.teacherId) throw new ApiError(400, `period[${idx}].teacherId is required for teaching periods`);
      if (!mongoose.Types.ObjectId.isValid(p.teacherId)) {
        throw new ApiError(400, `period[${idx}].teacherId must be a valid ObjectId`);
      }
      if (!p.subjectId) throw new ApiError(400, `period[${idx}].subjectId is required for teaching periods`);
      if (!mongoose.Types.ObjectId.isValid(p.subjectId)) {
        throw new ApiError(400, `period[${idx}].subjectId must be a valid ObjectId`);
      }
    }

    if (p.type === 'break') {
      if (p.teacherId) throw new ApiError(400, `period[${idx}]: teacherId must not be provided for break periods`);
      if (p.subjectId) throw new ApiError(400, `period[${idx}]: subjectId must not be provided for break periods`);
    }

    parsed.push({
      periodNo,
      type: p.type,
      startTime: p.startTime,
      endTime: p.endTime,
      teacherId: p.type === 'teaching' ? p.teacherId : null,
      subjectId: p.type === 'teaching' ? p.subjectId : null,
    });
  }

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i];
      const b = parsed[j];
      const aStart = timeToMinutes(a.startTime);
      const aEnd = timeToMinutes(a.endTime);
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);

      if (aStart < bEnd && bStart < aEnd) {
        throw new ApiError(
          400,
          `Period ${a.periodNo} (${a.startTime}-${a.endTime}) overlaps with Period ${b.periodNo} (${b.startTime}-${b.endTime})`,
        );
      }
    }
  }

  parsed.sort((a, b) => a.periodNo - b.periodNo);

  return parsed;
};

const validateTimeField = (value, label) => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!TIMESLOT_REGEX.test(trimmed)) {
    throw new ApiError(400, `${label} must be in HH:mm format`);
  }
  return trimmed;
};

const validateCreateTimetable = (req, res, next) => {
  const { academicYear, classId, periods, periodStartTime, periodEndTime } = req.body;

  if (!academicYear || !academicYear.trim()) {
    throw new ApiError(400, 'Academic year is required');
  }
  req.body.academicYear = academicYear.trim();

  if (!classId) throw new ApiError(400, 'Class is required');
  if (!mongoose.Types.ObjectId.isValid(classId)) {
    throw new ApiError(400, 'Invalid class ID');
  }

  req.body.periods = parsePeriods(periods);
  req.body.periodStartTime = validateTimeField(periodStartTime, 'periodStartTime');
  req.body.periodEndTime = validateTimeField(periodEndTime, 'periodEndTime');

  next();
};

const validateUpdateTimetable = (req, res, next) => {
  const { academicYear, classId, periods, periodStartTime, periodEndTime } = req.body;

  if (!academicYear && !classId && !periods && periodStartTime === undefined && periodEndTime === undefined) {
    throw new ApiError(400, 'At least one field must be provided');
  }

  if (academicYear !== undefined) {
    if (!academicYear.trim()) throw new ApiError(400, 'Academic year cannot be empty');
    req.body.academicYear = academicYear.trim();
  }

  if (classId !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      throw new ApiError(400, 'Invalid class ID');
    }
  }

  if (periods !== undefined) {
    req.body.periods = parsePeriods(periods);
  }

  if (periodStartTime !== undefined) {
    req.body.periodStartTime = validateTimeField(periodStartTime, 'periodStartTime');
  }

  if (periodEndTime !== undefined) {
    req.body.periodEndTime = validateTimeField(periodEndTime, 'periodEndTime');
  }

  next();
};

export { validateCreateTimetable, validateUpdateTimetable };
