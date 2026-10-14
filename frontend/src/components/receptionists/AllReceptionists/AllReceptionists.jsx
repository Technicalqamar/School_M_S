import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  PencilSquareIcon,
  PowerIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import receptionistService from '../../../services/receptionist/receptionist.service';
import SearchInput from '../../common/SearchInput/SearchInput';
import Table from '../../common/Table/Table';
import Modal from '../../common/Modal/Modal';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';

const StatusBadge = ({ status }) => (
  <span
    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
      status === 'Active'
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
    }`}
  >
    {status}
  </span>
);

const AllReceptionists = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [receptionists, setReceptionists] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, currentPage: 1 });
  const [loading, setLoading] = useState(true);

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', phone: '' });
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchReceptionists = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.currentPage, limit: 10 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await receptionistService.getReceptionists(params);
      setReceptionists(res?.data?.receptionists || []);
      setPagination(res?.data?.pagination || { total: 0, totalPages: 1, currentPage: 1 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load receptionists');
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, search, statusFilter]);

  useEffect(() => {
    // Matching the codebase's standard fetch-on-mount pattern for list pages.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReceptionists();
  }, [fetchReceptionists]);

  const openEdit = (r) => {
    setEditTarget(r);
    setEditForm({ fullName: r.fullName || '', email: r.email || '', phone: r.phone || '' });
    setEditErrors({});
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!editForm.fullName || editForm.fullName.trim().length < 3) {
      newErrors.fullName = 'Full name must be at least 3 characters';
    }
    if (Object.keys(newErrors).length > 0) {
      setEditErrors(newErrors);
      return;
    }
    setSaving(true);
    try {
      await receptionistService.updateReceptionist(editTarget.id, {
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
      });
      toast.success('Receptionist updated successfully');
      setEditTarget(null);
      fetchReceptionists();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update receptionist');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!statusTarget) return;
    setStatusLoading(true);
    try {
      const nextActive = statusTarget.isActive !== true;
      await receptionistService.updateReceptionistStatus(statusTarget.id, nextActive);
      toast.success(nextActive ? 'Receptionist activated' : 'Receptionist deactivated');
      setStatusTarget(null);
      fetchReceptionists();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await receptionistService.deleteReceptionist(deleteTarget.id);
      toast.success('Receptionist deleted successfully');
      setDeleteTarget(null);
      fetchReceptionists();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete receptionist');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'receptionistId', label: 'Receptionist ID' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'contact', label: 'Email / Phone' },
    { key: 'status', label: 'Status' },
    { key: 'lastLogin', label: 'Last Login' },
    { key: 'actions', label: 'Actions', className: 'text-right' },
  ];

  const renderRow = (r) => (
    <>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{r.receptionistId}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{r.fullName}</td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        <p>{r.email || '—'}</p>
        <p className="text-xs">{r.phone || '—'}</p>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={r.isActive ? 'Active' : 'Inactive'} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        {r.lastLogin ? new Date(r.lastLogin).toLocaleString() : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
            title="Edit receptionist"
            onClick={() => openEdit(r)}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              r.isActive
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
            }`}
            title={r.isActive ? 'Deactivate account' : 'Activate account'}
            onClick={() => setStatusTarget(r)}
          >
            <PowerIcon className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
            title="Delete receptionist"
            onClick={() => setDeleteTarget(r)}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </>
  );

  const pageButtons = [];
  for (let p = 1; p <= pagination.totalPages; p += 1) {
    pageButtons.push(
      <button
        key={p}
        onClick={() => setPagination((prev) => ({ ...prev, currentPage: p }))}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
          p === pagination.currentPage
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        {p}
      </button>,
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1">
          <SearchInput placeholder="Search by ID, name, email or phone" value={search} onChange={setSearch} />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
        >
          <option value="all">All statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
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

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          {pageButtons}
        </div>
      )}

      <Modal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit Receptionist - ${editTarget?.receptionistId || ''}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleEditSave} className="space-y-4">
          <Input
            label="Full Name"
            name="fullName"
            type="text"
            required
            value={editForm.fullName}
            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
            error={editErrors.fullName}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label="Phone"
            name="phone"
            type="text"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The login ID cannot be changed and the password cannot be reset from
            here - both were set by an Admin at creation.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmationModal
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title={statusTarget?.isActive ? 'Deactivate Receptionist' : 'Activate Receptionist'}
        message={`Are you sure you want to ${statusTarget?.isActive ? 'deactivate' : 'activate'} ${statusTarget?.fullName || 'this receptionist'}? Deactivated receptionists cannot sign in.`}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        variant={statusTarget?.isActive ? 'danger' : 'primary'}
        onConfirm={handleStatusToggle}
        loading={statusLoading}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Receptionist"
        message={`This permanently deletes ${deleteTarget?.fullName || 'this receptionist'}'s account and profile. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
};

export default AllReceptionists;