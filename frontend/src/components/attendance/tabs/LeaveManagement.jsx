import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, ClockIcon, CalendarDaysIcon, UserGroupIcon,
  EyeIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, ArrowPathIcon,
  ChevronDownIcon, XMarkIcon, PlusIcon,
} from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import SelectInput from '../../common/SelectInput/SelectInput';
import DateInput from '../../common/DateInput/DateInput';
import Modal from '../../common/Modal/Modal';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import Spinner from '../../common/Spinner/Spinner';
import Button from '../../common/Button/Button';
import { ACADEMIC_YEARS } from '../../../utils/classNames';
import leaveService from '../../../services/leave/leave.service';
import studentService from '../../../services/student/student.service';
import teacherService from '../../../services/teacher/teacher.service';
import { useTranslation } from '../../../hooks/useLocalization';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';

const PAGE_SIZE = 10;
const FILTER_STATUS_OPTIONS = ['All', 'Pending', 'Approved', 'Rejected'];
const FILTER_TYPE_OPTIONS = ['All', 'Student', 'Teacher'];
const CREATE_TYPE_OPTIONS = ['Student', 'Teacher'];
const CREATE_STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected'];

const STATUS_STYLES = {
  Pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700',
  Approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  Rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
};

const STATUS_ICONS = {
  Pending: ClockIcon,
  Approved: CheckCircleIcon,
  Rejected: XCircleIcon,
};

