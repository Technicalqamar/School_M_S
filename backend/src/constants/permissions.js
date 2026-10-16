// Central catalogue of Receptionist permissions.
//
// A stored permission is one of three shapes:
//   `module:<moduleKey>`               -> grants the whole Admin module
//   `page:<moduleKey>:<pageKey>`       -> grants one sub-page of a module
//   `action:<moduleKey>:<actionKey>`   -> grants one operation of a module
//
// The module list below is the **exact Admin sidebar inventory** (Dashboard,
// "Student Management", ..., "School Settings"), using the same display names
// the Admin sees. Sub-pages mirror the collapsible sidebar entries AND the
// internal tabs of each module. This single catalogue drives backend
// validation, backend enforcement (`requireModuleAccess` /
// `requireActionAccess`) and the Admin permission editor in the frontend, so
// the three can never drift apart.
//
// Granularity model:
//   * a module with no pages and no actions is grantable only as a whole
//     (`module:<key>`);
//   * a page-level module (Exam, Fee, Timetable, Payroll, User Accounts) is
//     grantable per-page: `page:<module>:<page>` grants exactly that route
//     surface;
//   * modules with actions can be granted as a whole, per-page or per-action.
//     An action lists `impliedByPages`: granting one of those pages implies the
//     action (used by `hasActionAccess`). A page grant never implies an action
//     outside its own list, so e.g. "All Students" implies only viewing
//     students — never adding, editing, deleting or promoting.
//
// Admin-only modules (e.g. the new "Receptionist Management" module itself) are
// deliberately NOT in this catalogue: a Receptionist can never be granted
// administrative capabilities.
//
// Old `module.action` style keys (e.g. `students.view`) from the previous
// portal-based model are no longer valid: `sanitizePermissions` drops them and
// `isValidPermission` rejects them, so stale/legacy grants can never widen
// access. The `module:` / `page:` keys keep their original meaning, so existing
// stored grants remain valid.

