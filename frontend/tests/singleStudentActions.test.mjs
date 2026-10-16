// Focused tests for the Single Student Management action helpers: the exact
// attendance-marking request body, the "already recorded for this date" lookup
// that prevents silent duplicates, and the ID card merge that must never show a
// different student's data. The module is framework-free, so it runs under the
// project's existing `node --test` setup (no new test framework, no jsdom).

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  ATTENDANCE_STATUSES,
  toDayString,
  buildStudentAttendancePayload,
  findAttendanceForDate,
  buildIdCardStudent,
  findStudentCard,
  deriveCardStatus,
  REPORT_MODES,
  MONTH_NAMES,
  getMonthRange,
  resolveReportRange,
  validateReportRange,
  filterRecordsByRange,
  buildReportPeriodLabel,
  summarizeStatuses,
  getReportYearOptions,
  NOTICE_TYPES,
  getStudentNoticeRecipient,
  buildStudentNoticePayload,
} = await import('../src/utils/singleStudentActions.js');

const student = {
  _id: '507f1f77bcf86cd799439011',
  studentId: 'STU-0001',
  fullName: 'Ayesha Khan',
  fatherName: 'Imran Khan',
  fatherPhone: '0300-1234567',
  class: 'Class 4',
  academicYear: '2026',
  studentImage: 'uploads/students/ayesha.png',
};

test('toDayString renders a local calendar day and tolerates bad input', () => {
  assert.equal(toDayString(new Date(2025, 2, 4, 10, 30)), '2025-03-04');
  assert.equal(toDayString('2025-03-04T00:00:00'), '2025-03-04');
  assert.equal(toDayString(null), '');
  assert.equal(toDayString('not-a-date'), '');
});

test('buildStudentAttendancePayload builds one Manual record from the selected student', () => {
  const payload = buildStudentAttendancePayload(student, {
    date: '2025-03-04',
    status: 'Present',
    remarks: '  arrived early  ',
  });

  assert.deepEqual(payload, {
    academicYear: '2026',
    class: 'Class 4',
    date: '2025-03-04',
    records: [
      {
        student: '507f1f77bcf86cd799439011',
        status: 'Present',
        method: 'Manual',
        remarks: 'arrived early',
      },
    ],
  });
});

test('buildStudentAttendancePayload returns null without the minimum fields', () => {
  assert.equal(buildStudentAttendancePayload(null, { date: '2025-03-04', status: 'Present' }), null);
  assert.equal(buildStudentAttendancePayload(student, { status: 'Present' }), null);
  assert.equal(buildStudentAttendancePayload(student, { date: '2025-03-04' }), null);
});

test('buildStudentAttendancePayload only ever carries this student', () => {
  const payload = buildStudentAttendancePayload(student, { date: '2025-03-04', status: 'Leave' });
  assert.equal(payload.records.length, 1);
  assert.equal(payload.records[0].student, student._id);
  assert.equal(payload.records[0].status, 'Leave');
  assert.equal(payload.records[0].remarks, '');
});

test('ATTENDANCE_STATUSES matches the server status vocabulary', () => {
  assert.deepEqual(ATTENDANCE_STATUSES, ['Present', 'Absent', 'Late', 'Leave']);
});

test('findAttendanceForDate matches on the calendar day regardless of time', () => {
  const records = [
    { date: new Date(2025, 2, 3, 9, 0), status: 'Absent' },
    { date: new Date(2025, 2, 4, 23, 45), status: 'Present' },
  ];
  assert.equal(findAttendanceForDate(records, '2025-03-04').status, 'Present');
  assert.equal(findAttendanceForDate(records, '2025-03-05'), null);
  assert.equal(findAttendanceForDate(null, '2025-03-04'), null);
  assert.equal(findAttendanceForDate(records, ''), null);
});

test('buildIdCardStudent keeps the selected student authoritative for identity', () => {
  const card = {
    _id: student._id,
    studentId: student.studentId,
    fullName: 'Someone Else',
    fatherName: 'Card Father',
    fatherPhone: '111',
    studentImage: 'card/image.png',
    qrValue: 'QR-STU-0001',
  };

  const merged = buildIdCardStudent(student, card);
  assert.equal(merged.fullName, 'Ayesha Khan'); // never the fetched row's name
  assert.equal(merged.studentId, 'STU-0001');
  assert.equal(merged.class, 'Class 4');
  assert.equal(merged.academicYear, '2026');
  assert.equal(merged.qrValue, 'QR-STU-0001'); // from the card
  assert.equal(merged.studentImage, 'uploads/students/ayesha.png'); // student wins
  assert.equal(merged.fatherName, 'Imran Khan');
  assert.equal(merged.personType, 'Student');
});

test('buildIdCardStudent falls back to the card and handles a missing card', () => {
  const bare = { _id: student._id, studentId: student.studentId, fullName: 'Ayesha Khan', class: 'Class 4', academicYear: '2026' };
  const withCard = buildIdCardStudent(bare, { fatherName: 'From Card', fatherPhone: '999', studentImage: 'c.png', qrValue: 'QR-1' });
  assert.equal(withCard.fatherName, 'From Card');
  assert.equal(withCard.fatherPhone, '999');
  assert.equal(withCard.studentImage, 'c.png');
  assert.equal(withCard.qrValue, 'QR-1');

  const noCard = buildIdCardStudent(bare, null);
  assert.equal(noCard.qrValue, '');
  assert.equal(noCard.fatherName, '');
  assert.equal(buildIdCardStudent(null, null), null);
});

test('findStudentCard matches by id then student id, and never mismatches', () => {
  const cards = [
    { _id: 'a', studentId: 'STU-0009', fullName: 'Other' },
    { _id: student._id, studentId: 'STU-0001', fullName: 'Ayesha' },
  ];
  assert.equal(findStudentCard(cards, student)._id, student._id);
  assert.equal(findStudentCard(cards, { _id: 'zzz', studentId: 'STU-0009' }).fullName, 'Other');
  assert.equal(findStudentCard(cards, { _id: 'zzz', studentId: 'STU-9999' }), null);
  assert.equal(findStudentCard(null, student), null);
});

test('deriveCardStatus prefers the server status and derives otherwise', () => {
  assert.equal(deriveCardStatus({ cardStatus: 'Printed' }, { qrValue: 'x' }), 'Printed');
  assert.equal(deriveCardStatus(null, { qrValue: 'x' }), 'Generated');
  assert.equal(deriveCardStatus(null, { qrValue: '' }), 'Pending');
  assert.equal(deriveCardStatus(null, null), 'Pending');
});

// ── Report period helpers (attendance + fee date filters) ────────────────────

test('getMonthRange returns the inclusive first/last day of a month', () => {
  assert.deepEqual(getMonthRange(2025, 1), { from: '2025-02-01', to: '2025-02-28' });
  assert.deepEqual(getMonthRange(2024, 1), { from: '2024-02-01', to: '2024-02-29' }); // leap year
  assert.deepEqual(getMonthRange('2025', '11'), { from: '2025-12-01', to: '2025-12-31' });
  assert.equal(getMonthRange(2025, 12), null);
  assert.equal(getMonthRange(2025, -1), null);
});

test('resolveReportRange resolves month and custom modes, and rejects incomplete input', () => {
  assert.deepEqual(
    resolveReportRange(REPORT_MODES.MONTH, { year: '2025', monthIndex: 2 }),
    { from: '2025-03-01', to: '2025-03-31' },
  );
  assert.deepEqual(
    resolveReportRange(REPORT_MODES.CUSTOM, { from: '2025-01-01', to: '2025-01-31' }),
    { from: '2025-01-01', to: '2025-01-31' },
  );
  assert.equal(resolveReportRange(REPORT_MODES.CUSTOM, { from: '2025-01-01' }), null);
  assert.equal(resolveReportRange(REPORT_MODES.CUSTOM, { from: 'nope', to: '2025-01-31' }), null);
  assert.equal(resolveReportRange('unknown', {}), null);
});

test('validateReportRange flags missing and inverted ranges', () => {
  assert.equal(validateReportRange('2025-01-01', '2025-01-31'), '');
  assert.equal(validateReportRange('2025-01-31', '2025-01-01'), 'The start date must be on or before the end date.');
  assert.match(validateReportRange('', '2025-01-31'), /Select both/);
});

