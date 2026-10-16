// Frontend mirror of the backend permission catalogue
// (`backend/src/constants/permissions.js`). The backend remains the source of
// truth and re-validates every value; this copy only drives display, the
// permission editor and client-side navigation guards for a smoother UX.
//
// Every module below is one of the exact Admin sidebar modules a Receptionist
// may be granted ("Dashboard", "Student Management", ..., "School Settings").
// `path` is the shared Admin route that module lives at; `pages` mirror the
// collapsible sidebar sub-pages (Exam, Fee, User Accounts and Communication
// dropdowns) AND the internal tabs of each module. Admin-only modules (like
// "Receptionist Management") are absent by design: a Receptionist can never be
// granted administrative capabilities.
//
// A stored permission is one of:
//   `module:<moduleKey>`           -> the whole module
//   `page:<moduleKey>:<pageKey>`   -> exactly one sub-page
//   `action:<moduleKey>:<actionKey>` -> exactly one operation
// The helpers below mirror the backend predicates so the frontend guards cannot
// drift from the server-side enforcement.

// The shared Admin shell is mounted under two URL namespaces: `/admin` for the
// Admin panel and `/receptionist` for the Receptionist portal. The catalogue
// below stores each module's canonical (Admin) path; these helpers translate
// that canonical path into the namespace of the signed-in portal so a
// Receptionist is never bounced back into `/admin` and an Admin is never moved
// out of it.
export const ADMIN_BASE_PATH = '/admin';
export const RECEPTIONIST_BASE_PATH = '/receptionist';

export const getPortalBasePath = (role) =>
  role === 'receptionist' ? RECEPTIONIST_BASE_PATH : ADMIN_BASE_PATH;

// Rewrites an `/admin...` path into the given role's namespace. Non-`/admin`
// paths (and the Admin role) are returned unchanged, so Admin routing is
// byte-for-byte identical to before.
export const toPortalPath = (role, path) => {
  if (!path) return path;
  const base = getPortalBasePath(role);
  if (base === ADMIN_BASE_PATH) return path;
  if (path === ADMIN_BASE_PATH) return base;
  if (path.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return `${base}${path.slice(ADMIN_BASE_PATH.length)}`;
  }
  return path;
};

