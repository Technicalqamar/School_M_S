// Pure helpers for the actions the Single Student Management workspace performs
// on the selected student: marking attendance and assembling the ID card.
//
// They are deliberately framework-free so the exact request body the attendance
// workflow posts, the "is there already a record for this date" lookup and the
// ID card merge can all be unit-tested under the project's existing
// `node --test` setup. The components only render; every business rule
// (weekends, holidays, events, the school time window, "Present" -> "Late",
// edit restrictions) stays on the server, which still re-validates the payload
// these helpers build.

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Late', 'Leave'];

// Local calendar day (YYYY-MM-DD), matching how the project stores/compares
// attendance dates elsewhere. A value that is already a plain `YYYY-MM-DD`
// calendar day is returned unchanged: parsing it via `new Date()` would treat it
// as UTC midnight and could shift it a day in a non-UTC timezone, which would
// make report periods inconsistent. Date objects and full ISO timestamps are
// still resolved through the local calendar day.
export const toDayString = (value) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-CA');
};

// Builds the body for `POST /student-attendance` for exactly one student. The
// class and academic year come from the selected student (never hardcoded) so
// the server can re-check membership, active status and the class/year rules.
// Returns null when the caller has not supplied the minimum fields.
export const buildStudentAttendancePayload = (student, { date, status, remarks = '' } = {}) => {
  if (!student?._id || !date || !status) return null;
  return {
    academicYear: student.academicYear,
    class: student.class,
    date,
    records: [
      {
        student: student._id,
        status,
        method: 'Manual',
        remarks: String(remarks ?? '').trim(),
      },
    ],
  };
};

// The record already stored for `date`, used to avoid a silent duplicate for the
// same student/date (saving updates the existing record instead).
export const findAttendanceForDate = (records, date) => {
  if (!Array.isArray(records) || !date) return null;
  return records.find((record) => toDayString(record?.date) === date) || null;
};

// Merges the selected student with their fetched card record. The selected
// student is always authoritative for identity, so the result can never show a
// different student's name/photo/id even if the fetch returns an unexpected row.
export const buildIdCardStudent = (student, card = null) => {
  if (!student) return null;
  return {
    fullName: student.fullName,
    fatherName: student.fatherName || card?.fatherName || '',
    fatherPhone: student.fatherPhone || card?.fatherPhone || '',
    studentId: student.studentId,
    class: student.class,
    academicYear: student.academicYear,
    studentImage: student.studentImage || card?.studentImage || '',
    qrValue: card?.qrValue || '',
    personType: 'Student',
  };
};

// Finds the card record that belongs to `student` by id, falling back to the
// human student id. Never returns an unrelated student's card.
export const findStudentCard = (cards, student) => {
  if (!Array.isArray(cards) || !student) return null;
  return (
    cards.find((item) => item?._id && item._id === student._id)
    || cards.find((item) => item?.studentId && item.studentId === student.studentId)
    || null
  );
};

// Authoritative card status: the backend's status when present, otherwise
// derived from whether a QR value exists.
export const deriveCardStatus = (card, cardStudent) => {
  if (card?.cardStatus) return card.cardStatus;
  return cardStudent?.qrValue ? 'Generated' : 'Pending';
};

// ── Report period helpers ────────────────────────────────────────────────────
//
// Shared, framework-free helpers for the date-period filters used by the
// per-student Attendance and Fee reports. They only ever *read* the records the
// backend already returned - nothing here writes attendance or payments - and
// they operate on the same local `YYYY-MM-DD` calendar day the rest of the
// project uses, so a period means the same thing in the table, the totals, the
// print view and the PDF export.

export const REPORT_MODES = { MONTH: 'month', CUSTOM: 'custom' };

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad2 = (value) => String(value).padStart(2, '0');

const isDayString = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

// Inclusive first/last calendar day of a month as `YYYY-MM-DD`. `monthIndex` is
// 0-based (0 = January) to match the JS Date API.
export const getMonthRange = (year, monthIndex) => {
  const numericYear = Number(year);
  const numericMonth = Number(monthIndex);
  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth) || numericMonth < 0 || numericMonth > 11) {
    return null;
  }
  const lastDay = new Date(numericYear, numericMonth + 1, 0).getDate();
  return {
    from: `${numericYear}-${pad2(numericMonth + 1)}-01`,
    to: `${numericYear}-${pad2(numericMonth + 1)}-${pad2(lastDay)}`,
  };
};

