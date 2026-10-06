import api from '../../api/axios';

/**
 * Teacher Class Schedule service — the integration point for the Teacher
 * "Class Schedule" page.
 *
 * Resolves the logged-in teacher's OWN real timetable (READ-ONLY) from the
 * protected GET /teacher/class-schedule endpoint. The teacher is always
 * derived from the authenticated session on the backend — there are no
 * teacher/class/subject selectors, and this service never sends one.
 *
 * The Admin Timetable is a single reusable daily grid (no Monday–Sunday
 * axis), so the returned `rows` are the teacher's real saved periods, each
 * appearing exactly once with its Time Slot data (period label, start/end
 * time, PERIOD/BREAK type) and its Class + Subject. Nothing is fabricated or
 * repeated across weekdays.
 *
 * The Academic Year comes from the existing central/default source (School
 * Settings) via the backend; historical years are only returned when real
 * timetable records exist for that teacher. No fake/fallback data.
 */

const EMPTY_SCHEDULE = {
  teacher: { id: '', teacherId: '', fullName: '' },
  academicYear: '',
  rows: [],
};

const getClassSchedule = async () => {
  const response = await api.get('/teacher/class-schedule');

  const data = response.data?.data || {};

  return {
    teacher: data.teacher || EMPTY_SCHEDULE.teacher,
    academicYear: data.academicYear || '',
    // The teacher's real booked periods — one row per saved timetable entry,
    // in chronological order. Breaks carry no class/subject; they only appear
    // when a real saved record points at a BREAK time slot.
    rows: Array.isArray(data.timetable) ? data.timetable : [],
  };
};

const classScheduleService = {
  getClassSchedule,
};

export default classScheduleService;