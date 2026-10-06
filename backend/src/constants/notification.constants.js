// Central vocabulary for the automatic Notification Engine.
//
// Every notification type, recipient role and related-entity model is declared
// here exactly once. Event producers (Students, Fees, Leaves, Homework, Marks,
// Results, Salary, ...) import these constants instead of hard-coding a
// notification string, and the Notification model/service validate against this
// single source of truth.

const NOTIFICATION_TYPES = {
  STUDENT_CREATED: 'STUDENT_CREATED',
  FEE_COLLECTED: 'FEE_COLLECTED',
  LEAVE_REQUESTED: 'LEAVE_REQUESTED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  HOMEWORK_CREATED: 'HOMEWORK_CREATED',
  MARKS_SUBMITTED: 'MARKS_SUBMITTED',
  RESULT_PUBLISHED: 'RESULT_PUBLISHED',
  SALARY_PAYMENT_RECORDED: 'SALARY_PAYMENT_RECORDED',
};

const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

// Human readable names, used by the engine (and by API responses/tests) so a
// notification type is never rendered from a raw constant value.
const NOTIFICATION_TYPE_LABELS = {
  [NOTIFICATION_TYPES.STUDENT_CREATED]: 'Student created',
  [NOTIFICATION_TYPES.FEE_COLLECTED]: 'Fee collected',
  [NOTIFICATION_TYPES.LEAVE_REQUESTED]: 'Leave requested',
  [NOTIFICATION_TYPES.LEAVE_APPROVED]: 'Leave approved',
  [NOTIFICATION_TYPES.LEAVE_REJECTED]: 'Leave rejected',
  [NOTIFICATION_TYPES.HOMEWORK_CREATED]: 'Homework created',
  [NOTIFICATION_TYPES.MARKS_SUBMITTED]: 'Marks submitted',
  [NOTIFICATION_TYPES.RESULT_PUBLISHED]: 'Result published',
  [NOTIFICATION_TYPES.SALARY_PAYMENT_RECORDED]: 'Salary payment recorded',
};

// Where a notification came from. `manual` keeps the existing Admin-authored
// flow, `automatic` is everything the engine produces from a domain event.
const NOTIFICATION_SOURCES = {
  MANUAL: 'manual',
  AUTOMATIC: 'automatic',
};

const NOTIFICATION_SOURCE_VALUES = Object.values(NOTIFICATION_SOURCES);

// A notification is addressed to exactly one principal, never to a list of
// arbitrary user ids supplied by a request.
const NOTIFICATION_RECIPIENT_ROLES = {
  ADMIN: 'admin',
  STUDENT: 'student',
  TEACHER: 'teacher',
};

const NOTIFICATION_RECIPIENT_ROLE_VALUES = Object.values(NOTIFICATION_RECIPIENT_ROLES);

// Collection the recipient's school profile lives in (Admin docs are their own
// profile; portal users point at their Student/Teacher profile).
const NOTIFICATION_RECIPIENT_PROFILE_MODELS = ['Admin', 'Student', 'Teacher'];

// Audience stored on the notification for each targeted recipient role. The
// existing Admin Notifications page renders and filters by audience, so
// engine-created notifications must carry a valid audience too.
const NOTIFICATION_AUDIENCE_BY_RECIPIENT_ROLE = {
  [NOTIFICATION_RECIPIENT_ROLES.ADMIN]: 'All',
  [NOTIFICATION_RECIPIENT_ROLES.STUDENT]: 'Students',
  [NOTIFICATION_RECIPIENT_ROLES.TEACHER]: 'Teachers',
};

// Entities an automatic notification can point back to. Mirrors the mongoose
// model names in backend/src/models.
const NOTIFICATION_RELATED_MODELS = [
  'Student',
  'Teacher',
  'Admin',
  'FeeCollection',
  'Leave',
  'Assignment',
  'Mark',
  'Exam',
  'ExamSchedule',
  'Payroll',
];

// Supported engine fan-outs. A fan-out is always resolved by the engine from
// the database; the caller never supplies the member list.
const NOTIFICATION_FANOUT_TARGETS = {
  ALL_ADMINS: 'all-admins',
};

const NOTIFICATION_FANOUT_VALUES = Object.values(NOTIFICATION_FANOUT_TARGETS);

// MongoDB index keys are length limited, so long deterministic event keys are
// collapsed to a short deterministic hash instead of being truncated (which
// could make two different events collide).
const NOTIFICATION_EVENT_KEY_MAX_LENGTH = 240;

const isNotificationType = (value) => {
  if (value === undefined || value === null) return false;
  return NOTIFICATION_TYPE_VALUES.includes(String(value).trim().toUpperCase());
};

// Returns the canonical constant value, or null when the type is unknown.
const normalizeNotificationType = (value) => {
  if (value === undefined || value === null || !String(value).trim()) return null;
  return String(value).trim().toUpperCase();
};

export {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_VALUES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_SOURCES,
  NOTIFICATION_SOURCE_VALUES,
  NOTIFICATION_RECIPIENT_ROLES,
  NOTIFICATION_RECIPIENT_ROLE_VALUES,
  NOTIFICATION_RECIPIENT_PROFILE_MODELS,
  NOTIFICATION_AUDIENCE_BY_RECIPIENT_ROLE,
  NOTIFICATION_RELATED_MODELS,
  NOTIFICATION_FANOUT_TARGETS,
  NOTIFICATION_FANOUT_VALUES,
  NOTIFICATION_EVENT_KEY_MAX_LENGTH,
  isNotificationType,
  normalizeNotificationType,
};
