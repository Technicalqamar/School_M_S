/**
 * Notification Bell deep links.
 *
 * Clicking a notification in the Bell should take the reader to the page that
 * actually owns the event, so every target below is an EXISTING route declared
 * in App.jsx. No route is invented here: when a notification's module has no
 * route the current user can open (for example a teacher's salary payment - the
 * Teacher Panel has no payroll page yet), the resolver returns the reader's own
 * Notifications page instead of a dead link.
 *
 * Resolution is purely a function of (scope, notification type, related entity),
 * so the same notification resolves to a different existing page in each portal
 * - an Admin "Fee collected" opens Fee Management, a student's opens their Fees
 * page. `ProtectedRoute` still guards every destination, and the server already
 * scopes the inbox to the signed-in principal, so a link can only ever point at
 * something that reader is allowed to see.
 */

// Which portal's routes a notification is being resolved for.
export const NOTIFICATION_LINK_SCOPES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  // An Administrator looking at a student's portal reads the selected student's
  // inbox, so the same notifications have to resolve to /portal/access/*.
  PORTAL_ACCESS: 'portal-access',
};

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

// relatedEntity.id arrives as a plain string over JSON. A populated sub-document
// is tolerated too, so a malformed value can never produce a broken URL.
const relatedEntityId = (notification) => {
  const raw = notification?.relatedEntity?.id;
  const candidate =
    raw && typeof raw === 'object' ? (raw._id ?? raw.id ?? null) : raw;
  if (candidate === undefined || candidate === null) return null;
  const id = String(candidate);
  return OBJECT_ID_PATTERN.test(id) ? id : null;
};

// Student-facing events are identical for the Student Portal and for Portal
// Access, only the base path differs.
const portalTargets = (base) => ({
  // Leave requests are submitted from the Attendance page in both portals.
  LEAVE_REQUESTED: () => `${base}/attendance`,
  LEAVE_APPROVED: () => `${base}/attendance`,
  LEAVE_REJECTED: () => `${base}/attendance`,
  // The Assignment detail page is a real route, so the homework notification can
  // open the assignment itself; without a usable id it falls back to the list.
  HOMEWORK_CREATED: ({ relatedId }) => (relatedId ? `${base}/homework/${relatedId}` : `${base}/homework`),
  MARKS_SUBMITTED: () => `${base}/examination`,
  RESULT_PUBLISHED: () => `${base}/examination`,
  FEE_COLLECTED: () => `${base}/fees`,
});

const ADMIN_TARGETS = {
  // Student Management, opened straight on the new student's own profile.
  STUDENT_CREATED: ({ relatedId }) => (relatedId ? `/admin/students/${relatedId}` : '/admin/students'),
  FEE_COLLECTED: () => '/admin/fees/collect-fee',
  // Leave Management is the "Leave" tab of the existing Admin Attendance page.
  LEAVE_REQUESTED: () => '/admin/attendance',
  LEAVE_APPROVED: () => '/admin/attendance',
  LEAVE_REJECTED: () => '/admin/attendance',
  MARKS_SUBMITTED: () => '/admin/exams/marks-entry',
  RESULT_PUBLISHED: () => '/admin/exams/results',
  SALARY_PAYMENT_RECORDED: () => '/admin/payroll',
  // There is no Admin homework module, so this lands on the notification itself.
  HOMEWORK_CREATED: () => null,
};

const TEACHER_TARGETS = {
  LEAVE_REQUESTED: () => '/teacher/dashboard/attendance',
  LEAVE_APPROVED: () => '/teacher/dashboard/attendance',
  LEAVE_REJECTED: () => '/teacher/dashboard/attendance',
  HOMEWORK_CREATED: () => '/teacher/dashboard/homework',
  MARKS_SUBMITTED: () => '/teacher/dashboard/marks-entry',
  RESULT_PUBLISHED: () => '/teacher/dashboard/my-results',
  // No teacher-facing salary/payroll route exists yet: deliberately unresolved
  // so the teacher stays on their own Notifications page instead of a dead link.
  SALARY_PAYMENT_RECORDED: () => null,
  // Teachers are not fee recipients and never receive these two.
  STUDENT_CREATED: () => null,
  FEE_COLLECTED: () => null,
};

const TARGETS = {
  [NOTIFICATION_LINK_SCOPES.ADMIN]: ADMIN_TARGETS,
  [NOTIFICATION_LINK_SCOPES.TEACHER]: TEACHER_TARGETS,
  [NOTIFICATION_LINK_SCOPES.STUDENT]: portalTargets('/student/dashboard'),
  [NOTIFICATION_LINK_SCOPES.PORTAL_ACCESS]: portalTargets('/portal/access'),
};

// Where a reader ends up when nothing better exists - always their own existing
// Notifications page, never a route that does not exist.
const FALLBACK_PATHS = {
  [NOTIFICATION_LINK_SCOPES.ADMIN]: '/admin/communication/notifications',
  [NOTIFICATION_LINK_SCOPES.TEACHER]: '/teacher/dashboard/notifications',
  [NOTIFICATION_LINK_SCOPES.STUDENT]: '/student/dashboard/notifications',
  [NOTIFICATION_LINK_SCOPES.PORTAL_ACCESS]: '/portal/access/notifications',
};

/** The reader's own Notifications page for a scope. */
export const notificationFallbackPath = (scope) =>
  FALLBACK_PATHS[scope] || FALLBACK_PATHS[NOTIFICATION_LINK_SCOPES.STUDENT];

/**
 * Resolves the existing page a notification belongs to.
 *
 * @param {object} notification - a notification from the bell (only `type` and
 *   `relatedEntity.id` are consulted; everything else is ignored).
 * @param {string} scope - one of NOTIFICATION_LINK_SCOPES.
 * @returns {string} an existing in-app route. Never empty.
 */
export const resolveNotificationLink = (notification, scope) => {
  const targets = TARGETS[scope];
  if (!targets) return notificationFallbackPath(scope);

  const type = notification?.type ? String(notification.type).trim().toUpperCase() : '';
  const resolve = type ? targets[type] : null;
  if (!resolve) return notificationFallbackPath(scope);

  const path = resolve({ relatedId: relatedEntityId(notification) });
  return path || notificationFallbackPath(scope);
};

export default resolveNotificationLink;