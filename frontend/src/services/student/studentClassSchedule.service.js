import api from '../../api/axios';

/**
 * Student Class Schedule service.
 *
 * Backed by the protected student endpoint:
 *   GET /api/v1/student/class-schedule
 *
 * The server automatically identifies the logged-in student's class from the
 * authenticated session and only ever returns that class's timetable. No
 * class/year selectors exist for students, and reads are the only capability.
 */

const normalizeRow = (row) => ({
  id: row.id,
  type: row.type || 'PERIOD',
  isBreak: Boolean(row.isBreak),
  isScheduled: Boolean(row.isScheduled),
  timeSlotId: row.timeSlotId,
  slotLabel: row.slotLabel || '',
  startTime: row.startTime || '',
  endTime: row.endTime || '',
  subjectId: row.subjectId || null,
  subjectName: row.subjectName || '',
  subjectCode: row.subjectCode || '',
  teacherId: row.teacherId || null,
  teacherFullName: row.teacherFullName || '',
  teacherCode: row.teacherCode || '',
});

/**
 * Fetches the logged-in student's class timetable (own class only,
 * chronological order).
 * @param {{ academicYear?: string }} [params] Optional academic year; only
 *   accepted when real timetable records exist for it.
 */
const getClassSchedule = async (params = {}) => {
  const response = await api.get('/student/class-schedule', { params });
  const data = response.data?.data || {};

  const rows = (data.timetable || []).map(normalizeRow);

  // Safety net: keep rows chronologically ordered by start time.
  rows.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

  return {
    student: data.student || null,
    classInfo: data.class
      ? {
          id: data.class.id,
          className: data.class.className,
          academicYear: data.class.academicYear,
        }
      : null,
    academicYear: data.academicYear || '',
    timetable: rows,
  };
};

export default { getClassSchedule };