const RECEPTIONIST_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    pages: [],
  },
  {
    key: 'student-management',
    label: 'Student Management',
    pages: [
      {
        key: 'all-students',
        label: 'All Students',
        actions: [
          { key: 'student-view', label: 'View students', impliedByPages: ['all-students'] },
          { key: 'student-edit', label: 'Edit students', impliedByPages: [] },
          { key: 'student-delete', label: 'Delete students', impliedByPages: [] },
        ],
      },
      {
        key: 'add-student',
        label: 'Add Student',
        actions: [
          { key: 'student-create', label: 'Add students', impliedByPages: ['add-student'] },
        ],
      },
      {
        key: 'student-promotion',
        label: 'Student Promotion',
        actions: [
          { key: 'student-promote', label: 'Promote students', impliedByPages: ['student-promotion'] },
        ],
      },
      { key: 'promotion-history', label: 'Promotion History', actions: [] },
    ],
  },
  {
    key: 'teacher-management',
    label: 'Teacher Management',
    pages: [
      {
        key: 'all-teachers',
        label: 'All Teachers',
        actions: [
          { key: 'teacher-view', label: 'View teachers', impliedByPages: ['all-teachers'] },
          { key: 'teacher-edit', label: 'Edit teachers', impliedByPages: [] },
          { key: 'teacher-delete', label: 'Delete teachers', impliedByPages: [] },
        ],
      },
      {
        key: 'add-teacher',
        label: 'Add Teacher',
        actions: [
          { key: 'teacher-create', label: 'Add teachers', impliedByPages: ['add-teacher'] },
        ],
      },
    ],
  },
  {
    key: 'class-management',
    label: 'Class Management',
    pages: [
      {
        key: 'all-classes',
        label: 'All Classes',
        actions: [
          { key: 'class-view', label: 'View classes', impliedByPages: ['all-classes', 'class-details'] },
          { key: 'class-edit', label: 'Edit classes', impliedByPages: [] },
          { key: 'class-delete', label: 'Delete classes', impliedByPages: [] },
        ],
      },
      {
        key: 'add-class',
        label: 'Add Class',
        actions: [
          { key: 'class-create', label: 'Add classes', impliedByPages: ['add-class'] },
        ],
      },
      { key: 'class-details', label: 'Class Details', actions: [] },
    ],
  },
  {
    key: 'subject-management',
    label: 'Subject Management',
    pages: [
      {
        key: 'all-subjects',
        label: 'All Subjects',
        actions: [
          { key: 'subject-view', label: 'View subjects', impliedByPages: ['all-subjects'] },
          { key: 'subject-edit', label: 'Edit subjects', impliedByPages: [] },
          { key: 'subject-delete', label: 'Delete subjects', impliedByPages: [] },
        ],
      },
      {
        key: 'add-subject',
        label: 'Add Subject',
        actions: [
          { key: 'subject-create', label: 'Add subjects', impliedByPages: ['add-subject'] },
        ],
      },
      {
        key: 'class-subject-assignment',
        label: 'Class Subject Assignment',
        actions: [
          { key: 'subject-assign', label: 'Assign subjects to classes', impliedByPages: ['class-subject-assignment'] },
        ],
      },
    ],
  },
  {
    key: 'timetable-management',
    label: 'Timetable',
    pages: [
      { key: 'create-timetable', label: 'Create Timetable', actions: [] },
      { key: 'designer', label: 'Designer', actions: [] },
      { key: 'time-slots', label: 'Time Slots', actions: [] },
    ],
  },
  {
    key: 'attendance-management',
    label: 'Attendance Management',
    pages: [
      {
        key: 'student-attendance',
        label: 'Student Attendance',
        actions: [
          { key: 'student-attendance-view', label: 'View student attendance', impliedByPages: ['student-attendance'] },
          { key: 'student-attendance-mark', label: 'Mark student attendance', impliedByPages: ['student-attendance'] },
        ],
      },
      {
        key: 'teacher-attendance',
        label: 'Teacher Attendance',
        actions: [
          { key: 'teacher-attendance-view', label: 'View teacher attendance', impliedByPages: ['teacher-attendance'] },
          { key: 'teacher-attendance-mark', label: 'Mark teacher attendance', impliedByPages: ['teacher-attendance'] },
        ],
      },
      {
        key: 'id-card-management',
        label: 'ID Card Management',
        actions: [
          { key: 'id-card-view', label: 'View ID cards', impliedByPages: ['id-card-management'] },
          { key: 'id-card-generate', label: 'Generate / print ID cards', impliedByPages: ['id-card-management'] },
        ],
      },
      {
        key: 'attendance-history',
        label: 'Attendance History',
        actions: [
          { key: 'attendance-history-view', label: 'View attendance history', impliedByPages: ['attendance-history'] },
        ],
      },
      {
        key: 'leave',
        label: 'Leave',
        actions: [
          // Only `leave-view` is implied by the Leave page grant. Creating,
          // editing, deleting, approving and rejecting are separate actions so a
          // read-only "Leave" grant can never decide or mutate a request.
          { key: 'leave-view', label: 'View leave requests', impliedByPages: ['leave'] },
          { key: 'leave-create', label: 'Create leave requests', impliedByPages: [] },
          { key: 'leave-edit', label: 'Edit leave requests', impliedByPages: [] },
          { key: 'leave-delete', label: 'Delete leave requests', impliedByPages: [] },
          { key: 'leave-approve', label: 'Approve leave requests', impliedByPages: [] },
          { key: 'leave-reject', label: 'Reject leave requests', impliedByPages: [] },
        ],
      },
    ],
  },
  {
    key: 'events-and-holidays',
    label: 'Events & Holidays',
    pages: [
      {
        key: 'events',
        label: 'Events',
        actions: [
          { key: 'event-view', label: 'View events', impliedByPages: ['events', 'calendar-view'] },
          { key: 'event-edit', label: 'Edit events', impliedByPages: [] },
          { key: 'event-delete', label: 'Delete events', impliedByPages: [] },
        ],
      },
      {
        key: 'add-event',
        label: 'Add Event',
        actions: [
          { key: 'event-create', label: 'Add events', impliedByPages: ['add-event'] },
        ],
      },
      {
        key: 'holidays',
        label: 'Holidays',
        actions: [
          { key: 'holiday-view', label: 'View holidays', impliedByPages: ['holidays', 'calendar-view'] },
          { key: 'holiday-create', label: 'Add holidays', impliedByPages: [] },
          { key: 'holiday-edit', label: 'Edit holidays', impliedByPages: [] },
          { key: 'holiday-delete', label: 'Delete holidays', impliedByPages: [] },
        ],
      },
      { key: 'calendar-view', label: 'Calendar View', actions: [] },
      {
        key: 'event-gallery',
        label: 'Event Gallery',
        actions: [
          { key: 'event-gallery-view', label: 'View event gallery', impliedByPages: ['event-gallery'] },
          { key: 'event-gallery-create', label: 'Upload / manage gallery images', impliedByPages: ['event-gallery'] },
        ],
      },
    ],
  },
  {
    key: 'exam-management',
    label: 'Exam Management',
    pages: [
      { key: 'exam-setup', label: 'Exam Setup', actions: [] },
      { key: 'subjects-marks', label: 'Subjects & Marks', actions: [] },
      { key: 'exam-schedule', label: 'Exam Schedule', actions: [] },
      { key: 'admit-card', label: 'Admit Card', actions: [] },
      { key: 'marks-entry', label: 'Marks Entry', actions: [] },
      { key: 'results', label: 'Results', actions: [] },
      { key: 'result-history', label: 'Result History', actions: [] },
    ],
  },
  {
    key: 'payroll-management',
    label: 'Salary Management',
    pages: [
      { key: 'salary-structure', label: 'Salary Structure', actions: [] },
      { key: 'payroll', label: 'Payroll', actions: [] },
      { key: 'salary-history', label: 'Salary History', actions: [] },
    ],
  },
  {
    key: 'fee-management',
    label: 'Fee Management',
    pages: [
      { key: 'fee-structure', label: 'Fee Structure', actions: [] },
      { key: 'collect-fee', label: 'Collect Fee', actions: [] },
      { key: 'student-fee-details', label: 'Student Fee Details', actions: [] },
      { key: 'outstanding-dues', label: 'Outstanding Dues', actions: [] },
      { key: 'reminders', label: 'Fee Reminders', actions: [] },
      { key: 'reports', label: 'Reports', actions: [] },
      { key: 'voucher-generation', label: 'Fee Voucher Generation', actions: [] },
    ],
  },
  {
    key: 'user-accounts',
    label: 'User Accounts',
    pages: [
      { key: 'all-accounts', label: 'All Accounts', actions: [] },
      { key: 'create-account', label: 'Create Account', actions: [] },
      { key: 'account-access', label: 'Account Access', actions: [] },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    pages: [
      {
        key: 'sms',
        label: 'SMS',
        actions: [
          { key: 'sms-view', label: 'View SMS messages', impliedByPages: ['sms'] },
          { key: 'sms-send', label: 'Send SMS messages', impliedByPages: ['sms'] },
        ],
      },
      {
        key: 'notices',
        label: 'Notices',
        actions: [
          { key: 'notices-view', label: 'View notices', impliedByPages: ['notices'] },
          { key: 'notices-create', label: 'Create notices', impliedByPages: [] },
          { key: 'notices-edit', label: 'Edit notices', impliedByPages: [] },
          { key: 'notices-delete', label: 'Delete notices', impliedByPages: [] },
        ],
      },
      {
        key: 'notifications',
        label: 'Notifications',
        actions: [
          { key: 'notifications-view', label: 'View notifications', impliedByPages: ['notifications'] },
          { key: 'notifications-create', label: 'Create notifications', impliedByPages: [] },
          { key: 'notifications-edit', label: 'Edit notifications', impliedByPages: [] },
          { key: 'notifications-delete', label: 'Delete notifications', impliedByPages: [] },
        ],
      },
    ],
  },
  {
    key: 'school-settings',
    label: 'School Settings',
    pages: [],
  },
];