export const RECEPTIONIST_PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/admin',
    pages: [],
  },
  {
    key: 'student-management',
    label: 'Student Management',
    path: '/admin/students',
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
    path: '/admin/teachers',
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
    path: '/admin/classes',
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
    path: '/admin/subjects',
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
    path: '/admin/timetable',
    pages: [
      { key: 'create-timetable', label: 'Create Timetable', actions: [] },
      { key: 'designer', label: 'Designer', actions: [] },
      { key: 'time-slots', label: 'Time Slots', actions: [] },
    ],
  },
  {
    key: 'attendance-management',
    label: 'Attendance Management',
    path: '/admin/attendance',
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
          // Mirror of the backend catalogue: only `leave-view` is implied by
          // the Leave page grant; every other leave operation is a separate,
          // explicit action.
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
    path: '/admin/events',
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
    path: '/admin/exams/setup',
    pages: [
      { key: 'exam-setup', label: 'Exam Setup', path: '/admin/exams/setup', actions: [] },
      { key: 'subjects-marks', label: 'Subjects & Marks', path: '/admin/exams/subjects-marks', actions: [] },
      { key: 'exam-schedule', label: 'Exam Schedule', path: '/admin/exams/schedule', actions: [] },
      { key: 'admit-card', label: 'Admit Card', path: '/admin/exams/admit-card', actions: [] },
      { key: 'marks-entry', label: 'Marks Entry', path: '/admin/exams/marks-entry', actions: [] },
      { key: 'results', label: 'Results', path: '/admin/exams/results', actions: [] },
      { key: 'result-history', label: 'Result History', path: '/admin/exams/result-history', actions: [] },
    ],
  },
  {
    key: 'payroll-management',
    label: 'Salary Management',
    path: '/admin/payroll',
    pages: [
      { key: 'salary-structure', label: 'Salary Structure', actions: [] },
      { key: 'payroll', label: 'Payroll', actions: [] },
      { key: 'salary-history', label: 'Salary History', actions: [] },
    ],
  },
  {
    key: 'fee-management',
    label: 'Fee Management',
    path: '/admin/fees/fee-structure',
    pages: [
      { key: 'fee-structure', label: 'Fee Structure', path: '/admin/fees/fee-structure', actions: [] },
      { key: 'collect-fee', label: 'Collect Fee', path: '/admin/fees/collect-fee', actions: [] },
      { key: 'student-fee-details', label: 'Student Fee Details', path: '/admin/fees/student-fee-details', actions: [] },
      { key: 'outstanding-dues', label: 'Outstanding Dues', path: '/admin/fees/outstanding-dues', actions: [] },
      { key: 'reminders', label: 'Fee Reminders', path: '/admin/fees/reminders', actions: [] },
      { key: 'reports', label: 'Reports', path: '/admin/fees/reports', actions: [] },
      { key: 'voucher-generation', label: 'Fee Voucher Generation', path: '/admin/fees/voucher-generation', actions: [] },
    ],
  },
  {
    key: 'user-accounts',
    label: 'User Accounts',
    path: '/admin/accounts/all',
    pages: [
      { key: 'all-accounts', label: 'All Accounts', path: '/admin/accounts/all', actions: [] },
      { key: 'create-account', label: 'Create Account', path: '/admin/accounts/create', actions: [] },
      { key: 'account-access', label: 'Account Access', path: '/admin/accounts/access', actions: [] },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    path: '/admin/communication/notices',
    pages: [
      {
        key: 'sms',
        label: 'SMS',
        path: '/admin/communication/sms',
        actions: [
          { key: 'sms-view', label: 'View SMS messages', impliedByPages: ['sms'] },
          { key: 'sms-send', label: 'Send SMS messages', impliedByPages: ['sms'] },
        ],
      },
      {
        key: 'notices',
        label: 'Notices',
        path: '/admin/communication/notices',
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
        path: '/admin/communication/notifications',
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
    path: '/admin/settings',
    pages: [],
  },
];

// Capability module: no sidebar entry, no pages, only actions. It is stored like
// any other module but rendered as its own section in the permission editor and
// consumed by the Receptionist Header Bell.
export const RECEPTIONIST_CAPABILITY_MODULES = [
  {
    key: 'notification-bell',
    label: 'Notification Bell',
    capability: true,
    path: null,
    pages: [],
    actions: [
      { key: 'bell-view', label: 'Show the notification bell', impliedByPages: [] },
      { key: 'student-leave', label: 'Student leave requests', impliedByPages: [] },
      { key: 'teacher-leave', label: 'Teacher leave requests', impliedByPages: [] },
      { key: 'other', label: 'Other notification categories', impliedByPages: [] },
      { key: 'mark-read', label: 'Mark notification bell items as read', impliedByPages: [] },
    ],
  },
];

export const ALL_CATALOGUE_MODULES = [
  ...RECEPTIONIST_PERMISSION_MODULES,
  ...RECEPTIONIST_CAPABILITY_MODULES,
];

export const buildModuleKey = (moduleKey) => `module:${moduleKey}`;
export const buildPageKey = (moduleKey, pageKey) => `page:${moduleKey}:${pageKey}`;
export const buildActionKey = (moduleKey, actionKey) => `action:${moduleKey}:${actionKey}`;
// Legacy alias kept for call sites that imported the old name.
export const buildPermissionKey = buildPageKey;

// A brand-new Receptionist starts with the absolute minimum: the shared Admin
// Dashboard. Everything else must be granted explicitly by an Admin.
export const DEFAULT_RECEPTIONIST_PERMISSIONS = [buildModuleKey('dashboard')];

const moduleAllKeys = (module) => {
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

export const ALL_RECEPTIONIST_PERMISSIONS = ALL_CATALOGUE_MODULES.flatMap((module) =>
  moduleAllKeys(module),
);

export const RECEPTIONIST_MODULE_KEYS = ALL_CATALOGUE_MODULES.map((m) => m.key);

export const getModuleByKey = (moduleKey) =>
  ALL_CATALOGUE_MODULES.find((module) => module.key === moduleKey) || null;

export const getPageByKey = (moduleKey, pageKey) => {
  const module = getModuleByKey(moduleKey);
  return (module?.pages || []).find((page) => page.key === pageKey) || null;
};

export const getActionByKey = (moduleKey, actionKey) => {
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
export const expandModulePermissions = (moduleKey) => {
  const module = getModuleByKey(moduleKey);
  if (!module) return [];
  return moduleAllKeys(module);
};

export const isValidPermission = (key) =>
  typeof key === 'string' && ALL_RECEPTIONIST_PERMISSIONS.includes(key);

export const sanitizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((permission) => isValidPermission(permission)))];
};

// Cross-module read dependencies, mirrored from the backend so the editor can
// render accurate "granted via" hints and guards cannot drift. Holding any grant
// in a consumer module implies only the listed *view* action of the data module.
export const ACTION_READ_DEPENDENCIES = {
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

// True when the user holds the whole module or the exact page grant. Admins
// always pass. (Mirrors backend hasModuleOrPageAccess.)
export const hasModuleAccess = (user, moduleKey, pageKey = null) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'receptionist') return false;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (permissions.includes(buildModuleKey(moduleKey))) return true;
  if (pageKey && permissions.includes(buildPageKey(moduleKey, pageKey))) return true;
  return false;
};

