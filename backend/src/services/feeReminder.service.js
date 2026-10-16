import Student from '../models/student.model.js';
import UserAccount from '../models/userAccount.model.js';
import SchoolSettings from '../models/schoolSettings.model.js';
import { ApiError } from '../utils/apiError.js';
import feeOutstandingService from './feeOutstanding.service.js';
import notificationEngine from './notificationEngine.service.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_SOURCES,
} from '../constants/notification.constants.js';
import {
  DEFAULT_FEE_REMINDER_TEMPLATE,
  renderFeeReminderMessage,
  buildFeePeriod,
} from '../utils/feeReminderTemplate.js';
import {
  resolveRequestedClasses,
  getInvalidClassNames,
} from '../utils/feeReminderClasses.js';

// Shared Fee Reminder service.
//
// It is the single implementation behind BOTH the class-wise Fee Reminders page
// and the Single Student "Send Fee Reminder" action, so a student can never be
// reminded two different ways.
//
// Outstanding balances are never read from a stored status: they are recomputed
// from the real fee ledger by the existing `feeOutstanding.service` (fee
// structure minus actual FeeCollection payments, including partial payments and
// fines/discounts). A recipient is only ever reminded when the freshly computed
// balance is still > 0 AND the student has an active portal account, because the
// in-app notification is the only operational delivery channel - there is no
// external SMS/WhatsApp provider wired in, so the server never claims an
// external message was delivered.
//
// A class-wide send is bounded (a class is a naturally small set) and every
// recipient's balance/eligibility is re-validated immediately before the
// reminder is written, so a student who paid in the meantime is skipped.

// Defensive upper bound on one class-wide send. A class never realistically
// reaches this, so it only guards against a malformed/oversized request; there
// is no background-job queue in this project, so the work stays synchronous and
// must therefore stay bounded.
const MAX_REMINDER_RECIPIENTS = 500;

// A requested class must be one the school actually has. Rejecting the whole
// request (rather than dropping the bad entry) keeps the eligible count the
// caller sees identical to what the server will process.
const assertValidClasses = (classes) => {
  const invalid = getInvalidClassNames(classes);
  if (invalid.length) {
    throw new ApiError(400, `Invalid class selection: ${invalid.join(', ')}`);
  }
};

const getCurrentAcademicYear = async () => {
  const settings = await SchoolSettings.getSettings();
  if (settings?.currentAcademicYear && /^\d{4}$/.test(settings.currentAcademicYear)) {
    return settings.currentAcademicYear;
  }
  return String(new Date().getFullYear());
};

const resolveAcademicYear = async (year) => {
  if (year && /^\d{4}$/.test(String(year).trim())) {
    return String(year).trim();
  }
  return getCurrentAcademicYear();
};

const getSchoolName = async () => {
  const settings = await SchoolSettings.getSettings().catch(() => null);
  return settings?.schoolName || '';
};

// Builds the per-recipient context the template is rendered from. Every value
// comes from the server: the client only supplies the template text.
const buildRecipientContext = ({ fullName, studentId, className, outstanding, dues, schoolName }) => ({
  studentName: fullName || '',
  studentId: studentId || '',
  className: className || '',
  outstanding,
  feePeriod: buildFeePeriod(dues || []),
  schoolName: schoolName || '',
});

// Resolves which of the given student object-ids have an active portal account.
const loadPortalAccountSet = async (studentObjectIds) => {
  const ids = studentObjectIds.filter(Boolean);
  if (!ids.length) return new Set();
  const accounts = await UserAccount.find({
    referenceId: { $in: ids },
    referenceModel: 'Student',
    isActive: true,
  }).select('referenceId');
  return new Set(accounts.map((a) => String(a.referenceId)));
};