// Capability module: it has no sidebar entry and no pages — only actions. It is
// stored exactly like any other module (`module:notification-bell` or
// `action:notification-bell:<key>`) but renders as a specialised section in the
// permission editor and is consumed by the Receptionist Header Bell.
const NOTIFICATION_BELL_MODULE = {
  key: 'notification-bell',
  label: 'Notification Bell',
  capability: true,
  pages: [],
  actions: [
    { key: 'bell-view', label: 'Show the notification bell', impliedByPages: [] },
    { key: 'student-leave', label: 'Student leave requests', impliedByPages: [] },
    { key: 'teacher-leave', label: 'Teacher leave requests', impliedByPages: [] },
    { key: 'other', label: 'Other notification categories', impliedByPages: [] },
    { key: 'mark-read', label: 'Mark notification bell items as read', impliedByPages: [] },
  ],
};

// The capability module is part of the catalogue (so its keys are valid and
// sanitization keeps them) but never part of the sidebar inventory.
const CAPABILITY_MODULES = [NOTIFICATION_BELL_MODULE];
const ALL_CATALOGUE_MODULES = [...RECEPTIONIST_MODULES, ...CAPABILITY_MODULES];

// Backward-compatible alias used in a few spots that imported the old name.
const PERMISSION_MODULES = RECEPTIONIST_MODULES;