// True when the stored grants hold the module, any of its pages, or any of its
// actions. Used by the Sidebar to decide whether to render a module entry and by
// module-level route guards. Never considers cross-module read dependencies, so
// a fee-only user is never treated as having access to the Students module.
export const hasAnyReceptionistModuleAccess = (user, moduleKey) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'receptionist') return false;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return hasAnyGrantForModule(permissions, moduleKey);
};

// Pure (permission-key) variant of hasAnyReceptionistModuleAccess.
export const hasAnyGrantForModule = (permissions, moduleKey) => {
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes(buildModuleKey(moduleKey))) return true;
  const module = getModuleByKey(moduleKey);
  if (!module) return false;
  return moduleAllKeys(module).some(
    (key) => (key.startsWith('page:') || key.startsWith('action:')) && permissions.includes(key),
  );
};

// Effective action check that mirrors backend `hasActionAccess` exactly:
// module grant, action grant, implied-by-page grant, or cross-module read
// dependency. Pure (works on a permission array).
export const hasActionAccess = (permissions, moduleKey, actionKey) => {
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
      if (hasAnyGrantForModule(permissions, consumerModule)) return true;
    }
  }

  return false;
};

// Role-aware variant of hasActionAccess used by components (guards, editor).
export const hasReceptionistActionAccess = (user, moduleKey, actionKey) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'receptionist') return false;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  return hasActionAccess(permissions, moduleKey, actionKey);
};

// True when the user may use a tab/page surface: the whole module, the page
// itself, or one of the surface's own actions. Used by tab containers and the
// sidebar page lists (pages of tab-modules with actions).
export const hasPageOrActionAccess = (user, moduleKey, pageKey, actionKeys = []) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'receptionist') return false;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  if (permissions.includes(buildModuleKey(moduleKey))) return true;
  if (pageKey && permissions.includes(buildPageKey(moduleKey, pageKey))) return true;
  if (actionKeys.some((actionKey) => hasActionAccess(permissions, moduleKey, actionKey))) return true;
  return false;
};