// Preview of who would receive a reminder for the selected class(es) — one class,
// several classes, or all classes when none is supplied — with an accurate
// eligible count and the fully rendered message each recipient would get.
//
// Only students whose freshly computed outstanding balance is > 0 are eligible,
// so a fully-paid student is never listed or counted. A student can only belong
// to one class, but the list is de-duplicated by student id anyway so overlapping
// or repeated selections can never produce the same recipient twice.
const listFeeReminderRecipients = async ({ classNames, className, academicYear, search } = {}) => {
  const year = await resolveAcademicYear(academicYear);
  const requestedClasses = resolveRequestedClasses({ classNames, className });
  const { entries } = await feeOutstandingService.getOutstandingDues({ academicYear: year });

  let selected = entries;
  if (requestedClasses.length) {
    const classSet = new Set(requestedClasses);
    selected = entries.filter((e) => classSet.has(e.student?.class || e.className));
  }

  // One entry per student, even if a student somehow appears more than once.
  const seenStudentIds = new Set();
  const unique = [];
  for (const entry of selected) {
    const studentId = entry.student?.id || entry.studentId || '';
    if (!studentId || seenStudentIds.has(studentId)) continue;
    seenStudentIds.add(studentId);
    unique.push(entry);
  }

  let eligible = unique;
  if (search) {
    const term = String(search).toLowerCase();
    eligible = unique.filter((e) => {
      const ref = e.student || {};
      return (
        (ref.name || e.studentName || '').toLowerCase().includes(term) ||
        (ref.id || e.studentId || '').toLowerCase().includes(term) ||
        (ref.fatherName || '').toLowerCase().includes(term)
      );
    });
  }

  const [accountSet, schoolName] = await Promise.all([
    loadPortalAccountSet(eligible.map((e) => e.student?._id)),
    getSchoolName(),
  ]);

  const eligibleItems = eligible.filter((e) => Number(e.totalOutstanding || 0) > 0);

  const items = eligibleItems.map((e) => {
    const ref = e.student || {};
    const studentId = ref.id || e.studentId || '';
    const fullName = ref.name || e.studentName || '';
    const context = buildRecipientContext({
      fullName,
      studentId,
      className: ref.class,
      outstanding: e.totalOutstanding || 0,
      dues: e.dues || [],
      schoolName,
    });
    return {
      studentId,
      fullName,
      className: ref.class || '',
      totalOutstanding: e.totalOutstanding || 0,
      hasPortalAccount: ref._id ? accountSet.has(String(ref._id)) : false,
      dues: e.dues || [],
      context,
      preview: renderFeeReminderMessage(DEFAULT_FEE_REMINDER_TEMPLATE, context),
    };
  });

  return {
    academicYear: year,
    classNames: requestedClasses,
    className: requestedClasses.length === 1 ? requestedClasses[0] : null,
    defaultTemplate: DEFAULT_FEE_REMINDER_TEMPLATE,
    eligible: items,
  };
};

// One student's live reminder context for the Single Student Fees page.
const getStudentReminderContext = async (studentId) => {
  const student = await Student.findOne({ studentId });
  if (!student) throw new ApiError(404, 'Student not found');

  const year = await getCurrentAcademicYear();
  const [duesResult, schoolName] = await Promise.all([
    feeOutstandingService.getStudentOutstandingDues(student._id, year).catch(() => null),
    getSchoolName(),
  ]);
  const totalOutstanding = duesResult?.totalOutstanding || 0;

  const account = await UserAccount.findOne({
    referenceId: student._id,
    referenceModel: 'Student',
    isActive: true,
  }).select('_id');

  const context = buildRecipientContext({
    fullName: student.fullName,
    studentId: student.studentId,
    className: student.class,
    outstanding: totalOutstanding,
    dues: duesResult?.dues || [],
    schoolName,
  });

  return {
    studentId: student.studentId,
    fullName: student.fullName,
    className: student.class,
    academicYear: year,
    totalOutstanding,
    hasPortalAccount: Boolean(account),
    dues: duesResult?.dues || [],
    context,
    defaultTemplate: DEFAULT_FEE_REMINDER_TEMPLATE,
    preview: renderFeeReminderMessage(DEFAULT_FEE_REMINDER_TEMPLATE, context),
  };
};