const buildModuleKey = (moduleKey) => `module:${moduleKey}`;
const buildPageKey = (moduleKey, pageKey) => `page:${moduleKey}:${pageKey}`;
const buildActionKey = (moduleKey, actionKey) => `action:${moduleKey}:${actionKey}`;

// Legacy named export kept for compatibility with the old portal code path that
// produced `${module}.${action}` keys. New code should use buildModuleKey /
// buildPageKey instead.
const buildKey = (moduleKey, pageKey = null) =>
  pageKey ? buildPageKey(moduleKey, pageKey) : buildModuleKey(moduleKey);

const allModuleKeys = (module) => {
  const keys = [buildModuleKey(module.key)];
  for (const page of module.pages || []) {
    keys.push(buildPageKey(module.key, page.key));
    for (const action of page.actions || []) {
      keys.push(buildActionKey(module.key, action.key));
    }
  }
  for (const action of module.actions || []) {
    keys.push(buildActionKey(module.key, action.key));
  }
  return keys;
};

const ALL_PERMISSION_KEYS = new Set(
  ALL_CATALOGUE_MODULES.flatMap((module) => allModuleKeys(module)),
);

const MODULE_KEYS = new Set(ALL_CATALOGUE_MODULES.map((module) => module.key));
const CAPABILITY_MODULE_KEYS = new Set(CAPABILITY_MODULES.map((module) => module.key));

// A brand-new Receptionist starts with the absolute minimum: they can open the
// shared Admin Dashboard and nothing else. Every additional capability must be
// granted explicitly by an Admin.
const DEFAULT_RECEPTIONIST_PERMISSIONS = [buildModuleKey('dashboard')];

const isValidPermission = (key) =>
  typeof key === 'string' && ALL_PERMISSION_KEYS.has(key);

const getModuleByKey = (moduleKey) =>
  ALL_CATALOGUE_MODULES.find((module) => module.key === moduleKey) || null;

const getPageByKey = (moduleKey, pageKey) => {
  const module = getModuleByKey(moduleKey);
  return (module?.pages || []).find((page) => page.key === pageKey) || null;
};

const getActionByKey = (moduleKey, actionKey) => {
  const module = getModuleByKey(moduleKey);
  if (!module) return null;
  for (const page of module.pages || []) {
    const action = (page.actions || []).find((item) => item.key === actionKey);
    if (action) return { ...action, homePage: page.key };
  }
  return (module.actions || []).find((item) => item.key === actionKey) || null;
};

// Every permission key for one module (module + pages + actions), used by the
// "Full Access" toggle in the permission editor.
const expandModulePermissions = (moduleKey) => {
  const module = getModuleByKey(moduleKey);
  if (!module) return [];
  return allModuleKeys(module);
};

// ── Cross-module read dependencies ───────────────────────────────────────────
//
// Some Admin pages read another module's data to render (the Fee/Exam/Attendance
// pages pick a student from +GET /students; several forms pick a class). Those
// reads are expressed here as narrow, read-only dependencies: holding ANY grant
// in a consuming module implies only the listed *view* action of the data
// module. It never grants the data module itself (no sidebar entry, no route)
// and never touches its write actions.
const ACTION_READ_DEPENDENCIES = {
  'student-management': {
    'student-view': ['fee-management', 'exam-management', 'attendance-management'],
  },
  'class-management': {
    'class-view': ['student-management', 'fee-management', 'exam-management', 'attendance-management'],
  },
  'subject-management': {
    'subject-view': ['class-management', 'student-management', 'exam-management'],
  },
  'teacher-management': {
    'teacher-view': ['attendance-management'],
  },
};

// Accepts any input and returns a de-duplicated array containing only keys that
// exist in the catalogue. Unknown/forged values (including legacy `module.action`
// keys and any keys for non-existent or Admin-only modules) are silently dropped
// so a malformed payload can never widen access.
const sanitizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((permission) => isValidPermission(permission)))];
};