// Sidebar page visibility for the dropdown modules (Exam/Fee/User
// Accounts/Communication). Those links are page routes, so they show only when
// the module or the exact page key is granted - an action-only grant has no
// usable page route to open.
export const getVisibleSidebarPages = (user, moduleKey) => {
  if (!user) return [];
  if (user.role === 'admin') {
    const module = getModuleByKey(moduleKey);
    return module?.pages || [];
  }
  if (user.role !== 'receptionist') return [];
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const module = getModuleByKey(moduleKey);
  if (!module) return [];
  if (permissions.includes(buildModuleKey(module.key))) return module.pages;
  return module.pages.filter((page) => permissions.includes(buildPageKey(module.key, page.key)));
};

// Internal-tab mapping used by the tab containers. Keys equal each container's
// stable tab keys; a tab shows when its page or one of its actions is granted.
// Tabs not listed here are hidden from receptionists by default.
export const RECEPTIONIST_TAB_GRANTS = {
  'student-management': {
    'All Students': { page: 'all-students', actions: ['student-view', 'student-edit', 'student-delete'] },
    'Add Student': { page: 'add-student', actions: ['student-create'] },
    'Student Promotion': { page: 'student-promotion', actions: ['student-promote'] },
    'Promotion History': { page: 'promotion-history', actions: [] },
  },
  'teacher-management': {
    'All Teachers': { page: 'all-teachers', actions: ['teacher-view', 'teacher-edit', 'teacher-delete'] },
    'Add Teacher': { page: 'add-teacher', actions: ['teacher-create'] },
  },
  'class-management': {
    'All Classes': { page: 'all-classes', actions: ['class-view', 'class-edit', 'class-delete'] },
    // The add/edit form is shared: class-edit grants open it in edit mode too.
    'Add New Class': { page: 'add-class', actions: ['class-create', 'class-edit'] },
    'Class Details': { page: 'class-details', actions: ['class-view'] },
  },
  'subject-management': {
    'All Subjects': { page: 'all-subjects', actions: ['subject-view', 'subject-edit', 'subject-delete'] },
    // The add/edit form is shared: subject-edit grants open it in edit mode too.
    'Add Subject': { page: 'add-subject', actions: ['subject-create', 'subject-edit'] },
    'Class Subject Assignment': { page: 'class-subject-assignment', actions: ['subject-assign'] },
  },
  'timetable-management': {
    'create-timetable': { page: 'create-timetable', actions: [] },
    designer: { page: 'designer', actions: [] },
    'time-slots': { page: 'time-slots', actions: [] },
  },
  'attendance-management': {
    'Student Attendance': { page: 'student-attendance', actions: ['student-attendance-view', 'student-attendance-mark'] },
    'Teacher Attendance': { page: 'teacher-attendance', actions: ['teacher-attendance-view', 'teacher-attendance-mark'] },
    'ID Card Management': { page: 'id-card-management', actions: ['id-card-view', 'id-card-generate'] },
    'Attendance History': { page: 'attendance-history', actions: ['attendance-history-view'] },
    'Leave': { page: 'leave', actions: ['leave-view', 'leave-create', 'leave-edit', 'leave-delete', 'leave-approve', 'leave-reject'] },
  },
  'payroll-management': {
    'salary-structure': { page: 'salary-structure', actions: [] },
    payroll: { page: 'payroll', actions: [] },
    'salary-history': { page: 'salary-history', actions: [] },
  },
  'events-and-holidays': {
    Events: { page: 'events', actions: ['event-view', 'event-edit', 'event-delete'] },
    'Add Event': { page: 'add-event', actions: ['event-create', 'event-edit'] },
    Holidays: { page: 'holidays', actions: ['holiday-view', 'holiday-create', 'holiday-edit', 'holiday-delete'] },
    'Calendar View': { page: 'calendar-view', actions: ['event-view', 'holiday-view'] },
    'Event Gallery': { page: 'event-gallery', actions: ['event-gallery-view', 'event-gallery-create'] },
  },
};

