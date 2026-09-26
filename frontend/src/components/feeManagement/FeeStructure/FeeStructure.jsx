import { useState, useEffect } from 'react';
import { PlusIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import SearchInput from '../../common/SearchInput/SearchInput';
import Table from '../../common/Table/Table';
import ActionButtons from '../../common/ActionButtons/ActionButtons';
import Modal from '../../common/Modal/Modal';
import SelectInput from '../../common/SelectInput/SelectInput';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import feeService from '../../../services/fee/fee.service';

const CLASS_OPTIONS = ['Montessori', 'Nursery', 'KG1', 'KG2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const initialForm = { className: '', monthlyFee: '', admissionFee: '', examFee: '', status: 'Active' };

const FeeStructure = ({ onDataChange }) => {
  const [search, setSearch] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const fetchStructures = async () => {
    try {
      const result = await feeService.getAllFeeStructures();
      setData(result.data?.structures || []);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load fee structures';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStructures();
  }, []);

  const formatCurrency = (val) => `Rs. ${Number(val).toLocaleString()}`;

  const filtered = data.filter((item) =>
    item.className.toLowerCase().includes(search.toLowerCase())
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.className) newErrors.className = 'Class is required';
    if (!form.monthlyFee || isNaN(form.monthlyFee) || Number(form.monthlyFee) < 0) newErrors.monthlyFee = 'Enter a valid amount';
    if (!form.admissionFee || isNaN(form.admissionFee) || Number(form.admissionFee) < 0) newErrors.admissionFee = 'Enter a valid amount';
    if (!form.examFee || isNaN(form.examFee) || Number(form.examFee) < 0) newErrors.examFee = 'Enter a valid amount';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const structure = {
      className: form.className,
      monthlyFee: Number(form.monthlyFee),
      admissionFee: Number(form.admissionFee),
      examFee: Number(form.examFee),
      status: form.status,
    };
    try {
      if (editItem) {
        await feeService.updateFeeStructure(editItem._id, structure);
        toast.success('Fee structure updated successfully');
      } else {
        await feeService.createFeeStructure(structure);
        toast.success('Fee structure added successfully');
      }
      closeModal();
      onDataChange?.();
      setLoading(true);
      await fetchStructures();
    } catch (err) {
      const msg = err.response?.data?.message || (editItem ? 'Failed to update fee structure' : 'Failed to add fee structure');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm(initialForm);
    setErrors({});
    setShowModal(true);
  };

  const openView = (item) => {
    setViewItem(item);
    setShowViewModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      className: item.className,
      monthlyFee: String(item.monthlyFee),
      admissionFee: String(item.admissionFee),
      examFee: String(item.examFee),
      status: item.status,
    });
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    setForm(initialForm);
    setErrors({});
  };

  const handleDelete = (item) => {
    setDeleteItem(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await feeService.deleteFeeStructure(deleteItem._id);
      toast.success('Fee structure deleted successfully');
      setShowDeleteModal(false);
      setDeleteItem(null);
      onDataChange?.();
      setLoading(true);
      await fetchStructures();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete fee structure';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const tableColumns = [
    { key: 'className', label: 'Class' },
    { key: 'monthlyFee', label: 'Monthly Fee' },
    { key: 'admissionFee', label: 'Admission Fee' },
    { key: 'examFee', label: 'Exam Fee' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', className: 'text-right' },
  ];

  const renderRow = (item) => (
    <>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900 dark:text-white">{`Class ${item.className}`}</span>
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatCurrency(item.monthlyFee)}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatCurrency(item.admissionFee)}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatCurrency(item.examFee)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          item.status === 'Active'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fee Structure</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Define and manage fee structures for each class. Set monthly, admission, and exam fees.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <PlusIcon className="h-4 w-4" /> Add Structure
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        {loading ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-sm">Loading fee structures...</p>
          </div>
        ) : (
          <>
            <div className="max-w-sm mb-4">
              <SearchInput placeholder="Search by class..." value={search} onChange={setSearch} />
            </div>
            <Table columns={tableColumns} data={filtered} renderRow={renderRow} />
          </>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editItem ? 'Edit Fee Structure' : 'Add Fee Structure'}
        maxWidth="max-w-lg"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {editItem ? 'Update the fee amounts for this class.' : 'Define the fee structure for a class.'}
        </p>

        <div className="mb-4">
          <label htmlFor="className" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Select Class <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="className"
              name="className"
              value={form.className}
              onChange={handleChange}
              required
              disabled={!!editItem}
              className={`appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border text-sm transition-all ${
                editItem
                  ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer'
              }`}
            >
              <option value="" disabled>Choose a class</option>
              {CLASS_OPTIONS.map((cls) => (
                <option key={cls} value={cls}>{`Class ${cls}`}</option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
          </div>
        </div>
        {errors.className && <p className="text-xs text-red-600 dark:text-red-400 -mt-2 mb-3">{errors.className}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Monthly Fee"
            name="monthlyFee"
            type="number"
            value={form.monthlyFee}
            onChange={handleChange}
            placeholder="0"
            required
            error={errors.monthlyFee}
          />
          <Input
            label="Admission Fee"
            name="admissionFee"
            type="number"
            value={form.admissionFee}
            onChange={handleChange}
            placeholder="0"
            required
            error={errors.admissionFee}
          />
          <Input
            label="Exam Fee"
            name="examFee"
            type="number"
            value={form.examFee}
            onChange={handleChange}
            placeholder="0"
            required
            error={errors.examFee}
          />
        </div>

        <SelectInput
          label="Status"
          name="status"
          value={form.status}
          onChange={handleChange}
          options={['Active', 'Inactive']}
          placeholder="Select status"
        />

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editItem ? 'Update Structure' : 'Add Structure'}</Button>
        </div>
      </Modal>

      <Modal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setViewItem(null); }}
        title="Fee Structure Details"
        maxWidth="max-w-md"
      >
        {viewItem && (
          <div className="space-y-5">
            <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{viewItem.className}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{viewItem.className}</h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                viewItem.status === 'Active'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {viewItem.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Monthly Fee</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(viewItem.monthlyFee)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Admission Fee</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(viewItem.admissionFee)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Exam Fee</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(viewItem.examFee)}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteItem(null); }}
        title="Delete Fee Structure"
        message={`Are you sure you want to delete the fee structure for class "${deleteItem?.className}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default FeeStructure;