// Enforcement check used by requireModuleAccess. A stored `module:<key>` grant
// opens the whole module; a `page:<module>:<page>` grant opens exactly that
// page (and never any other module/page).
const hasModuleOrPageAccess = (permissions, moduleKey, pageKey = null) => {
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes(buildModuleKey(moduleKey))) return true;
  if (pageKey && permissions.includes(buildPageKey(moduleKey, pageKey))) return true;
  return false;
};

// True when the user holds the module, any of its pages, or any of its actions.
// Used for module-level route guards (a module is "reachable" if any grant
// inside it exists). Deliberately ignores cross-module read dependencies so a
// fee-only user is never treated as having access to the Students module.
const hasAnyModuleAccess = (permissions, moduleKey) => {
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes(buildModuleKey(moduleKey))) return true;
  const module = getModuleByKey(moduleKey);
  if (!module) return false;
  return allModuleKeys(module).some((key) => key.startsWith('page:') && permissions.includes(key))
    || allModuleKeys(module).some((key) => key.startsWith('action:') && permissions.includes(key));
};

// Granular action check used by requireActionAccess.
//
// Access is granted when ANY of the following holds:
//   1. the whole module is granted (`module:<key>`);
//   2. the action itself is granted (`action:<module>:<action>`);
//   3. one of the action's `impliedByPages` is granted — a page grant implies
//      only the actions it explicitly lists, so "All Students" implies viewing
//      but never adding/editing/deleting;
//   4. (read-only) the actor holds any grant in a consumer module listed in
//      ACTION_READ_DEPENDENCIES, which implies only *view* actions of the data
//      module, never the module itself or its write actions.
const hasActionAccess = (permissions, moduleKey, actionKey) => {
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes(buildModuleKey(moduleKey))) return true;
  if (permissions.includes(buildActionKey(moduleKey, actionKey))) return true;

  const action = getActionByKey(moduleKey, actionKey);
  if (action) {
    for (const pageKey of action.impliedByPages || []) {
      if (permissions.includes(buildPageKey(moduleKey, pageKey))) return true;
    }
  }

  const dependencies = ACTION_READ_DEPENDENCIES[moduleKey]?.[actionKey];
  if (Array.isArray(dependencies)) {
    for (const consumerModule of dependencies) {
      if (hasAnyModuleAccess(permissions, consumerModule)) return true;
    }
  }

  return false;
};

// True when every action key valid for the module is granted. Used by the
// permission editor to render "all operations" state and by sanitization tests.
const hasAllModuleActions = (permissions, moduleKey) => {
  const module = getModuleByKey(moduleKey);
  if (!module) return false;
  const actionKeys = [];
  for (const page of module.pages || []) {
    for (const action of page.actions || []) actionKeys.push(action.key);
  }
  for (const action of module.actions || []) actionKeys.push(action.key);
  return actionKeys.every((actionKey) => hasActionAccess(permissions, moduleKey, actionKey));
};

export {
  PERMISSION_MODULES,
  RECEPTIONIST_MODULES,
  CAPABILITY_MODULES,
  ALL_PERMISSION_KEYS,
  MODULE_KEYS,
  CAPABILITY_MODULE_KEYS,
  DEFAULT_RECEPTIONIST_PERMISSIONS,
  ACTION_READ_DEPENDENCIES,
  buildKey,
  buildModuleKey,
  buildPageKey,
  buildActionKey,
  isValidPermission,
  sanitizePermissions,
  getModuleByKey,
  getPageByKey,
  getActionByKey,
  expandModulePermissions,
  hasModuleOrPageAccess,
  hasAnyModuleAccess,
  hasActionAccess,
  hasAllModuleActions,
};

export default {
  PERMISSION_MODULES,
  RECEPTIONIST_MODULES,
  CAPABILITY_MODULES,
  ALL_PERMISSION_KEYS,
  MODULE_KEYS,
  CAPABILITY_MODULE_KEYS,
  DEFAULT_RECEPTIONIST_PERMISSIONS,
  ACTION_READ_DEPENDENCIES,
  buildKey,
  buildModuleKey,
  buildPageKey,
  buildActionKey,
  isValidPermission,
  sanitizePermissions,
  getModuleByKey,
  getPageByKey,
  getActionByKey,
  expandModulePermissions,
  hasModuleOrPageAccess,
  hasAnyModuleAccess,
  hasActionAccess,
  hasAllModuleActions,
};