// Filters a container's tabs to those the receptionist may open. `tabs` is an
// array of `{ key, label, component }`; a tab kept when its page (or any of its
// actions) is granted. Admins get every tab.
export const filterTabsByPermission = (user, moduleKey, tabs) => {
  if (!user || user.role === 'admin') return tabs;
  if (user.role !== 'receptionist') return tabs;
  const grants = RECEPTIONIST_TAB_GRANTS[moduleKey] || {};
  return tabs.filter((tab) => {
    const grant = grants[tab.key];
    if (!grant) return false;
    return hasPageOrActionAccess(user, moduleKey, grant.page, grant.actions);
  });
};

// First route a receptionist can actually open, used for the post-login landing
// and the "first grant" resolver. Paths are returned in the Receptionist
// namespace (`/receptionist/...`): the Dashboard module maps to `/receptionist`;
// otherwise the first granted module path, the first granted page path, or the
// first module whose page/action is granted. Capability modules have no route
// and are skipped. Returns null when nothing is granted (the user is sent to
// `/receptionist/access-denied`).
export const findFirstAccessibleModulePath = (user) => {
  if (!user || user.role !== 'receptionist') return null;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  for (const module of RECEPTIONIST_PERMISSION_MODULES) {
    if (!module.path) continue;
    if (permissions.includes(buildModuleKey(module.key))) {
      return toPortalPath('receptionist', module.path);
    }
  }
  for (const module of RECEPTIONIST_PERMISSION_MODULES) {
    for (const page of module.pages) {
      if (!page.path) continue;
      if (permissions.includes(buildPageKey(module.key, page.key))) {
        return toPortalPath('receptionist', page.path);
      }
    }
  }
  for (const module of RECEPTIONIST_PERMISSION_MODULES) {
    if (!module.path) continue;
    if (hasAnyGrantForModule(permissions, module.key)) {
      return toPortalPath('receptionist', module.path);
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Permission-editor transition & display helpers (pure, catalogue-driven).
//
// The editor stores three key kinds: `module:<m>` (whole module), `page:<m>:<p>`
// (one page/tab) and `action:<m>:<a>` (one operation). Rules:
//   * module on  -> the module key replaces any granular keys of the module
//   * module off -> the module key AND every page/action key of the module are
//                   revoked (no silent leftovers)
//   * page on    -> the page key is added and only its *implied* actions are
//                   auto-added (an action is implied when the page appears in
//                   its `impliedByPages`)
//   * page off   -> the page key and the implied-only actions no longer covered
//                   by a retained page are dropped; explicit action keys are
//                   untouched
//   * action on  -> the explicit action key is added (no page is auto-granted)
//   * action off -> the explicit action key is removed; the checkbox still
//                   renders checked while another grant (page) implies it
// These mirror the backend predicates so saved permission sets resolve to the
// same effective grants the server enforces.
export const setModuleGranted = (permissions, moduleKey) => {
  if (!Array.isArray(permissions)) return [];
  const keys = expandModulePermissions(moduleKey);
  const without = permissions.filter((key) => !keys.includes(key));
  return [...new Set([...without, buildModuleKey(moduleKey)])];
};

export const revokeModule = (permissions, moduleKey) => {
  if (!Array.isArray(permissions)) return [];
  const keys = expandModulePermissions(moduleKey);
  return permissions.filter((key) => !keys.includes(key));
};

export const setPageGranted = (permissions, moduleKey, pageKey) => {
  if (!Array.isArray(permissions)) return [];
  const page = getPageByKey(moduleKey, pageKey);
  if (!page) return permissions;
  // The whole module is already stored: the page grant would be redundant.
  if (permissions.includes(buildModuleKey(moduleKey))) return permissions;
  const added = [buildPageKey(moduleKey, pageKey)];
  for (const action of page.actions || []) {
    if ((action.impliedByPages || []).includes(pageKey)) {
      added.push(buildActionKey(moduleKey, action.key));
    }
  }
  return [...new Set([...permissions, ...added])];
};

export const revokePageGranted = (permissions, moduleKey, pageKey) => {
  if (!Array.isArray(permissions)) return [];
  const module = getModuleByKey(moduleKey);
  const page = getPageByKey(moduleKey, pageKey);
  if (!module || !page) return permissions;

  const moduleKeyString = buildModuleKey(moduleKey);
  const hadModule = permissions.includes(moduleKeyString);
  let next = permissions.filter((key) => key !== moduleKeyString);
  next = next.filter((key) => key !== buildPageKey(moduleKey, pageKey));

  const retainedPages = (module.pages || []).filter((p) => p.key !== pageKey);
  const retainedPageKeys = retainedPages.map((p) => p.key);

  // Materialization: when the module key was the only source, unchecking a
  // child turns the remaining pages + their implied actions into explicit keys
  // (the removed page stops being granted) while skipping actions that were
  // only implied by the removed page.
  if (hadModule) {
    const materialized = [];
    for (const retained of retainedPages) {
      materialized.push(buildPageKey(moduleKey, retained.key));
      for (const action of retained.actions || []) {
        if ((action.impliedByPages || []).includes(retained.key)) {
          materialized.push(buildActionKey(moduleKey, action.key));
        }
      }
    }
    next = [...new Set([...next, ...materialized])];
  }

  // Drop implied-only action keys whose implied pages have all been revoked.
  // Explicit action keys survive independently of any page.
  for (const p of module.pages || []) {
    for (const action of p.actions || []) {
      const covered = (action.impliedByPages || []).some((ip) => retainedPageKeys.includes(ip));
      if (!covered) {
        next = next.filter((key) => key !== buildActionKey(moduleKey, action.key));
      }
    }
  }
  return next;
};

export const setActionGranted = (permissions, moduleKey, actionKey) => {
  if (!Array.isArray(permissions)) return [];
  if (permissions.includes(buildModuleKey(moduleKey))) return permissions;
  return [...new Set([...permissions, buildActionKey(moduleKey, actionKey)])];
};

export const revokeActionGranted = (permissions, moduleKey, actionKey) => {
  if (!Array.isArray(permissions)) return [];
  if (permissions.includes(buildModuleKey(moduleKey))) return permissions;
  return permissions.filter((key) => key !== buildActionKey(moduleKey, actionKey));
};

// Effective (not just stored) display state, matching hasActionAccess:
// module key, page key, explicit action key or implied-by-page key.
export const isModuleGranted = (permissions, moduleKey) =>
  Array.isArray(permissions) && permissions.includes(buildModuleKey(moduleKey));

export const isModuleGrantedPartially = (permissions, moduleKey) => {
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes(buildModuleKey(moduleKey))) return false;
  return expandModulePermissions(moduleKey).some(
    (key) => (key.startsWith('page:') || key.startsWith('action:')) && permissions.includes(key),
  );
};

export const isPageGrantedEffective = (permissions, moduleKey, pageKey) =>
  Array.isArray(permissions) &&
  (permissions.includes(buildModuleKey(moduleKey)) ||
    permissions.includes(buildPageKey(moduleKey, pageKey)));

export const isPageGrantedPartially = (permissions, moduleKey, pageKey) => {
  if (!Array.isArray(permissions)) return false;
  if (isPageGrantedEffective(permissions, moduleKey, pageKey)) return false;
  const page = getPageByKey(moduleKey, pageKey);
  if (!page) return false;
  return (page.actions || []).some((action) =>
    isActionGrantedEffective(permissions, moduleKey, action.key),
  );
};

export const isActionGrantedEffective = (permissions, moduleKey, actionKey) => {
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes(buildModuleKey(moduleKey))) return true;
  if (permissions.includes(buildActionKey(moduleKey, actionKey))) return true;
  const action = getActionByKey(moduleKey, actionKey);
  if (action && (action.impliedByPages || []).some((ip) => permissions.includes(buildPageKey(moduleKey, ip)))) {
    return true;
  }
  return false;
};