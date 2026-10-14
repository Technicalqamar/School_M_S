import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheckIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import receptionistService from '../../../services/receptionist/receptionist.service';
import SearchInput from '../../common/SearchInput/SearchInput';
import Table from '../../common/Table/Table';
import Modal from '../../common/Modal/Modal';
import Button from '../../common/Button/Button';
import Input from '../../common/Input/Input';
import PermissionEditor from '../PermissionEditor/PermissionEditor';

const AccessStatusBadge = ({ permissions }) => {
  const count = Array.isArray(permissions) ? permissions.length : 0;
  const label = count === 0 ? 'No access' : `${count} grant${count === 1 ? '' : 's'}`;
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
        count === 0
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
      }`}
    >
      {label}
    </span>
  );
};

// Manage which Admin modules each receptionist can open. Assignments are saved
// to the receptionist profile in the database and reloaded on every session
// (login + refresh). The backend validates every value against the catalogue and
// re-checks grants on every API call before serving anything.
const ReceptionistAccess = () => {
  const [search, setSearch] = useState('');
  const [receptionists, setReceptionists] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editTarget, setEditTarget] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [saving, setSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState(null);
  const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '' });
  const [resetErrors, setResetErrors] = useState({});
  const [resetting, setResetting] = useState(false);

  const fetchReceptionists = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: 1, limit: 100 };
      if (search.trim()) params.search = search.trim();
      const res = await receptionistService.getReceptionists(params);
      setReceptionists(res?.data?.receptionists || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load receptionists');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // Matching the codebase's standard fetch-on-mount pattern for list pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReceptionists();
  }, [fetchReceptionists]);

  const openEditor = (r) => {
    setEditTarget(r);
    setPermissions(Array.isArray(r.permissions) ? [...r.permissions] : []);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await receptionistService.updateReceptionistPermissions(editTarget.id, permissions);
      toast.success(`Permissions updated for ${res?.data?.receptionist?.fullName || 'this receptionist'}`);
      setEditTarget(null);
      fetchReceptionists();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const openResetPassword = (r) => {
    setResetForm({ newPassword: '', confirmPassword: '' });
    setResetErrors({});
    setResetTarget(r);
  };

  const closeResetPassword = () => {
    if (resetting) return;
    setResetTarget(null);
    setResetForm({ newPassword: '', confirmPassword: '' });
    setResetErrors({});
  };

  const handleResetPasswordChange = (e) => {
    const { name, value } = e.target;
    setResetForm((prev) => ({ ...prev, [name]: value }));
  };

  // Client-side validation mirrors the backend rules (6-128 chars, must match).
  // The actual reset call is Admin-only on the server; this form is never
  // rendered for receptionists because the whole module is Admin-only.
  const handleResetPassword = async () => {
    if (!resetTarget) return;
    const nextErrors = {};
    if (!resetForm.newPassword) {
      nextErrors.newPassword = 'New password is required';
    } else if (resetForm.newPassword.length < 6) {
      nextErrors.newPassword = 'Password must be at least 6 characters';
    } else if (resetForm.newPassword.length > 128) {
      nextErrors.newPassword = 'Password must be at most 128 characters';
    }
    if (!resetForm.confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm the password';
    } else if (resetForm.confirmPassword !== resetForm.newPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }
    setResetErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setResetting(true);
    try {
      const res = await receptionistService.resetReceptionistPassword(resetTarget.id, resetForm.newPassword);
      toast.success(`Password reset for ${res?.data?.receptionist?.fullName || 'this receptionist'}`);
      closeResetPassword();
      fetchReceptionists();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
      setResetting(false);
    }
  };

  const columns = [
    { key: 'receptionistId', label: 'Receptionist ID' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'status', label: 'Status' },
    { key: 'grants', label: 'Current Access' },
    { key: 'actions', label: 'Actions', className: 'text-right' },
  ];

  const renderRow = (r) => (
    <>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{r.receptionistId}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{r.fullName}</td>
      <td className="px-4 py-3">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            r.isActive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
          }`}
        >
          {r.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3">
        <AccessStatusBadge permissions={r.permissions} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
            onClick={() => openEditor(r)}
          >
            <ShieldCheckIcon className="h-4 w-4" /> Manage Access
          </button>
          <button
            title="Set a new password (Admin only)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors cursor-pointer"
            onClick={() => openResetPassword(r)}
          >
            <LockClosedIcon className="h-4 w-4" /> Reset Password
          </button>
        </div>
      </td>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1">
          <SearchInput placeholder="Search receptionists" value={search} onChange={setSearch} />
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5">
        <strong>Note:</strong> permissions take effect immediately and persist
        across sessions. A receptionist can never edit their own (or any other
        receptionist&apos;s) access, or reset their own (or any other
        receptionist&apos;s) password - only an Admin can.
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-sm">Loading receptionists...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <Table columns={columns} data={receptionists} renderRow={renderRow} />
        </div>
      )}

      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Module Access - ${editTarget?.fullName || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Grant whole Admin modules (one checkbox per module) or granular
            sub-pages. To revoke everything, untick all checkboxes and save.
          </p>
          <PermissionEditor
            key={editTarget?.id || 'new-receptionist'}
            value={permissions}
            onChange={setPermissions}
            busy={saving}
          />
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="button" loading={saving} onClick={handleSave}>
              Save Permissions
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!resetTarget}
        onClose={closeResetPassword}
        title={`Reset Password - ${resetTarget?.fullName || ''}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Set a new password for <strong>{resetTarget?.receptionistId || 'this receptionist'}</strong>.
            The password is stored hashed and is never shown again; this action
            can only be performed by an Admin.
          </p>
          <Input
            label="New Password"
            name="newPassword"
            type="password"
            required
            value={resetForm.newPassword}
            onChange={handleResetPasswordChange}
            error={resetErrors.newPassword}
            placeholder="At least 6 characters"
          />
          <Input
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            required
            value={resetForm.confirmPassword}
            onChange={handleResetPasswordChange}
            error={resetErrors.confirmPassword}
            placeholder="Re-enter the new password"
          />
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={closeResetPassword} disabled={resetting}>
              Cancel
            </Button>
            <Button type="button" loading={resetting} onClick={handleResetPassword}>
              Reset Password
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReceptionistAccess;