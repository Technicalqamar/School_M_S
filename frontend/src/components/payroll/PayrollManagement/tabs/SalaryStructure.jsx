import { useState, useEffect } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import SearchInput from '../../../common/SearchInput/SearchInput';
import Table from '../../../common/Table/Table';
import ActionButtons from '../../../common/ActionButtons/ActionButtons';
import Modal from '../../../common/Modal/Modal';
import SelectInput from '../../../common/SelectInput/SelectInput';
import Input from '../../../common/Input/Input';
import DateInput from '../../../common/DateInput/DateInput';
import Button from '../../../common/Button/Button';
import ConfirmationModal from '../../../common/ConfirmationModal/ConfirmationModal';
import payrollService from '../../../../services/payroll/payroll.service';
import teacherService from '../../../../services/teacher/teacher.service';
import { useCurrency } from '../../../../hooks/useLocalization';

const SALARY_TYPE_OPTIONS = ['Monthly', 'Daily', 'Weekly', 'Hourly', 'Yearly'];
const STATUS_OPTIONS = ['Active', 'Inactive'];
const EMPTY_STATS = { totalStructures: 0, activeStructures: 0, inactiveStructures: 0 };

const initialForm = {
  teacherId: '',
  teacherName: '',
  salaryType: 'Monthly',
  basicSalary: '',
  effectiveFrom: '',
  status: 'Active',
};