test('filterRecordsByRange keeps only records inside the inclusive range', () => {
  const records = [
    { date: new Date(2025, 0, 1), status: 'Present' },
    { date: '2025-01-15T09:00:00', status: 'Absent' },
    { date: '2025-01-31', status: 'Late' },
    { date: '2025-02-01', status: 'Present' },
    { date: 'not-a-date', status: 'Present' },
  ];

  const jan = filterRecordsByRange(records, { from: '2025-01-01', to: '2025-01-31' });
  assert.deepEqual(jan.map((r) => r.status), ['Present', 'Absent', 'Late']);

  assert.deepEqual(filterRecordsByRange(records, null), []);
  assert.deepEqual(filterRecordsByRange(null, { from: '2025-01-01', to: '2025-01-31' }), []);
});

test('buildReportPeriodLabel renders month and custom labels', () => {
  assert.equal(buildReportPeriodLabel(REPORT_MODES.MONTH, { year: '2025', monthIndex: 0 }), `January 2025`);
  assert.equal(buildReportPeriodLabel(REPORT_MODES.CUSTOM, { from: '2025-01-01', to: '2025-01-31' }), '2025-01-01 to 2025-01-31');
  assert.equal(buildReportPeriodLabel('all', {}), '');
  assert.equal(buildReportPeriodLabel(REPORT_MODES.MONTH, { year: '', monthIndex: 0 }), '');
});

test('summarizeStatuses counts recognised statuses only', () => {
  const stats = summarizeStatuses([
    { status: 'Present' }, { status: 'Present' }, { status: 'Late' }, { status: 'Unknown' },
  ]);
  assert.deepEqual(stats, { Present: 2, Absent: 0, Late: 1, Leave: 0 });
  assert.deepEqual(summarizeStatuses(null), { Present: 0, Absent: 0, Late: 0, Leave: 0 });
});

test('getReportYearOptions unions record years, academic year and current year', () => {
  const years = getReportYearOptions(
    [{ date: '2024-05-01' }, { date: '2025-01-01' }, { academicYear: '2026' }],
    { academicYear: '2026', currentYear: '2026' },
  );
  assert.deepEqual(years, ['2026', '2025', '2024']);
  assert.equal(MONTH_NAMES.length, 12);
});

// ── Single-recipient notice helpers ──────────────────────────────────────────

test('getStudentNoticeRecipient returns the selected student and guardian only', () => {
  const recipient = getStudentNoticeRecipient(student);
  assert.equal(recipient.studentName, 'Ayesha Khan');
  assert.equal(recipient.studentId, 'STU-0001');
  assert.equal(recipient.className, 'Class 4');
  assert.equal(recipient.guardianName, 'Imran Khan');
  assert.equal(recipient.guardianPhone, '0300-1234567');

  assert.equal(getStudentNoticeRecipient({ fullName: 'No Contact' }), null);
  assert.equal(getStudentNoticeRecipient(null), null);
});

test('buildStudentNoticePayload targets only the selected student and rejects empty messages', () => {
  const payload = buildStudentNoticePayload(student, { type: 'Fee Reminder', title: '  ', message: '  Please clear dues.  ' });
  assert.deepEqual(payload, { type: 'Fee Reminder', title: 'Fee Reminder', message: 'Please clear dues.' });
  // no recipient/studentId/audience fields ever leak into the request body
  assert.equal('studentId' in payload, false);
  assert.equal('recipient' in payload, false);
  assert.equal('audience' in payload, false);

  assert.equal(buildStudentNoticePayload(student, { message: '   ' }), null);
  assert.equal(buildStudentNoticePayload(null, { message: 'hi' }), null);
  // unknown types fall back to General rather than being passed through
  assert.equal(buildStudentNoticePayload(student, { type: 'Hack', message: 'x' }).type, 'General');
  assert.deepEqual(NOTICE_TYPES, ['General', 'Fee Reminder', 'Attendance Reminder', 'Exam Reminder']);
});
