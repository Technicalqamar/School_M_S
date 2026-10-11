// Central catalogue of Receptionist permissions.
//
// A permission is the string `${module}.${action}` (for example `students.view`).
// This single catalogue drives backend validation, backend enforcement and the
// Admin permission editor in the frontend, so the two can never drift apart.
//
// Modules that are not yet wired into the Receptionist portal are still listed
// here on purpose: an Admin can pre-assign permissions and the framework will
// enforce them the moment a module is integrated. Permissions alone never make
// an unwired module appear to work.

const PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    key: 'students',
    label: 'Student Records',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    key: 'admissions',
    label: 'Admissions',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
    ],
  },
  {
    key: 'attendance',
    label: 'Student Attendance',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
    ],
  },
  {
    key: 'fees',
    label: 'Fees & Fee Receipts',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'collect', label: 'Collect Fee' },
      { key: 'refund', label: 'Refund' },
      { key: 'export', label: 'Export' },
    ],
  },
  {
    key: 'parents',
    label: 'Parent / Contact Records',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports & Exports',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'export', label: 'Export' },
    ],
  },
  {
    key: 'notices',
    label: 'Notices & Communication',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
    ],
  },
];

const buildKey = (moduleKey, actionKey) => `${moduleKey}.${actionKey}`;

const ALL_PERMISSION_KEYS = new Set(
  PERMISSION_MODULES.flatMap((module) =>
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

// Accepts any input and returns a de-duplicated array containing only keys that
// exist in the catalogue. Unknown/forged values are silently dropped so a
// malformed payload can never widen access.
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
};

export default {
  PERMISSION_MODULES,
  ALL_PERMISSION_KEYS,
  MODULE_KEYS,
  DEFAULT_RECEPTIONIST_PERMISSIONS,
  buildKey,
  isValidPermission,
  sanitizePermissions,
};