// Writes exactly one reminder to one student's portal inbox, re-validating the
// student's balance and account server-side first.
const writeStudentReminder = async ({ student, year, messageTemplate, message, actor }) => {
  const duesResult = await feeOutstandingService
    .getStudentOutstandingDues(student._id, year)
    .catch(() => null);
  const totalOutstanding = duesResult?.totalOutstanding || 0;
  if (totalOutstanding <= 0) {
    throw new ApiError(400, 'No outstanding dues found for this student');
  }

  const account = await UserAccount.findOne({
    referenceId: student._id,
    referenceModel: 'Student',
    isActive: true,
  }).select('_id');
  if (!account) {
    throw new ApiError(400, 'This student has no active portal account, so a reminder cannot be delivered');
  }

  const context = buildRecipientContext({
    fullName: student.fullName,
    studentId: student.studentId,
    className: student.class,
    outstanding: totalOutstanding,
    dues: duesResult?.dues || [],
    schoolName: await getSchoolName(),
  });

  const finalMessage = messageTemplate
    ? renderFeeReminderMessage(messageTemplate, context)
    : message
      ? String(message).trim()
      : renderFeeReminderMessage(DEFAULT_FEE_REMINDER_TEMPLATE, context);
  if (!finalMessage) throw new ApiError(400, 'Message is required');

  const { notification, created } = await notificationEngine.createNotification({
    type: NOTIFICATION_TYPES.FEE_REMINDER,
    title: 'Fee Reminder',
    message: finalMessage,
    // Single, server-resolved recipient. No audience/class names are supplied,
    // so this can never fan out to a class or the whole school.
    recipient: { role: 'student', profileId: student._id },
    actor,
    dedupe: false,
    source: NOTIFICATION_SOURCES.MANUAL,
    academicYear: year,
    relatedEntity: { model: 'Student', id: student._id },
  });

  return { notification, created, student, totalOutstanding };
};

const sendStudentFeeReminder = async (studentId, { message, messageTemplate } = {}, actor) => {
  const student = await Student.findOne({ studentId });
  if (!student) throw new ApiError(404, 'Student not found');
  if (student.status && student.status !== 'Active') {
    throw new ApiError(400, 'This student is inactive. Reactivate the student before sending a reminder.');
  }

  const year = await getCurrentAcademicYear();
  return writeStudentReminder({ student, year, messageTemplate, message, actor });
};

// Class-wise send for one or more classes. The requested classes are validated
// against the real class list, then every recipient's balance/portal account is
// re-validated immediately before the reminder is written. Recipients are
// de-duplicated so the same student is never reminded twice in one send.
const sendFeeReminders = async (
  { classNames, className, academicYear, messageTemplate, message } = {},
  actor,
) => {
  const requestedClasses = resolveRequestedClasses({ classNames, className });
  if (!requestedClasses.length) throw new ApiError(400, 'At least one class is required');
  assertValidClasses(requestedClasses);

  const year = await resolveAcademicYear(academicYear);
  const { eligible } = await listFeeReminderRecipients({
    classNames: requestedClasses,
    academicYear: year,
  });

  if (eligible.length > MAX_REMINDER_RECIPIENTS) {
    throw new ApiError(
      400,
      `Too many recipients (${eligible.length}). Narrow the selection before sending reminders.`,
    );
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const results = [];
  const processedStudentIds = new Set();

  for (const item of eligible) {
    // Defensive de-duplication: a student is reminded at most once per send even
    // if the same class was requested twice or a student id repeated.
    if (!item.studentId || processedStudentIds.has(item.studentId)) continue;
    processedStudentIds.add(item.studentId);

    try {
      const student = await Student.findOne({ studentId: item.studentId });
      if (!student) {
        failed++;
        results.push({ studentId: item.studentId, status: 'failed', reason: 'Student not found' });
        continue;
      }
      await writeStudentReminder({ student, year, messageTemplate, message, actor });
      sent++;
      results.push({ studentId: item.studentId, status: 'sent' });
    } catch (err) {
      // A missing balance/account at send time is a legitimate "skip", not a
      // failure: the student simply no longer needs (or can receive) a reminder.
      const isSkip = err?.statusCode === 400;
      if (isSkip) {
        skipped++;
        results.push({ studentId: item.studentId, status: 'skipped', reason: err.message });
      } else {
        failed++;
        results.push({ studentId: item.studentId, status: 'failed', reason: err?.message });
      }
    }
  }

  return { sent, skipped, failed, results, eligibleCount: eligible.length, classNames: requestedClasses };
};

export default {
  listFeeReminderRecipients,
  getStudentReminderContext,
  sendFeeReminders,
  sendStudentFeeReminder,
  DEFAULT_FEE_REMINDER_TEMPLATE,
  renderFeeReminderMessage,
};
