// Frontend mirror of the backend permission catalogue
// (`backend/src/constants/permissions.js`). The backend remains the source of
// truth and re-validates every value; this copy only drives display and the
// permission editor, and is used to gate navigation/routes for a smoother UX.

export const RECEPTIONIST_PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview counts and recent activity.',
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    key: 'students',
    label: 'Student Records',
    description: 'Look up and view student profiles and records.',
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
    description: 'Register new admissions and enrolment details.',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
    ],
  },
  {
    key: 'attendance',
    label: 'Student Attendance',
    description: 'Record and review student attendance.',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'edit', label: 'Edit' },
    ],
  },
  {
    key: 'fees',
    label: 'Fees & Fee Receipts',
    description: 'Collect fees and view receipts and dues.',
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
    description: 'View and update parent / contact details.',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'edit', label: 'Edit' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports & Exports',
    description: 'View and export school reports.',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'export', label: 'Export' },
    ],
  },
  {
    key: 'notices',
    label: 'Notices & Communication',
    description: 'View and publish notices.',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
    ],
  },
];

export const buildPermissionKey = (moduleKey, actionKey) => `${moduleKey}.${actionKey}`;

export const ALL_RECEPTIONIST_PERMISSIONS = RECEPTIONIST_PERMISSION_MODULES.flatMap((module) =>
  module.actions.map((action) => buildPermissionKey(module.key, action.key)),
);

// Least-privilege default applied when an Admin creates a receptionist without
// choosing anything explicitly. Matches the backend default.
export const DEFAULT_RECEPTIONIST_PERMISSIONS = ['dashboard.view'];

export const hasPermission = (user, permission) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'receptionist') return false;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
};