function getInitials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Shared searchable Student/Teacher picker used by both the Create and Edit forms.
const PersonPicker = ({
  query, onQueryChange, results, searching, open, onOpenChange,
  selected, onSelect, onClear, label, placeholder, className = '',
}) => {
  const ref = useRef(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOpenChange(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onOpenChange]);

  return (
    <div ref={ref} className={`relative mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label} <span className="text-red-500">*</span>
        </label>
      )}

      {selected ? (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] ring-1 flex-shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 ring-yellow-400/50">
            {getInitials(selected.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{selected.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {selected.id}{selected.class ? ` • ${selected.class}` : ''}
              {selected.academicYear ? ` • ${selected.academicYear}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            title={label}
            className="p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 transition-colors cursor-pointer flex-shrink-0"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              placeholder={placeholder}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => onOpenChange(true)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-4 text-gray-400 dark:text-gray-500 text-xs">
                  <Spinner size="xs" /> {t('loading')}
                </div>
              ) : results.length > 0 ? (
                results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelect(p)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors cursor-pointer"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] ring-1 flex-shrink-0 ${
                      p.type === 'Teacher'
                        ? 'bg-gradient-to-br from-purple-500 to-purple-700 ring-purple-400/50'
                        : 'bg-gradient-to-br from-blue-500 to-blue-700 ring-yellow-400/50'
                    }`}>
                      {getInitials(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {p.id}{p.class ? ` • ${p.class}` : ''}{p.academicYear ? ` • ${p.academicYear}` : ''}
                      </p>
                    </div>
                  </button>
                ))
              ) : query.trim() ? (
                <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  {t('noPersonFound')}
                </div>
              ) : (
                <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  {t('typeToSearch')}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const LeaveManagement = () => {
  const { t } = useTranslation();
  const { academic } = useSchoolConfig();

  // ── Filters ─────────────────────────────────────────────
  const [type, setType] = useState('All');
  const [status, setStatus] = useState('All');
  const [academicYear, setAcademicYear] = useState('');
  const [search, setSearch] = useState('');

  // ── List state ──────────────────────────────────────────
  const [leaves, setLeaves] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // ── Create form ─────────────────────────────────────────
  const [formType, setFormType] = useState('Student');
  const [formYear, setFormYear] = useState(academic?.currentYear || '');
  const [formStatus, setFormStatus] = useState('Pending');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState([]);
  const [searchingPerson, setSearchingPerson] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  // ── Edit modal ──────────────────────────────────────────
  const [editTarget, setEditTarget] = useState(null);
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editSelected, setEditSelected] = useState(null);
  const [editPersonQuery, setEditPersonQuery] = useState('');
  const [editPersonResults, setEditPersonResults] = useState([]);
  const [editSearchingPerson, setEditSearchingPerson] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // ── View / confirm modals ───────────────────────────────
  const [viewLeave, setViewLeave] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const academicYearOptions = useMemo(() => {
    const values = new Set([academic?.currentYear, ...ACADEMIC_YEARS].filter(Boolean));
    return Array.from(values);
  }, [academic?.currentYear]);

  useEffect(() => {
    if (academic?.currentYear && !formYear) {
      setFormYear(academic.currentYear);
    }
  }, [academic?.currentYear, formYear]);

  // ── List loading ────────────────────────────────────────
  const buildFilters = () => ({
    type,
    status,
    academicYear: academicYear || undefined,
    search: search.trim() || undefined,
  });

  const fetchLeaves = async (page = 1, filters = {}) => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await leaveService.getLeaves({ ...filters, page, limit: PAGE_SIZE });
      setLeaves(result.leaves || []);
      const pg = result.pagination || { currentPage: page, totalPages: 1, totalItems: 0 };
      setPagination(pg);
      setCurrentPage(pg.currentPage || page);
    } catch (e) {
      setLoadError(e?.response?.data?.message || t('loadFailed'));
      setLeaves([]);
      setPagination({ currentPage: page, totalPages: 1, totalItems: 0 });
      setCurrentPage(page);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves(1, {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => fetchLeaves(1, buildFilters());

  const handleReset = () => {
    setType('All');
    setStatus('All');
    setAcademicYear('');
    setSearch('');
    fetchLeaves(1, {});
  };

  // ── Person search (Create) ──────────────────────────────
  const handlePersonOpenChange = useCallback((v) => setPersonOpen(v), []);
  const handleEditPersonOpenChange = useCallback((v) => setEditPersonOpen(v), []);

  const searchPersons = async (query, pickerType, setResults, setSearching) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      if (pickerType === 'Teacher') {
        const res = await teacherService.getAllTeachers({ search: query.trim(), status: 'Active', limit: 8 });
        const teachers = res?.data?.teachers || [];
        setResults(teachers.map((p) => ({
          type: 'Teacher',
          id: p.teacherId,
          ref: p._id,
          name: p.fullName,
          class: '',
          academicYear: p.academicYear,
          status: p.status,
        })));
      } else {
        const res = await studentService.getAllStudents({ search: query.trim(), status: 'Active', limit: 8 });
        const students = res?.data?.students || [];
        setResults(students.map((p) => ({
          type: 'Student',
          id: p.studentId,
          ref: p._id,
          name: p.fullName,
          class: p.class,
          academicYear: p.academicYear,
          status: p.status,
        })));
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const searchCreatePersons = useCallback(
    (query) => searchPersons(query, formType, setPersonResults, setSearchingPerson),
    [formType],
  );
  const searchEditPersons = useCallback(
    (query) => searchPersons(query, editSelected?.type || 'Student', setEditPersonResults, setEditSearchingPerson),
    [editSelected],
  );

  useEffect(() => {
    if (!personOpen) return;
    const id = setTimeout(() => searchCreatePersons(personQuery), 400);
    return () => clearTimeout(id);
  }, [personQuery, personOpen, searchCreatePersons]);

  useEffect(() => {
    if (!editPersonOpen) return;
    const id = setTimeout(() => searchEditPersons(editPersonQuery), 400);
    return () => clearTimeout(id);
  }, [editPersonQuery, editPersonOpen, searchEditPersons]);

  const handleFormTypeChange = (e) => {
    setFormType(e.target.value);
    setSelectedPerson(null);
    setPersonQuery('');
    setPersonResults([]);
    setPersonOpen(false);
  };

  const handleSelectPerson = (person) => {
    setSelectedPerson(person);
    setPersonQuery('');
    setPersonOpen(false);
    if (person.academicYear) setFormYear(person.academicYear);
  };

  const clearSelectedPerson = () => {
    setSelectedPerson(null);
    setPersonQuery('');
    setPersonResults([]);
  };

  // ── Create submit ───────────────────────────────────────
  const resetForm = () => {
    setFormType('Student');
    setFormYear(academic?.currentYear || '');
    setFormStatus('Pending');
    setFromDate('');
    setToDate('');
    setReason('');
    setFormError('');
    clearSelectedPerson();
  };

  const validateLeave = ({ person, year, from, to, leaveReason }) => {
    if (!person) return t('selectPersonRequired');
    if (!from || !to) return t('dateRangeRequired');
    if (to < from) return t('dateRangeInvalid');
    if (!leaveReason.trim()) return t('reasonRequired');
    if (person.academicYear && person.academicYear !== year) return t('yearMismatch');
    return '';
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const err = validateLeave({
      person: selectedPerson,
      year: formYear,
      from: fromDate,
      to: toDate,
      leaveReason: reason,
    });
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        type: selectedPerson.type,
        academicYear: formYear,
        fromDate,
        toDate,
        reason: reason.trim(),
        status: formStatus,
      };
      if (selectedPerson.type === 'Student') payload.studentId = selectedPerson.id;
      else payload.teacherId = selectedPerson.id;

      await leaveService.createLeave(payload);
      toast.success(t('leaveCreated'));
      resetForm();
      fetchLeaves(1, buildFilters());
    } catch (e2) {
      setFormError(e2?.response?.data?.message || t('operationFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────
  const openEdit = (leave) => {
    setEditTarget(leave);
    setEditFrom(leave.fromDate || '');
    setEditTo(leave.toDate || '');
    setEditReason(leave.reason || '');
    setEditYear(leave.academicYear || '');
    setEditSelected({
      type: leave.type,
      id: leave.personId,
      ref: leave.personRef,
      name: leave.name,
      class: leave.class,
      academicYear: leave.academicYear,
    });
    setEditPersonQuery('');
    setEditPersonResults([]);
    setEditPersonOpen(false);
    setEditError('');
  };

  const handleEditSelectPerson = (person) => {
    setEditSelected(person);
    setEditPersonQuery('');
    setEditPersonOpen(false);
    if (person.academicYear) setEditYear(person.academicYear);
  };

  const clearEditSelectedPerson = () => {
    setEditSelected(null);
    setEditPersonQuery('');
    setEditPersonResults([]);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const err = validateLeave({
      person: editSelected,
      year: editYear,
      from: editFrom,
      to: editTo,
      leaveReason: editReason,
    });
    if (err) {
      setEditError(err);
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      const payload = {
        type: editSelected.type,
        academicYear: editYear,
        fromDate: editFrom,
        toDate: editTo,
        reason: editReason.trim(),
      };
      if (editSelected.type === 'Student') payload.studentId = editSelected.id;
      else payload.teacherId = editSelected.id;

      await leaveService.updateLeave(editTarget.id, payload);
      toast.success(t('leaveUpdated'));
      setEditTarget(null);
      fetchLeaves(currentPage, buildFilters());
    } catch (e2) {
      setEditError(e2?.response?.data?.message || t('operationFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Approve / Reject / Delete ───────────────────────────
  const handleConfirm = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const { kind, leave } = confirmAction;
      if (kind === 'approve') await leaveService.approveLeave(leave.id);
      else if (kind === 'reject') await leaveService.rejectLeave(leave.id);
      else await leaveService.deleteLeave(leave.id);

      toast.success(t(kind === 'approve' ? 'leaveApproved' : kind === 'reject' ? 'leaveRejected' : 'leaveDeleted'));
      setConfirmAction(null);
      if (viewLeave && viewLeave.id === leave.id) setViewLeave(null);
      fetchLeaves(currentPage, buildFilters());
    } catch (e) {
      toast.error(e?.response?.data?.message || t('operationFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Derived UI ──────────────────────────────────────────
  const stats = useMemo(() => {
    const pending = leaves.filter((l) => l.status === 'Pending').length;
    const approved = leaves.filter((l) => l.status === 'Approved').length;
    const rejected = leaves.filter((l) => l.status === 'Rejected').length;
    return { total: pagination.totalItems, pending, approved, rejected };
  }, [leaves, pagination.totalItems]);

  const yearMin = formYear ? `${formYear}-01-01` : undefined;
  const yearMax = formYear ? `${formYear}-12-31` : undefined;
  const editYearMin = editYear ? `${editYear}-01-01` : undefined;
  const editYearMax = editYear ? `${editYear}-12-31` : undefined;

  const renderStatusBadge = (leaveStatus) => {
    const Icon = STATUS_ICONS[leaveStatus] || ClockIcon;
    const style = STATUS_STYLES[leaveStatus] || STATUS_STYLES.Pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${style}`}>
        <Icon className="h-3 w-3" />
        {leaveStatus}
      </span>
    );
  };

  const renderPersonAvatar = (record) => (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs ring-1 flex-shrink-0 ${
      record.type === 'Teacher'
        ? 'bg-gradient-to-br from-purple-500 to-purple-700 ring-purple-400/50'
        : 'bg-gradient-to-br from-blue-500 to-blue-700 ring-yellow-400/50'
    }`}>
      {getInitials(record.name)}
    </div>
  );

  const renderPagination = () => {
    if (leaves.length === 0) return null;
    const { totalPages } = pagination;
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) { start = 2; end = Math.min(4, totalPages - 1); }
      if (currentPage >= totalPages - 2) { start = Math.max(2, totalPages - 3); end = totalPages - 1; }
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {pagination.totalItems} {t('records')} &mdash; {t('page')} {currentPage} {t('of')} {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => fetchLeaves(currentPage - 1, buildFilters())}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {t('previous')}
          </button>
          {pages.map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-gray-400 dark:text-gray-500">...</span>
            ) : (
              <button
                key={page}
                onClick={() => fetchLeaves(page, buildFilters())}
                className={`min-w-[28px] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  currentPage === page
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            disabled={currentPage === totalPages}
            onClick={() => fetchLeaves(currentPage + 1, buildFilters())}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  };

  const confirmConfig = useMemo(() => {
    if (!confirmAction) return null;
    if (confirmAction.kind === 'approve') {
      return {
        title: t('approveLeave'),
        message: t('approveLeaveConfirm'),
        variant: 'primary',
        confirmLabel: t('approve'),
      };
    }
    if (confirmAction.kind === 'reject') {
      return {
        title: t('rejectLeave'),
        message: t('rejectLeaveConfirm'),
        variant: 'danger',
        confirmLabel: t('reject'),
      };
    }
    return {
      title: t('deleteLeave'),
      message: t('deleteLeaveConfirm'),
      variant: 'danger',
      confirmLabel: t('delete'),
    };
  }, [confirmAction, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('leaveManagementTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('leaveManagementSubtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={UserGroupIcon} label={t('totalLeaves')} value={stats.total} color="blue" />
        <StatCard icon={ClockIcon} label={t('pendingLeaves')} value={stats.pending} color="yellow" />
        <StatCard icon={CheckCircleIcon} label={t('approvedLeaves')} value={stats.approved} color="green" />
        <StatCard icon={XCircleIcon} label={t('rejectedLeaves')} value={stats.rejected} color="red" />
      </div>

      {/* Create Leave Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
          <PlusIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          {t('createLeave')}
        </h2>

        {formError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <XCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleCreate}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
            <SelectInput
              label={t('leaveType')}
              name="leaveType"
              value={formType}
              onChange={handleFormTypeChange}
              options={CREATE_TYPE_OPTIONS}
              required
            />
            <SelectInput
              label={t('academicYearLabel')}
              name="formYear"
              value={formYear}
              onChange={(e) => setFormYear(e.target.value)}
              options={academicYearOptions}
              placeholder={t('allYears')}
              required
            />
            <SelectInput
              label={t('statusLabel')}
              name="formStatus"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              options={CREATE_STATUS_OPTIONS}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
            <PersonPicker
              className="sm:col-span-3 lg:col-span-1"
              type={formType}
              label={formType === 'Teacher' ? t('selectTeacher') : t('selectStudent')}
              query={personQuery}
              onQueryChange={setPersonQuery}
              results={personResults}
              searching={searchingPerson}
              open={personOpen}
              onOpenChange={handlePersonOpenChange}
              selected={selectedPerson}
              onSelect={handleSelectPerson}
              onClear={clearSelectedPerson}
              placeholder={t('searchPersonPlaceholder')}
            />
            <DateInput
              label={t('fromDate')}
              name="fromDate"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
              min={yearMin}
              max={yearMax}
            />
            <DateInput
              label={t('toDate')}
              name="toDate"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
              min={yearMin}
              max={yearMax}
            />
          </div>

          <div className="grid grid-cols-1 gap-x-4">
            <div className="mb-4">
              <label htmlFor="leaveReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('reason')} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="leaveReason"
                rows={2}
                maxLength={500}
                placeholder={t('reasonPlaceholder')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Spinner size="xs" className="text-white" /> : <PlusIcon className="h-4 w-4" />}
              {saving ? t('saving') : t('createLeave')}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowPathIcon className="h-4 w-4" />
              {t('clear')}
            </button>
          </div>
        </form>
      </div>

      {/* Filters + Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('leaveType')}</label>
            <div className="relative">
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                {FILTER_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o === 'All' ? t('all') : o === 'Student' ? t('students') : t('teachers')}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('statusLabel')}</label>
            <div className="relative">
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                {FILTER_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'All' ? t('all') : s === 'Pending' ? t('pending') : s === 'Approved' ? t('approved') : t('rejected')}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('academicYearLabel')}</label>
            <div className="relative">
              <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                <option value="">{t('allYears')}</option>
                {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('searchNameOrId')}</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchNameOrId')}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button onClick={handleSearch}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer">
            <MagnifyingGlassIcon className="h-4 w-4" />
            {t('searchButton')}
          </button>
          <button onClick={handleReset}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer">
            <ArrowPathIcon className="h-4 w-4" />
            {t('reset')}
          </button>
        </div>
      </div>

      {/* Leave Records Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-auto">
        {loadError && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700/50 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <XCircleIcon className="h-4 w-4 flex-shrink-0" />
              {loadError}
            </span>
            <button
              onClick={() => fetchLeaves(currentPage, buildFilters())}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              {t('retry')}
            </button>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('photo')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('nameColumn')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('idColumn')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('type')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('classLabel')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('fromDate')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('toDate')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('reason')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('status')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading && leaves.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500">
                    <Spinner size="sm" />
                    <span className="text-sm">{t('loading')}</span>
                  </div>
                </td>
              </tr>
            ) : leaves.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <CalendarDaysIcon className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm">{t('noLeavesFound')}</p>
                    <p className="text-xs">{t('adjustFilters')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              leaves.map((record) => (
                <tr key={record.id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-3 py-3">{renderPersonAvatar(record)}</td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{record.name}</td>
                  <td className="px-3 py-3 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{record.personId}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                      record.type === 'Teacher'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                    }`}>
                      {record.type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{record.type === 'Student' ? (record.class || '—') : '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateDisplay(record.fromDate)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateDisplay(record.toDate)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
                    <p className="truncate" title={record.reason}>{record.reason}</p>
                  </td>
                  <td className="px-3 py-3">{renderStatusBadge(record.status)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewLeave(record)}
                        className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                        title={t('view')}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(record)}
                        className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer"
                        title={t('edit')}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      {record.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => setConfirmAction({ kind: 'approve', leave: record })}
                            className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors cursor-pointer"
                            title={t('approve')}
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmAction({ kind: 'reject', leave: record })}
                            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                            title={t('reject')}
                          >
                            <XCircleIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setConfirmAction({ kind: 'delete', leave: record })}
                        className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                        title={t('delete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {renderPagination()}
      </div>

      {/* View Details Modal */}
      <Modal isOpen={!!viewLeave} onClose={() => setViewLeave(null)} title={t('leaveDetails')} maxWidth="max-w-lg">
        {viewLeave && (
          <div>
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ring-2 ${
                viewLeave.type === 'Teacher'
                  ? 'bg-gradient-to-br from-purple-500 to-purple-700 ring-purple-400/50'
                  : 'bg-gradient-to-br from-blue-500 to-blue-700 ring-yellow-400/50'
              }`}>
                {getInitials(viewLeave.name)}
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{viewLeave.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{viewLeave.personId}</p>
              </div>
              <div className="ml-auto">{renderStatusBadge(viewLeave.status)}</div>
            </div>

            <div className="space-y-3">
              {[
                [t('leaveType'), viewLeave.type],
                [t('classLabel'), viewLeave.type === 'Student' ? (viewLeave.class || '—') : '—'],
                [t('academicYearLabel'), viewLeave.academicYear || '—'],
                [t('fromDate'), formatDateDisplay(viewLeave.fromDate)],
                [t('toDate'), formatDateDisplay(viewLeave.toDate)],
                [t('reason'), viewLeave.reason || '—'],
                [t('requestedBy'), viewLeave.requestedBy || '—'],
                [t('approvedBy'), viewLeave.approvedBy || '—'],
                [t('createdOn'), formatDateTime(viewLeave.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-start gap-3 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200 text-right break-words">{value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setViewLeave(null)}
                className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
              >
                {t('close')}
              </button>
              {viewLeave.status === 'Pending' && (
                <>
                  <button
                    onClick={() => {
                      const leave = viewLeave;
                      setViewLeave(null);
                      setConfirmAction({ kind: 'approve', leave });
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5" /> {t('approve')}
                  </button>
                  <button
                    onClick={() => {
                      const leave = viewLeave;
                      setViewLeave(null);
                      setConfirmAction({ kind: 'reject', leave });
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <XCircleIcon className="h-3.5 w-3.5" /> {t('reject')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={t('editLeave')} maxWidth="max-w-2xl">
        {editTarget && (
          <form onSubmit={handleEditSubmit}>
            {editError && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <XCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
              <SelectInput
                label={t('leaveType')}
                name="editType"
                value={editSelected?.type || 'Student'}
                onChange={() => {}}
                options={editSelected ? [editSelected.type] : ['Student']}
                disabled
                required
              />
              <SelectInput
                label={t('academicYearLabel')}
                name="editYear"
                value={editYear}
                onChange={(e) => setEditYear(e.target.value)}
                options={academicYearOptions}
                placeholder={t('allYears')}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
              <PersonPicker
                className="sm:col-span-3 lg:col-span-1"
                type={editSelected?.type || 'Student'}
                label={editSelected?.type === 'Teacher' ? t('selectTeacher') : t('selectStudent')}
                query={editPersonQuery}
                onQueryChange={setEditPersonQuery}
                results={editPersonResults}
                searching={editSearchingPerson}
                open={editPersonOpen}
                onOpenChange={handleEditPersonOpenChange}
                selected={editSelected}
                onSelect={handleEditSelectPerson}
                onClear={clearEditSelectedPerson}
                placeholder={t('searchPersonPlaceholder')}
              />
              <DateInput
                label={t('fromDate')}
                name="editFromDate"
                value={editFrom}
                onChange={(e) => setEditFrom(e.target.value)}
                required
                min={editYearMin}
                max={editYearMax}
              />
              <DateInput
                label={t('toDate')}
                name="editToDate"
                value={editTo}
                onChange={(e) => setEditTo(e.target.value)}
                required
                min={editYearMin}
                max={editYearMax}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="editLeaveReason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('reason')} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="editLeaveReason"
                rows={3}
                maxLength={500}
                placeholder={t('reasonPlaceholder')}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditTarget(null)}
                disabled={savingEdit}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                loading={savingEdit}
              >
                {t('save')}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Approve / Reject / Delete */}
      <ConfirmationModal
        isOpen={!!confirmAction}
        onClose={() => !actionLoading && setConfirmAction(null)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmLabel={confirmConfig?.confirmLabel}
        cancelLabel={t('cancel')}
        onConfirm={handleConfirm}
        variant={confirmConfig?.variant}
        loading={actionLoading}
      />
    </div>
  );
};

export default LeaveManagement;