export const TYPE_OPTIONS = ['Teaching', 'Break'];

export const timeToMinutes = (t) => {
  if (!t) return -1;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const validatePeriodTimes = (periods, windowStart, windowEnd) => {
  const errors = {};
  if (!periods || periods.length === 0) return errors;

  const startWindowM = windowStart ? timeToMinutes(windowStart) : -1;
  const endWindowM = windowEnd ? timeToMinutes(windowEnd) : -1;
  const timeSlots = [];

  periods.forEach((p) => {
    const row = {};

    if (!p.startTime || !p.endTime) {
      errors[p.id] = row;
      return;
    }

    const startM = timeToMinutes(p.startTime);
    const endM = timeToMinutes(p.endTime);

    if (endM <= startM) {
      row.timeOverlap = 'End time must be after start time.';
    } else if (endWindowM >= 0 && endM > endWindowM) {
      row.endTime = 'Period cannot end after timetable end time.';
    }

    if (!row.timeOverlap && !row.endTime && startWindowM >= 0 && startM < startWindowM) {
      row.startTime = 'Period cannot start before timetable start time.';
    }

    if (endM > startM) {
      for (const slot of timeSlots) {
        if (startM < slot.endM && endM > slot.startM) {
          row.timeOverlap = 'This period overlaps with another period.';
          if (!errors[slot.id]) errors[slot.id] = {};
          errors[slot.id].timeOverlap = 'This period overlaps with another period.';
          break;
        }
      }
      timeSlots.push({ id: p.id, startM, endM });
    }

    if (Object.keys(row).length > 0) {
      errors[p.id] = row;
    }
  });

  return errors;
};

export const validatePeriods = (periods, windowStart, windowEnd) => {
  const fieldErrors = validatePeriodTimes(periods, windowStart, windowEnd);

  periods.forEach((p) => {
    if (p.type === 'Teaching') {
      const row = fieldErrors[p.id] || {};
      let updated = false;
      if (!p.teacher) { row.teacher = 'Teacher required'; updated = true; }
      if (!p.subject) { row.subject = 'Subject required'; updated = true; }
      if (updated) fieldErrors[p.id] = row;
    }
  });

  return fieldErrors;
};

export const isTimetableFormValid = (academicYear, selectedClass, periods, fieldErrors) => {
  if (!academicYear || !selectedClass) return false;
  if (!periods || periods.length === 0) return false;
  return Object.keys(fieldErrors).length === 0;
};

export const getFirstError = (fieldErrors) => {
  const firstRow = Object.values(fieldErrors)[0];
  if (!firstRow) return null;
  return Object.values(firstRow)[0];
};

export const hasOverlapError = (fieldErrors) => {
  return Object.values(fieldErrors).some((row) => row.timeOverlap);
};
