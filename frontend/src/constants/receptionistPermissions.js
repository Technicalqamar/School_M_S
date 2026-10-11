// Frontend mirror of the backend permission catalogue
// (`backend/src/constants/permissions.js`). The backend remains the source of
// truth and re-validates every value; this copy only drives display and the
// permission editor, and is used to gate navigation/routes for a smoother UX.
//
// `available: true` modules are wired into the Receptionist portal and each of
// their actions is enforced server-side. `available: false` modules are not
// integrated yet: they are shown in the Admin editor as unavailable and can
// never be granted (the backend drops their keys).

export const RECEPTIONIST_PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview counts and recent student activity.',
    available: true,
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    key: 'students',
    label: 'Student Records',
    description: 'Search and view student profiles and records.',
    available: true,
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    key: 'attendance',
    label: 'Student Attendance',
    description: 'Look up a student\u2019s attendance record.',
    available: true,
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    key: 'fees',
    label: 'Fees & Dues',
    description: 'Look up a student\u2019s outstanding fee dues.',
    available: true,
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    key: 'notices',
    label: 'Notices',
    description: 'Read published school notices.',
    available: true,
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    key: 'admissions',
    label: 'Admissions',
    description: 'Register and manage student admissions.',
    available: false,
    actions: [],
  },
  {
    key: 'parents',
    label: 'Parent / Contact Records',
    description: 'View and update parent / contact details.',
    available: false,
    actions: [],
  },
  {
    key: 'reports',
    label: 'Reports & Exports',
    description: 'View and export school reports.',
    available: false,
    actions: [],
  },
];

export const buildPermissionKey = (moduleKey, actionKey) => `${moduleKey}.${actionKey}`;

// Only permissions on available (wired and enforced) modules can be granted.
export const ALL_RECEPTIONIST_PERMISSIONS = RECEPTIONIST_PERMISSION_MODULES.filter(
  (module) => module.available === true,
).flatMap((module) => module.actions.map((action) => buildPermissionKey(module.key, action.key)));

export const RECEPTIONIST_MODULE_KEYS = RECEPTIONIST_PERMISSION_MODULES.map(
  (module) => module.key,
);

// Least-privilege default applied when an Admin creates a receptionist without
// choosing anything explicitly. Matches the backend default.
export const DEFAULT_RECEPTIONIST_PERMISSIONS = ['dashboard.view'];

export const getModuleByKey = (moduleKey) =>
  RECEPTIONIST_PERMISSION_MODULES.find((module) => module.key === moduleKey) || null;

// All permission keys for one module (used by the "Full Access" toggle).
// Unavailable modules expand to an empty list so Full Access can never pretend
// to grant something the portal cannot enforce. Mirrors the backend helper.
export const expandModulePermissions = (moduleKey) => {
  const module = getModuleByKey(moduleKey);
  if (!module || module.available !== true) return [];
  return module.actions.map((action) => buildPermissionKey(module.key, action.key));
};

export const hasPermission = (user, permission) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'receptionist') return false;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
};