// Turns the selected report mode into an inclusive `{ from, to }` day range, or
// null when the selection is incomplete/invalid (the caller then shows nothing
// rather than silently falling back to "all records").
export const resolveReportRange = (mode, { year, monthIndex, from, to } = {}) => {
  if (mode === REPORT_MODES.MONTH) {
    return getMonthRange(year, monthIndex);
  }
  if (mode === REPORT_MODES.CUSTOM) {
    if (!isDayString(from) || !isDayString(to)) return null;
    return { from, to };
  }
  return null;
};

// Validates a custom range. Returns a human-readable message, or '' when valid.
export const validateReportRange = (from, to) => {
  if (!isDayString(from) || !isDayString(to)) {
    return 'Select both a start and end date.';
  }
  if (from > to) {
    return 'The start date must be on or before the end date.';
  }
  return '';
};

// Filters records down to the inclusive day range. Records without a usable
// date are dropped (they can never be shown as belonging to a period).
export const filterRecordsByRange = (records, range) => {
  if (!Array.isArray(records)) return [];
  if (!range?.from || !range?.to) return [];
  return records.filter((record) => {
    const day = toDayString(record?.date);
    return day && day >= range.from && day <= range.to;
  });
};

// Human label for the selected period, used on screen and in the report header.
export const buildReportPeriodLabel = (mode, { year, monthIndex, from, to } = {}) => {
  if (mode === REPORT_MODES.MONTH) {
    const numericMonth = Number(monthIndex);
    if (!Number.isInteger(numericMonth) || numericMonth < 0 || numericMonth > 11 || !year) return '';
    return `${MONTH_NAMES[numericMonth]} ${year}`;
  }
  if (mode === REPORT_MODES.CUSTOM) {
    if (!isDayString(from) || !isDayString(to)) return '';
    return `${from} to ${to}`;
  }
  return '';
};

// Counts each attendance status. Unknown statuses are ignored so the totals
// always add up to the number of recognised records in the period.
export const summarizeStatuses = (records) => {
  const counts = { Present: 0, Absent: 0, Late: 0, Leave: 0 };
  if (!Array.isArray(records)) return counts;
  records.forEach((record) => {
    if (counts[record?.status] !== undefined) counts[record.status] += 1;
  });
  return counts;
};

// Years offered by the report year picker: every year present in the records,
// the student's academic year and the current calendar year, newest first.
export const getReportYearOptions = (records, { academicYear, currentYear } = {}) => {
  const years = new Set();
  if (Array.isArray(records)) {
    records.forEach((record) => {
      const day = toDayString(record?.date);
      if (day) years.add(day.slice(0, 4));
      if (record?.academicYear) years.add(String(record.academicYear));
    });
  }
  if (academicYear) years.add(String(academicYear));
  if (currentYear) years.add(String(currentYear));
  return [...years].filter(Boolean).sort((a, b) => b.localeCompare(a));
};

// ── Single-recipient notice helpers ──────────────────────────────────────────
//
// The notice form only composes a payload for exactly one student. The recipient
// is never typed by the user - it is always taken from the selected student's
// own record - and the backend independently re-resolves the student, checks
// they are active and have a linked portal account, and addresses a single
// notification. These helpers keep that intent testable.

export const NOTICE_TYPES = ['General', 'Fee Reminder', 'Attendance Reminder', 'Exam Reminder'];

// Guardian/contact on file for the selected student, or null when the record has
// no usable contact (the form then explains why it cannot send).
export const getStudentNoticeRecipient = (student) => {
  if (!student) return null;
  const guardianName = student.fatherName || '';
  const guardianPhone = student.fatherPhone || student.alternatePhone || '';
  if (!guardianName && !guardianPhone) return null;
  return {
    studentName: student.fullName || '',
    studentId: student.studentId || '',
    className: student.class || '',
    guardianName,
    guardianPhone,
  };
};

// Builds the create-notification request for the selected student only.
// Returns null when there is nothing valid to send, so the caller can block the
// action instead of posting a half-formed message.
export const buildStudentNoticePayload = (student, { type = 'General', title = '', message = '' } = {}) => {
  if (!student?._id) return null;
  const trimmedMessage = String(message ?? '').trim();
  if (!trimmedMessage) return null;
  const trimmedTitle = String(title ?? '').trim();
  const noticeType = NOTICE_TYPES.includes(type) ? type : 'General';
  return {
    type: noticeType,
    title: trimmedTitle || noticeType,
    message: trimmedMessage,
  };
};
