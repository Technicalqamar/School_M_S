import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  KeyIcon,
  PowerIcon,
  TrashIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import receptionistService from '../../../services/receptionist/receptionist.service';
import {
  RECEPTIONIST_PERMISSION_MODULES,
  DEFAULT_RECEPTIONIST_PERMISSIONS,
  buildPermissionKey,
  expandModulePermissions,
} from '../../../constants/receptionistPermissions';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import Modal from '../../common/Modal/Modal';
import Alert from '../../common/Alert/Alert';
import CredentialsModal from '../../common/CredentialsModal/CredentialsModal';

const emptyForm = { fullName: '', email: '', phone: '', isActive: true, permissions: [...DEFAULT_RECEPTIONIST_PERMISSIONS] };

const STATUS_BADGE = {
  Active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  Inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * Permission editor built from the real catalogue (`RECEPTIONIST_PERMISSION_MODULES`).
 *
 * - Every module heading is a collapsible section.
 * - Available modules expose a "Full Access - <Module>" checkbox next to the
 *   individual action checkboxes. Full Access selects exactly the module's
 *   supported actions (never Admin-only operations); clearing it removes the
 *   whole module's keys and leaves other modules untouched.
 * - Unavailable modules are shown honestly as "Not yet available" and cannot be
 *   granted (the backend rejects their keys too).
 * - A partial selection renders the Full Access checkbox indeterminate.
 */
const PermissionEditor = ({ selected, onChange, disabled = false }) => {
  const [expanded, setExpanded] = useState(() =>
    Object.fromEntries(RECEPTIONIST_PERMISSION_MODULES.map((module) => [module.key, true])),
  );

  const toggleSection = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePermission = (key) => {
    if (disabled) return;
    onChange(
      selected.includes(key) ? selected.filter((permission) => permission !== key) : [...selected, key],
    );
  };

  const toggleFullAccess = (module) => {
    if (disabled) return;
    const keys = expandModulePermissions(module.key);
    if (keys.length === 0) return;
    const allSelected = keys.every((key) => selected.includes(key));
    const next = allSelected
      ? selected.filter((key) => !keys.includes(key))
      : [...new Set([...selected, ...keys])];
    onChange(next);
  };

  const totalSelected = selected.length;
  const totalAvailable = RECEPTIONIST_PERMISSION_MODULES.filter((module) => module.available).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
        <span>
          {totalSelected} of {totalAvailable} module permission{totalAvailable === 1 ? '' : 's'} selected
        </span>
      </div>

      {RECEPTIONIST_PERMISSION_MODULES.map((module) => {
        if (!module.available) {
          return (
            <div
              key={module.key}
              className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/30 px-3 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{module.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{module.description}</p>
                </div>
                <span className="inline-flex rounded-full bg-gray-200 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                  Not yet available
                </span>
              </div>
            </div>
          );
        }

        const keys = expandModulePermissions(module.key);
        const selectedCount = keys.filter((key) => selected.includes(key)).length;
        const isFull = keys.length > 0 && selectedCount === keys.length;
        const partial = selectedCount > 0 && selectedCount < keys.length;
        const isExpanded = expanded[module.key];

        return (
          <div
            key={module.key}
            className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggleSection(module.key)}
                className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                aria-expanded={isExpanded}
              >
                <ChevronDownIcon
                  className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    isExpanded ? 'rotate-0' : '-rotate-90'
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-800 dark:text-white">
                    {module.label}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {module.description}
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {selectedCount}/{keys.length}
                </span>
                <label
                  className={`inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title={`Full Access — ${module.label}: grants every supported action for this module`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                    checked={isFull}
                    disabled={disabled}
                    ref={(el) => {
                      if (el) el.indeterminate = partial && !isFull;
                    }}
                    onChange={() => toggleFullAccess(module)}
                  />
                  <span className="whitespace-nowrap">Full Access — {module.label}</span>
                </label>
              </div>
            </div>

            {isExpanded && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 px-4 py-3">
                {keys.map((key) => (
                  <label
                    key={key}
                    className={`inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 ${
                      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                      checked={selected.includes(key)}
                      disabled={disabled}
                      onChange={() => togglePermission(key)}
                    />
                    {module.actions.find((action) => buildPermissionKey(module.key, action.key) === key)?.label ||
                      key}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ReceptionistAccounts = () => {
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formModal, setFormModal] = useState({ open: false, mode: 'create', target: null });
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [permModal, setPermModal] = useState({ open: false, target: null, saved: [], draft: [] });
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [resetModal, setResetModal] = useState({ open: false, target: null });
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const [deleteModal, setDeleteModal] = useState({ open: false, target: null });
  const [deleting, setDeleting] = useState(false);

  const [credentials, setCredentials] = useState({ open: false, loginId: '', password: '' });

  const load = useCallback(async (searchTerm, statusValue, pageNumber) => {
    setLoading(true);
    setError('');
    try {
      const response = await receptionistService.getReceptionists({
        search: searchTerm || undefined,
        status: statusValue || undefined,
        page: pageNumber,
        limit: 10,
      });
      const data = response.data || {};
      setRows(data.receptionists || []);
      setPagination({
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 1,
        currentPage: data.pagination?.currentPage || pageNumber,
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load receptionist accounts.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(search, statusFilter, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const openCreate = () => {
    setFormData({ ...emptyForm, permissions: [...DEFAULT_RECEPTIONIST_PERMISSIONS] });
    setFormErrors({});
    setFormModal({ open: true, mode: 'create', target: null });
  };

  const openEdit = (row) => {
    setFormData({
      fullName: row.fullName || '',
      email: row.email || '',
      phone: row.phone || '',
      isActive: row.isActive,
      permissions: row.permissions || [],
    });
    setFormErrors({});
    setFormModal({ open: true, mode: 'edit', target: row });
  };

  const setFormPermissions = (permissions) => {
    setFormData((prev) => ({ ...prev, permissions }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.fullName || formData.fullName.trim().length < 3) {
      errors.fullName = 'Full name must be at least 3 characters';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (formModal.mode === 'create') {
        const response = await receptionistService.createReceptionist({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          isActive: formData.isActive,
          permissions: formData.permissions,
        });
        const creds = response.data?.temporaryCredentials;
        if (creds) {
          setCredentials({ open: true, loginId: creds.loginId, password: creds.password });
        }
        toast.success('Receptionist account created');
      } else {
        await receptionistService.updateReceptionist(formModal.target.id, {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          permissions: formData.permissions,
        });
        toast.success('Receptionist account updated');
      }
      setFormModal({ open: false, mode: 'create', target: null });
      load(search, statusFilter, page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save receptionist account.');
    } finally {
      setSaving(false);
    }
  };

  const openPermissions = (row) => {
    const saved = [...(row.permissions || [])].sort();
    setPermModal({ open: true, target: row, saved, draft: [...saved] });
  };

  const permissionsDirty = () => {
    const saved = [...(permModal.saved || [])].sort();
    const draft = [...(permModal.draft || [])].sort();
    return saved.length !== draft.length || saved.some((key, index) => key !== draft[index]);
  };

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    try {
      await receptionistService.updateReceptionistPermissions(permModal.target.id, permModal.draft);
      toast.success('Permissions saved successfully');
      setPermModal({ open: false, target: null, saved: [], draft: [] });
      load(search, statusFilter, page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save permissions.');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleToggleStatus = async (row) => {
    try {
      await receptionistService.updateReceptionistStatus(row.id, !row.isActive);
      toast.success(row.isActive ? 'Account deactivated' : 'Account activated');
      load(search, statusFilter, page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update status.');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    setResetting(true);
    setResetError('');
    try {
      await receptionistService.resetReceptionistPassword(resetModal.target.id, resetPassword);
      toast.success('Password reset. The receptionist must set a new password on next login.');
      setResetModal({ open: false, target: null });
      setResetPassword('');
    } catch (err) {
      setResetError(err.response?.data?.message || 'Unable to reset password.');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await receptionistService.deleteReceptionist(deleteModal.target.id);
      toast.success('Receptionist account deleted');
      setDeleteModal({ open: false, target: null });
      load(search, statusFilter, page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Receptionist Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and manage receptionist logins and their module permissions.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
          Add Receptionist
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load(search, statusFilter, 1);
          }}
          className="relative flex-1 min-w-[220px]"
        >
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID or email"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-3 py-2.5 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </form>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200"
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <button
          onClick={() => {
            setPage(1);
            load(search, statusFilter, 1);
          }}
          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Search
        </button>
      </div>

      {error && <Alert message={error} type="error" />}

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldCheckIcon className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No receptionist accounts yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Receptionist ID</th>
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-5 py-3 text-left font-medium">Email</th>
                  <th className="px-5 py-3 text-left font-medium">Permissions</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">
                      {row.receptionistId}
                    </td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{row.fullName}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{row.email || '—'}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-200">{row.permissions?.length || 0}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[row.status] || STATUS_BADGE.Inactive}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openPermissions(row)}
                          title="Manage permissions"
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          <ShieldCheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(row)}
                          title="Edit"
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setResetPassword('');
                            setResetError('');
                            setResetModal({ open: true, target: row });
                          }}
                          title="Reset password"
                          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <KeyIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(row)}
                          title={row.isActive ? 'Deactivate' : 'Activate'}
                          className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            row.isActive ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        >
                          <PowerIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ open: true, target: row })}
                          title="Delete"
                          className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {pagination.currentPage} of {pagination.totalPages} — {pagination.total} accounts
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.currentPage <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal
        isOpen={formModal.open}
        onClose={() => setFormModal({ open: false, mode: 'create', target: null })}
        title={formModal.mode === 'create' ? 'Add Receptionist' : 'Edit Receptionist'}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-1">
          <Input
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            error={formErrors.fullName}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={formErrors.email}
          />
          <Input
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</p>
            <PermissionEditor selected={formData.permissions} onChange={setFormPermissions} />
          </div>

          {formModal.mode === 'create' && (
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 mb-4">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Account active
            </label>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setFormModal({ open: false, mode: 'create', target: null })}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {formModal.mode === 'create' ? 'Create Account' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      {/* Dedicated Permissions modal */}
      <Modal
        isOpen={permModal.open}
        onClose={() => setPermModal({ open: false, target: null, saved: [], draft: [] })}
        title={`Permissions — ${permModal.target?.fullName || ''}`}
        maxWidth="max-w-2xl"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Grant the receptionist access to the modules below. Permissions apply immediately on their
          next request and are enforced on the server.
        </p>

        {permissionsDirty() && (
          <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            Unsaved changes — you have modified this receptionist&apos;s permissions.
          </div>
        )}

        <PermissionEditor
          selected={permModal.draft}
          onChange={(next) => setPermModal((prev) => ({ ...prev, draft: next }))}
        />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setPermModal({ open: false, target: null, saved: [], draft: [] })}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSavePermissions} loading={savingPermissions} disabled={!permissionsDirty()}>
            Save Permissions
          </Button>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal
        isOpen={resetModal.open}
        onClose={() => setResetModal({ open: false, target: null })}
        title="Reset Password"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Set a new temporary password for <strong>{resetModal.target?.fullName}</strong>. They will be required to
          change it on their next login.
        </p>
        {resetError && <Alert message={resetError} type="error" />}
        <Input
          label="New Password"
          name="newPassword"
          type="password"
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => setResetModal({ open: false, target: null })}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleResetPassword} loading={resetting}>
            Reset Password
          </Button>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, target: null })}
        title="Delete Receptionist Account"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Are you sure you want to permanently delete{' '}
          <strong>{deleteModal.target?.fullName}</strong> ({deleteModal.target?.receptionistId})? This removes their
          login and cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDeleteModal({ open: false, target: null })}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </Modal>

      <CredentialsModal
        isOpen={credentials.open}
        onClose={() => setCredentials({ open: false, loginId: '', password: '' })}
        role="receptionist"
        loginId={credentials.loginId}
        password={credentials.password}
      />
    </div>
  );
};

export default ReceptionistAccounts;