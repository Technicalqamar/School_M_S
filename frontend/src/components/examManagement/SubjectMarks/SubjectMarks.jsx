import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import SearchInput from '../../common/SearchInput/SearchInput';
import Table from '../../common/Table/Table';
import ActionButtons from '../../common/ActionButtons/ActionButtons';
import Modal from '../../common/Modal/Modal';
import SelectInput from '../../common/SelectInput/SelectInput';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import examSubjectService from '../../../services/examSubject/examSubject.service';
import examService from '../../../services/exam/exam.service';
import subjectService from '../../../services/subject/subject.service';
import { optionId, buildIdOptions, buildIdOptionValue } from '../../../services/exam/optionUtils';
import { CLASS_NAMES } from '../../../utils/classNames';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';

const ITEMS_PER_PAGE = 10;
const STATUS_OPTIONS = ['Active', 'Inactive'];

const initialForm = {
  examId: '',
  subjectId: '',
  academicYear: '',
  className: '',
  totalMarks: '',
  passingMarks: '',
  description: '',
  status: 'Active',
};

const examLabel = (exam) => `${exam.name} (${exam.type})`;
const subjectLabel = (subject) => subject.subjectName;

const SubjectMarks = () => {
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterExam, setFilterExam] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, currentPage: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef(null);

  const { academic } = useSchoolConfig();

  const centralYear = academic?.currentYear || '';
  const centralYearOptions = centralYear ? [centralYear] : [];

  const formYearOptions = useMemo(() => {
    const base = centralYear ? [centralYear] : [];
    return form.academicYear && !base.includes(form.academicYear) ? [...base, form.academicYear] : base;
  }, [centralYear, form.academicYear]);

  const [exams, setExams] = useState([]);
  const [classAssignments, setClassAssignments] = useState([]);

  useEffect(() => {
    let mounted = true;
    examService.getAllExams({ limit: 100 }).then((res) => {
      if (mounted) setExams((res.data?.exams || []).filter((exam) => exam.type !== 'Monthly Test'));
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!form.className || !form.academicYear) return undefined;
    const timer = setTimeout(() => {
      subjectService
        .getClassAssignments(form.className, form.academicYear)
        .then((res) => {
          if (mounted) setClassAssignments(res.data?.assignedSubjects || []);
        })
        .catch(() => {
          if (mounted) setClassAssignments([]);
        });
    }, 0);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [form.className, form.academicYear]);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = { page: currentPage, limit: ITEMS_PER_PAGE };
      if (search.trim()) params.search = search.trim();
      if (centralYear) params.academicYear = centralYear;
      if (filterClass) params.className = filterClass;
      if (filterExam) params.examId = filterExam;
      if (filterStatus) params.status = filterStatus;

      const result = await examSubjectService.getAllExamSubjects(params);
      setData(result.data?.examSubjects || []);
      setPagination(result.data?.pagination || { total: 0, totalPages: 0, currentPage: 1 });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load subject marks';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, centralYear, filterClass, filterExam, filterStatus]);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      fetchSubjects();
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [fetchSubjects]);

  const yearExams = useMemo(
    () => (centralYear ? exams.filter((e) => String(e.academicYear) === centralYear) : exams),
    [exams, centralYear],
  );

  const examOptions = useMemo(() => buildIdOptions(yearExams, examLabel), [yearExams]);
  const examOptionValue = useMemo(() => buildIdOptionValue(yearExams, form.examId, examLabel), [yearExams, form.examId]);
  const examFilterOptionValue = useMemo(() => buildIdOptionValue(yearExams, filterExam, examLabel), [yearExams, filterExam]);

  const availableSubjects = useMemo(() => {
    if (form.academicYear && form.className) {
      return classAssignments || [];
    }
    return [];
  }, [form.academicYear, form.className, classAssignments]);

  const availableClassNames = useMemo(() => {
    if (form.examId) {
      const exam = exams.find((e) => String(e._id) === String(form.examId));
      if (exam && Array.isArray(exam.classes) && exam.classes.length > 0) {
        return exam.classes;
      }
    }
    return CLASS_NAMES;
  }, [form.examId, exams]);

  const subjectOptions = useMemo(() => buildIdOptions(availableSubjects, subjectLabel), [availableSubjects]);
  const subjectOptionValue = useMemo(
    () => buildIdOptionValue(availableSubjects, form.subjectId, subjectLabel),
    [availableSubjects, form.subjectId],
  );

  const getExamName = (item) => {
    if (item && item.examId && typeof item.examId === 'object' && item.examId._id) return item.examId.name || '-';
    return '-';
  };

  const getSubjectName = (item) => {
    if (item && item.subjectId && typeof item.subjectId === 'object' && item.subjectId._id) return item.subjectId.subjectName || '-';
    return '-';
  };

  const getSubjectCode = (item) => {
    if (item && item.subjectId && typeof item.subjectId === 'object' && item.subjectId._id) return item.subjectId.subjectCode || '-';
    return '-';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleExamChange = (e) => {
    const examId = optionId(e.target.value);
    const exam = exams.find((ex) => String(ex._id) === String(examId));
    setForm((prev) => ({
      ...prev,
      examId,
      academicYear: exam ? String(exam.academicYear) : prev.academicYear,
      className: '',
      subjectId: '',
    }));
    if (errors.examId) setErrors((prev) => ({ ...prev, examId: '' }));
  };

  const handleSubjectChange = (e) => {
    const subjectId = optionId(e.target.value);
    setForm((prev) => ({ ...prev, subjectId }));
    if (errors.subjectId) setErrors((prev) => ({ ...prev, subjectId: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.examId) newErrors.examId = 'Exam is required';
    if (!form.subjectId) newErrors.subjectId = 'Subject is required';
    if (!form.academicYear) newErrors.academicYear = 'Academic year is required';
    if (!form.className) newErrors.className = 'Class is required';
    if (!form.totalMarks || isNaN(form.totalMarks) || Number(form.totalMarks) <= 0) {
      newErrors.totalMarks = 'Enter valid total marks';
    }
    if (form.passingMarks === '' || form.passingMarks === null || isNaN(form.passingMarks) || Number(form.passingMarks) < 0) {
      newErrors.passingMarks = 'Enter valid passing marks';
    }
    if (
      form.totalMarks &&
      form.passingMarks !== '' &&
      !isNaN(form.passingMarks) &&
      Number(form.passingMarks) > Number(form.totalMarks)
    ) {
      newErrors.passingMarks = 'Passing marks cannot exceed total marks';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        examId: form.examId,
        subjectId: form.subjectId,
        academicYear: form.academicYear,
        className: form.className,
        totalMarks: Number(form.totalMarks),
        passingMarks: Number(form.passingMarks),
        description: form.description.trim(),
        status: form.status,
      };

      if (editItem) {
        await examSubjectService.updateExamSubject(editItem._id, payload);
        toast.success('Subject updated successfully');
      } else {
        await examSubjectService.createExamSubject(payload);
        toast.success('Subject added successfully');
      }
      closeModal();
      await fetchSubjects();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save subject';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...initialForm, academicYear: centralYear });
    setErrors({});
    setShowModal(true);
  };

  const openView = (item) => {
    setViewItem(item);
    setShowViewModal(true);
  };

  const openEdit = (item) => {
    const examId = item.examId && typeof item.examId === 'object' && item.examId._id ? item.examId._id : item.examId;
    const subjectId = item.subjectId && typeof item.subjectId === 'object' && item.subjectId._id ? item.subjectId._id : item.subjectId;
    setEditItem(item);
    setForm({
      examId,
      subjectId,
      academicYear: item.academicYear,
      className: item.className,
      totalMarks: String(item.totalMarks),
      passingMarks: String(item.passingMarks),
      description: item.description || '',
      status: item.status,
    });
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
    setForm({ ...initialForm, academicYear: centralYear });
    setErrors({});
  };

  const handleDelete = (item) => {
    setDeleteItem(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await examSubjectService.deleteExamSubject(deleteItem._id);
      toast.success('Subject deleted successfully');
      setShowDeleteModal(false);
      setDeleteItem(null);
      await fetchSubjects();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete subject';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setCurrentPage(1);
  };

  const handleExamFilterChange = (e) => {
    setFilterExam(optionId(e.target.value));
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearch('');
    setFilterClass('');
    setFilterExam('');
    setFilterStatus('');
    setCurrentPage(1);
  };

  const tableColumns = [
    { key: 'subjectName', label: 'Subject Name' },
    { key: 'subjectCode', label: 'Code' },
    { key: 'className', label: 'Class' },
    { key: 'examId', label: 'Exam' },
    { key: 'academicYear', label: 'Year' },
    { key: 'totalMarks', label: 'Total' },
    { key: 'passingMarks', label: 'Pass' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', className: 'text-right' },
  ];

  const renderRow = (item) => (
    <>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900 dark:text-white">{getSubjectName(item)}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{getSubjectCode(item)}</span>
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.className}</td>
      <td className="px-4 py-3">
        <span className="text-xs text-gray-600 dark:text-gray-400">{getExamName(item)}</span>
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.academicYear}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.totalMarks}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.passingMarks}</td>
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

  const totalPages = pagination.totalPages || 1;

  const renderPagination = () => (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Showing {(data.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1)}
        {data.length > 0 ? `–${Math.min(currentPage * ITEMS_PER_PAGE, (currentPage - 1) * ITEMS_PER_PAGE + data.length)}` : ''}{' '}
        of {pagination.total} configurations
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1 || loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Previous
        </button>
        <span className="text-xs text-gray-600 dark:text-gray-400">Page {currentPage} of {totalPages}</span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage >= totalPages || loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subjects & Marks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure subjects, total marks, and passing criteria for examinations.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <PlusIcon className="h-4 w-4" /> Add Subject
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
          <div className="lg:col-span-2">
            <SearchInput placeholder="Search subject or code..." value={search} onChange={handleSearchChange} />
          </div>
          <SelectInput
            name="filterYear"
            value={centralYear}
            disabled
            options={centralYearOptions}
            placeholder="Academic Year"
          />
          <SelectInput
            name="filterClass"
            value={filterClass}
            onChange={handleFilterChange(setFilterClass)}
            options={CLASS_NAMES}
            placeholder="Class"
          />
          <SelectInput
            name="filterExam"
            value={examFilterOptionValue}
            onChange={handleExamFilterChange}
            options={examOptions}
            placeholder="Exam"
          />
          <SelectInput
            name="filterStatus"
            value={filterStatus}
            onChange={handleFilterChange(setFilterStatus)}
            options={STATUS_OPTIONS}
            placeholder="Status"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <ArrowPathIcon className="h-4 w-4" /> Reset
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="text-center py-16">
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{loadError}</p>
            <button
              onClick={fetchSubjects}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <ArrowPathIcon className="h-4 w-4" /> Retry
            </button>
          </div>
        ) : data.length === 0 ? (
          <p className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
            No subject marks found. Adjust filters or add a new subject configuration.
          </p>
        ) : (
          <>
            <Table columns={tableColumns} data={data} renderRow={renderRow} />
            {renderPagination()}
          </>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editItem ? 'Edit Subject' : 'Add Subject'}
        maxWidth="max-w-xl"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {editItem ? 'Update the subject configuration.' : 'Configure a subject for an examination.'}
        </p>

        <SelectInput
          label="Exam"
          name="examId"
          value={examOptionValue}
          onChange={handleExamChange}
          options={examOptions}
          placeholder="Select exam"
          required
        />
        {errors.examId && <p className="text-xs text-red-600 dark:text-red-400 -mt-2 mb-3">{errors.examId}</p>}

        {editItem && form.examId && !examOptions.some((o) => optionId(o) === form.examId) && (
          <p className="text-xs text-amber-600 dark:text-amber-400 -mt-2 mb-3">
            The selected exam is {editItem.examId && typeof editItem.examId === 'object' && editItem.examId.name ? editItem.examId.name : 'not in the current list'}. You can change it.
          </p>
        )}

        <SelectInput
          label="Academic Year"
          name="academicYear"
          value={form.academicYear}
          onChange={handleChange}
          options={formYearOptions}
          placeholder="Select year"
          required
          disabled={Boolean(form.examId)}
        />
        {errors.academicYear && <p className="text-xs text-red-600 dark:text-red-400 -mt-2 mb-3">{errors.academicYear}</p>}

        <SelectInput
          label="Class"
          name="className"
          value={form.className}
          onChange={handleChange}
          options={availableClassNames}
          placeholder="Select class"
          required
        />
        {errors.className && <p className="text-xs text-red-600 dark:text-red-400 -mt-2 mb-3">{errors.className}</p>}

        <SelectInput
          label="Subject"
          name="subjectId"
          value={subjectOptionValue}
          onChange={handleSubjectChange}
          options={subjectOptions}
          placeholder="Select subject"
          required
        />
        {errors.subjectId && <p className="text-xs text-red-600 dark:text-red-400 -mt-2 mb-3">{errors.subjectId}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Total Marks"
            name="totalMarks"
            type="number"
            value={form.totalMarks}
            onChange={handleChange}
            placeholder="e.g. 100"
            required
            error={errors.totalMarks}
          />
          <Input
            label="Passing Marks"
            name="passingMarks"
            type="number"
            value={form.passingMarks}
            onChange={handleChange}
            placeholder="e.g. 40"
            required
            error={errors.passingMarks}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Description / Notes
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="Optional notes about this subject..."
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
          />
        </div>

        <SelectInput
          label="Status"
          name="status"
          value={form.status}
          onChange={handleChange}
          options={STATUS_OPTIONS}
          placeholder="Select status"
        />

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : editItem ? 'Update Subject' : 'Add Subject'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setViewItem(null); }}
        title="Subject Details"
        maxWidth="max-w-lg"
      >
        {viewItem && (
          <div className="space-y-5">
            <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">{getSubjectCode(viewItem)}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{getSubjectName(viewItem)}</h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                viewItem.status === 'Active'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {viewItem.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Academic Year</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.academicYear}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Class</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.className}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Exam</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{getExamName(viewItem)}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Subject Code</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{getSubjectCode(viewItem)}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Marks</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.totalMarks}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Passing Marks</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.passingMarks}</p>
              </div>
            </div>

            {viewItem.description && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{viewItem.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteItem(null); }}
        title="Delete Subject"
        message={`Are you sure you want to delete "${getSubjectName(deleteItem)}" configuration for ${deleteItem?.className}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  );
};

export default SubjectMarks;