// Format a date stored as YYYY-MM-DD (or ISO) as "01 Jun 2026" without timezone shifting.
const formatDate = (value) => {
  if (!value) return '—';
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value).slice(0, 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${match[3]} ${months[Number(match[2]) - 1]} ${match[1]}`;
};

const SalaryStructure = () => {
  const { formatCurrency } = useCurrency();

  const [search, setSearch] = useState('');
  const [data, setData] = useState([]);
  const [statistics, setStatistics] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  // Teacher search selection (real teacher data via existing teacher search API)
  const [teacherQuery, setTeacherQuery] = useState('');
  const [teacherResults, setTeacherResults] = useState([]);
  const [teacherSearching, setTeacherSearching] = useState(false);
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState(false);

  const fetchStructures = async () => {
    try {
      const result = await payrollService.getAllSalaryStructures();
      setData(result.data?.structures || []);
      setStatistics(result.data?.statistics || EMPTY_STATS);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Failed to load salary structures');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStructures();
  }, []);

  // Load/search real teachers for the Add form (existing teacher search conventions).
  useEffect(() => {
    if (!showModal || editItem) return undefined;

    let cancelled = false;
    const timer = setTimeout(
      () => {
        setTeacherSearching(true);
        teacherService
          .getAllTeachers({ search: teacherQuery.trim() || undefined, limit: 25 })
          .then((res) => {
            if (!cancelled) setTeacherResults(res.data?.teachers || []);
          })
          .catch(() => {
            if (!cancelled) setTeacherResults([]);
          })
          .finally(() => {
            if (!cancelled) setTeacherSearching(false);
          });
      },
      teacherQuery.trim() ? 400 : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showModal, editItem, teacherQuery]);

  const filtered = data.filter((item) => {
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    return (
      String(item.teacherId || '').toLowerCase().includes(query) ||
      String(item.teacher?.fullName || '').toLowerCase().includes(query)
    );
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.teacherId) newErrors.teacherId = 'Teacher is required';
    if (!form.basicSalary || isNaN(form.basicSalary) || Number(form.basicSalary) <= 0) {
      newErrors.basicSalary = 'Enter a valid positive salary';
    }
    if (!form.effectiveFrom) newErrors.effectiveFrom = 'Effective from date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    setForm(initialForm);
    setErrors({});
    setTeacherQuery('');
    setTeacherResults([]);
    setTeacherDropdownOpen(false);
  };

  const openAdd = () => {
    setEditItem(null);
    setForm(initialForm);
    setErrors({});
    setTeacherQuery('');
    setTeacherResults([]);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      teacherId: item.teacherId,
      teacherName: item.teacher?.fullName || '',
      salaryType: item.salaryType,
      basicSalary: String(item.basicSalary),
      effectiveFrom: String(item.effectiveFrom).slice(0, 10),
      status: item.status,
    });
    setErrors({});
    setTeacherQuery('');
    setTeacherResults([]);
    setShowModal(true);
  };

  const openView = (item) => {
    setViewItem(item);
    setShowViewModal(true);
  };

  const selectTeacher = (teacher) => {
    setForm((prev) => ({
      ...prev,
      teacherId: teacher.teacherId,
      teacherName: teacher.fullName,
    }));
    setTeacherQuery('');
    setTeacherDropdownOpen(false);
    if (errors.teacherId) setErrors((prev) => ({ ...prev, teacherId: '' }));
  };

  const clearTeacher = () => {
    setForm((prev) => ({ ...prev, teacherId: '', teacherName: '' }));
    setTeacherDropdownOpen(true);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    const payload = {
      teacherId: form.teacherId,
      salaryType: form.salaryType,
      basicSalary: Number(form.basicSalary),
      effectiveFrom: form.effectiveFrom,
      status: form.status,
    };

    try {
      if (editItem) {
        await payrollService.updateSalaryStructure(editItem._id, payload);
        toast.success('Salary structure updated successfully');
      } else {
        await payrollService.createSalaryStructure(payload);
        toast.success('Salary structure added successfully');
      }
      closeModal();
      await fetchStructures();
    } catch (err) {
      const msg =
        err.response?.data?.message || (editItem ? 'Failed to update salary structure' : 'Failed to add salary structure');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setDeleteItem(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await payrollService.deleteSalaryStructure(deleteItem._id);
      toast.success('Salary structure deleted successfully');
      setShowDeleteModal(false);
      setDeleteItem(null);
      await fetchStructures();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete salary structure';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const tableColumns = [
    { key: 'teacherId', label: 'Teacher ID' },
    { key: 'teacherName', label: 'Teacher Name' },
    { key: 'salaryType', label: 'Salary Type' },
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'effectiveFrom', label: 'Effective From' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', className: 'text-right' },
  ];

  const renderRow = (item) => (
    <>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900 dark:text-white">{item.teacherId}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {item.teacher?.fullName || '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.salaryType}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {formatCurrency(item.basicSalary)}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {formatDate(item.effectiveFrom)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            item.status === 'Active'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}
        >
          {item.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <ActionButtons onView={() => openView(item)} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item)} />
      </td>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Salary Structure</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Define and manage salary structures for each teacher. Only one active salary structure is allowed per teacher.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStructures}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <ArrowPathIcon className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={openAdd}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <PlusIcon className="h-4 w-4" /> Add Salary Structure
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={fetchStructures}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-sm">Loading salary structures...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Structures</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{statistics.totalStructures}</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Active</p>
              <p className="text-lg font-semibold text-green-700 dark:text-green-300">{statistics.activeStructures}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Inactive</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{statistics.inactiveStructures}</p>
            </div>
          </div>

          <div className="max-w-sm mb-4">
            <SearchInput placeholder="Search by Teacher ID or Name..." value={search} onChange={setSearch} />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <BanknotesIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600" />
              <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                {data.length === 0 ? 'No salary structures found' : 'No matching salary structures'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {data.length === 0
                  ? 'Add a salary structure for a teacher to get started.'
                  : 'Try adjusting your search.'}
              </p>
              {data.length === 0 && (
                <button
                  onClick={openAdd}
                  className="mt-4 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer mx-auto"
                >
                  <PlusIcon className="h-4 w-4" /> Add Salary Structure
                </button>
              )}
            </div>
          ) : (
            <Table columns={tableColumns} data={filtered} renderRow={renderRow} />
          )}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editItem ? 'Edit Salary Structure' : 'Add Salary Structure'}
        maxWidth="max-w-lg"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {editItem
            ? 'Update the salary details for this teacher.'
            : 'Create a salary structure for a teacher. Only one active structure per teacher is allowed.'}
        </p>

        {editItem ? (
          <div className="mb-4">
            <label htmlFor="teacherReadonly" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Teacher <span className="text-red-500">*</span>
            </label>
            <div
              id="teacherReadonly"
              className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-sm text-gray-500 dark:text-gray-400"
            >
              {editItem.teacher?.fullName || editItem.teacherId} · {editItem.teacherId}
            </div>
          </div>
        ) : (
          <div className="mb-4 relative">
            <label htmlFor="teacherSearch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Search Teacher <span className="text-red-500">*</span>
            </label>
            <input
              id="teacherSearch"
              type="text"
              value={teacherQuery}
              onChange={(e) => setTeacherQuery(e.target.value)}
              onFocus={() => setTeacherDropdownOpen(true)}
              onBlur={() => setTimeout(() => setTeacherDropdownOpen(false), 150)}
              placeholder="Search by Teacher ID or Name..."
              autoComplete="off"
              className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border text-sm transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-gray-400"
            />
            {teacherDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-60 overflow-y-auto">
                {teacherSearching ? (
                  <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">Searching teachers...</p>
                ) : teacherResults.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">No teachers found</p>
                ) : (
                  teacherResults.map((teacher) => (
                    <button
                      key={teacher._id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectTeacher(teacher);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <span className="block text-sm font-medium text-gray-800 dark:text-white">{teacher.fullName}</span>
                      <span className="block text-xs text-gray-400 dark:text-gray-500">{teacher.teacherId}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {form.teacherId && (
              <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
                  {form.teacherName} · {form.teacherId}
                </span>
                <button
                  type="button"
                  onClick={clearTeacher}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex-shrink-0"
                >
                  Clear
                </button>
              </div>
            )}
            {errors.teacherId && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.teacherId}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectInput
            label="Salary Type"
            name="salaryType"
            value={form.salaryType}
            onChange={handleChange}
            options={SALARY_TYPE_OPTIONS}
            required
          />
          <Input
            label="Basic Salary"
            name="basicSalary"
            type="number"
            min="1"
            step="any"
            value={form.basicSalary}
            onChange={handleChange}
            placeholder="0"
            required
            error={errors.basicSalary}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DateInput label="Effective From" name="effectiveFrom" value={form.effectiveFrom} onChange={handleChange} required />
          <SelectInput
            label="Status"
            name="status"
            value={form.status}
            onChange={handleChange}
            options={STATUS_OPTIONS}
            required
          />
        </div>
        {errors.effectiveFrom && (
          <p className="text-xs text-red-600 dark:text-red-400 -mt-2 mb-3">{errors.effectiveFrom}</p>
        )}

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={closeModal} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editItem ? 'Update Structure' : 'Add Structure'}
          </Button>
        </div>
      </Modal>

      {/* View modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewItem(null);
        }}
        title="Salary Structure Details"
        maxWidth="max-w-md"
      >
        {viewItem && (
          <div className="space-y-5">
            <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                {viewItem.teacher?.teacherImage ? (
                  <img
                    src={viewItem.teacher.teacherImage}
                    alt={viewItem.teacher?.fullName || 'Teacher'}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <UserIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {viewItem.teacher?.fullName || viewItem.teacherId}
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">{viewItem.teacherId}</p>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                  viewItem.status === 'Active'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {viewItem.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Salary Type</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.salaryType}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Basic Salary</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(viewItem.basicSalary)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Effective From</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(viewItem.effectiveFrom)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Status</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.status}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteItem(null);
        }}
        title="Delete Salary Structure"
        message={`Are you sure you want to delete the salary structure for "${
          deleteItem?.teacher?.fullName || deleteItem?.teacherId
        }"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default SalaryStructure;