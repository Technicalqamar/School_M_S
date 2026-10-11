// Central catalogue of Receptionist permissions.
//
// A permission is the string `${module}.${action}` (for example `students.view`).
// This single catalogue drives backend validation, backend enforcement and the
// Admin permission editor in the frontend, so the two can never drift apart.
//
// Only modules actually wired into the Receptionist portal are grantable
// (`available: true`) and their action list is the exact set the portal
// enforces server-side - nothing is shown that cannot be enforced. Modules that
// are not integrated yet (`available: false`) carry no actions and are shown in
// the Admin editor as honestly unavailable. Granting can never make an unwired
// module appear to work, and the backend rejects any key that is not in the
// catalogue.

const PERMISSION_MODULES = [
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

const buildKey = (moduleKey, actionKey) => `${moduleKey}.${actionKey}`;

// Only permissions on available (wired and enforced) modules can be granted.
const ALL_PERMISSION_KEYS = new Set(
  PERMISSION_MODULES.filter((module) => module.available === true).flatMap((module) =>
    module.actions.map((action) => buildKey(module.key, action.key)),
  ),
);

const MODULE_KEYS = new Set(PERMISSION_MODULES.map((module) => module.key));

// A brand-new Receptionist starts with the absolute minimum: they can open
// their own dashboard and nothing else. Every additional capability must be
// granted explicitly by an Admin.
const DEFAULT_RECEPTIONIST_PERMISSIONS = ['dashboard.view'];

const isValidPermission = (key) =>
  typeof key === 'string' && ALL_PERMISSION_KEYS.has(key);

const getModuleByKey = (moduleKey) =>
  PERMISSION_MODULES.find((module) => module.key === moduleKey) || null;

// All permission keys for one module, used by the Admin "Full Access" toggle.
// Unavailable modules expand to an empty list so Full Access can never pretend
// to grant something the portal cannot enforce.
const expandModulePermissions = (moduleKey) => {
  const module = getModuleByKey(moduleKey);
  if (!module || module.available !== true) return [];
  return module.actions.map((action) => buildKey(module.key, action.key));
};

// Accepts any input and returns a de-duplicated array containing only keys that
// exist in the catalogue. Unknown/forged values (including keys belonging to
// unavailable modules) are silently dropped so a malformed payload can never
// widen access.
const sanitizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((permission) => isValidPermission(permission)))];
};

export {
  PERMISSION_MODULES,
  ALL_PERMISSION_KEYS,
  MODULE_KEYS,
  DEFAULT_RECEPTIONIST_PERMISSIONS,
  buildKey,
  isValidPermission,
  sanitizePermissions,
  getModuleByKey,
  expandModulePermissions,
};

export default {
  PERMISSION_MODULES,
  ALL_PERMISSION_KEYS,
  MODULE_KEYS,
  DEFAULT_RECEPTIONIST_PERMISSIONS,
  buildKey,
  isValidPermission,
  sanitizePermissions,
  getModuleByKey,
  expandModulePermissions,
};