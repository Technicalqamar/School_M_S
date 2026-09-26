import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import CardSection from '../../components/common/CardSection/CardSection';
import SearchInput from '../../components/common/SearchInput/SearchInput';
import Button from '../../components/common/Button/Button';
import Spinner from '../../components/common/Spinner/Spinner';
import Modal from '../../components/common/Modal/Modal';
import SelectInput from '../../components/common/SelectInput/SelectInput';
import FilterDropdown from '../../components/common/FilterDropdown/FilterDropdown';
import homeworkAssignmentsService from '../../services/teacher/homeworkAssignments.service';

const ASSIGNMENT_STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'];

const EMPTY_FORM = {
  className: '',
  subject: '',
  title: '',
  description: '',
  dueDate: '',
  status: 'Pending',
};

const inputCls =
  'w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';

const statusBadgeCls = (status) => {
  const map = {
    Pending: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
    'In Progress': 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800',
    Completed: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800',
    Overdue: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800',
  };
  return map[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700';
};

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-14">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <ClipboardDocumentListIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

const HomeworkAssignments = () => {
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState('');

  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [modalMode, setModalMode] = useState(null); // 'create' | 'view' | 'edit' | 'delete'
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    homeworkAssignmentsService
      .getAssignedContext()
      .then((result) => {
        if (!mounted) return;
        setAssignedClasses(result.classes);
      })
      .catch(() => {
        if (mounted) {
          setContextError('Failed to load your assigned classes');
          toast.error('Failed to load your assigned classes');
        }
      })
      .finally(() => {
        if (mounted) setContextLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const classOptions = useMemo(
    () => ['All', ...assignedClasses.map((cls) => cls.className)],
    [assignedClasses],
  );

  const subjectOptions = useMemo(() => {
    if (classFilter !== 'All') {
      const cls = assignedClasses.find((c) => c.className === classFilter);
      return ['All', ...(cls?.subjects.map((s) => s.subjectName) || [])];
    }
    const all = [];
    assignedClasses.forEach((cls) => {
      cls.subjects.forEach((s) => {
        if (!all.includes(s.subjectName)) all.push(s.subjectName);
      });
    });
    return ['All', ...all];
  }, [assignedClasses, classFilter]);

  const formSubjectOptions = useMemo(() => {
    const cls = assignedClasses.find((c) => c.className === form.className);
    return cls?.subjects.map((s) => s.subjectName) || [];
  }, [assignedClasses, form.className]);

  useEffect(() => {
    let mounted = true;

    const timer = setTimeout(() => {
      setError('');

      const params = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'All') params.status = statusFilter;

      const classCls = classFilter !== 'All' ? assignedClasses.find((c) => c.className === classFilter) : null;
      if (classCls?.classId) params.classId = classCls.classId;

      if (subjectFilter !== 'All') {
        const subjectPool = classCls
          ? classCls.subjects
          : assignedClasses.flatMap((c) => c.subjects);
        const subject = subjectPool.find((s) => s.subjectName === subjectFilter);
        if (subject?.id) params.subjectId = subject.id;
      }

      setIsLoading(true);

      homeworkAssignmentsService
        .getAssignments(params)
        .then((result) => {
          if (!mounted) return;
          setAssignments(result.assignments);
        })
        .catch(() => {
          if (mounted) {
            setError('Failed to load assignments');
          }
        })
        .finally(() => {
          if (mounted) setIsLoading(false);
        });
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [assignedClasses, search, classFilter, subjectFilter, statusFilter, reloadKey]);

  const openCreateModal = () => {
    setSelectedAssignment(null);
    setForm(EMPTY_FORM);
    setModalMode('create');
  };

  const openViewModal = (assignment) => {
    setSelectedAssignment(assignment);
    setModalMode('view');
  };

  const openEditModal = (assignment) => {
    setSelectedAssignment(assignment);
    setForm({
      className: assignment.className || '',
      subject: assignment.subject || '',
      title: assignment.title || '',
      description: assignment.description || '',
      dueDate: assignment.dueDate ? String(assignment.dueDate).slice(0, 10) : '',
      status: assignment.status || 'Pending',
    });
    setModalMode('edit');
  };

  const openDeleteModal = (assignment) => {
    setSelectedAssignment(assignment);
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedAssignment(null);
    setForm(EMPTY_FORM);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'className') {
        next.subject = '';
      }
      return next;
    });
  };

  const resolveFormIds = () => {
    const cls = assignedClasses.find((c) => c.className === form.className);
    const subject = cls?.subjects.find((s) => s.subjectName === form.subject);
    return { classId: cls?.classId, subjectId: subject?.id };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.className || !form.subject || !form.title.trim() || !form.dueDate) {
      toast.error('Please fill all required fields');
      return;
    }

    const { classId, subjectId } = resolveFormIds();

    if (!classId || !subjectId) {
      toast.error('Please select a valid class and subject');
      return;
    }

    const payload = {
      classId,
      subjectId,
      title: form.title.trim(),
      description: form.description,
      dueDate: form.dueDate,
      status: form.status,
    };

    setIsSubmitting(true);

    try {
      if (modalMode === 'edit') {
        await homeworkAssignmentsService.updateAssignment(selectedAssignment.id, payload);
        toast.success('Assignment updated successfully');
      } else {
        await homeworkAssignmentsService.createAssignment(payload);
        toast.success('Assignment created successfully');
      }
      closeModal();
      setReloadKey((k) => k + 1);
    } catch {
      toast.error(modalMode === 'edit' ? 'Failed to update assignment' : 'Failed to create assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsSubmitting(true);

    try {
      await homeworkAssignmentsService.deleteAssignment(selectedAssignment.id);
      toast.success('Assignment deleted successfully');
      closeModal();
      setReloadKey((k) => k + 1);
    } catch {
      toast.error('Failed to delete assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreate = assignedClasses.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Homework / Assignments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage homework and assignments for your classes.
          </p>
        </div>
        <Button variant="primary" className="md:w-auto shrink-0" onClick={openCreateModal}>
          <PlusIcon className="mr-2 h-4 w-4" /> Create Assignment
        </Button>
      </div>

      {contextLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
          <Spinner size="lg" className="text-blue-600" />
          <p className="text-sm">Loading your classes...</p>
        </div>
      ) : contextError ? (
        <CardSection>
          <div className="flex items-center justify-center py-10">
            <EmptyState title="Something went wrong" description={contextError + '. Please try again.'} />
          </div>
        </CardSection>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2 xl:col-span-1">
              <SearchInput placeholder="Search assignments..." value={search} onChange={setSearch} />
            </div>
            <FilterDropdown label="Class" options={classOptions} value={classFilter} onChange={setClassFilter} />
            <FilterDropdown label="Subject" options={subjectOptions} value={subjectFilter} onChange={setSubjectFilter} />
            <FilterDropdown
              label="Status"
              options={['All', ...ASSIGNMENT_STATUSES]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>

          {!canCreate && (
            <CardSection>
              <EmptyState
                title="No assigned classes"
                description="Admin has not assigned you any classes yet. Homework can be created once classes are assigned to you."
              />
            </CardSection>
          )}

          {canCreate && isLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
              <Spinner size="lg" className="text-blue-600" />
              <p className="text-sm">Loading assignments...</p>
            </div>
          )}

          {canCreate && !isLoading && error && (
            <CardSection>
              <div className="flex items-center justify-center py-10">
                <EmptyState title="Something went wrong" description={error + '. Please try again.'} />
              </div>
            </CardSection>
          )}

          {canCreate && !isLoading && !error && assignments.length === 0 && (
            <CardSection>
              <EmptyState
                title={
                  search || classFilter !== 'All' || subjectFilter !== 'All' || statusFilter !== 'All'
                    ? 'No matching assignments'
                    : 'No assignments yet'
                }
                description={
                  search || classFilter !== 'All' || subjectFilter !== 'All' || statusFilter !== 'All'
                    ? 'No assignments match your filters. Try a different search or filter.'
                    : 'Create your first assignment using the Create Assignment button above.'
                }
              />
            </CardSection>
          )}

          {canCreate && !isLoading && !error && assignments.length > 0 && (
            <CardSection>
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="py-3 pr-4">Assignment</th>
                      <th className="py-3 pr-4">Class</th>
                      <th className="py-3 pr-4">Subject</th>
                      <th className="py-3 pr-4">Due Date</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {assignments.map((item) => (
                      <tr key={item.id || item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{item.description}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{item.className}</td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{item.subject}</td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                          {item.dueDate ? String(item.dueDate).slice(0, 10) : '-'}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${statusBadgeCls(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openViewModal(item)}
                              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              aria-label="View assignment"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              aria-label="Edit assignment"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteModal(item)}
                              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                              aria-label="Delete assignment"
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
            </CardSection>
          )}
        </>
      )}

      {(modalMode === 'create' || modalMode === 'edit') && (
        <Modal
          isOpen
          onClose={closeModal}
          title={modalMode === 'edit' ? 'Edit Assignment' : 'Create Assignment'}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <SelectInput
              label="Class"
              name="className"
              value={form.className}
              onChange={(e) => handleFormChange('className', e.target.value)}
              options={assignedClasses.map((cls) => cls.className)}
              placeholder="Select class"
              required
            />
            <SelectInput
              label="Subject"
              name="subject"
              value={form.subject}
              onChange={(e) => handleFormChange('subject', e.target.value)}
              options={formSubjectOptions}
              placeholder={form.className ? 'Select subject' : 'Select class first'}
              required
              disabled={!form.className}
            />
            <div>
              <label htmlFor="assignmentTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Assignment Title <span className="text-red-500">*</span>
              </label>
              <input
                id="assignmentTitle"
                type="text"
                value={form.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                placeholder="e.g. Chapter 3 Exercise"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label htmlFor="assignmentDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Description / Instructions
              </label>
              <textarea
                id="assignmentDescription"
                value={form.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="Instructions and details for students..."
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label htmlFor="assignmentDueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                id="assignmentDueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => handleFormChange('dueDate', e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <SelectInput
              label="Status"
              name="status"
              value={form.status}
              onChange={(e) => handleFormChange('status', e.target.value)}
              options={ASSIGNMENT_STATUSES}
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" className="w-auto px-5" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="w-auto px-5" loading={isSubmitting}>
                {modalMode === 'edit' ? 'Save Changes' : 'Create Assignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {modalMode === 'view' && selectedAssignment && (
        <Modal isOpen onClose={closeModal} title="Assignment Details" maxWidth="max-w-lg">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Assignment Title</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedAssignment.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Class</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAssignment.className}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Subject</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAssignment.subject}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Due Date</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedAssignment.dueDate ? String(selectedAssignment.dueDate).slice(0, 10) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Status</p>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${statusBadgeCls(selectedAssignment.status)}`}>
                  {selectedAssignment.status}
                </span>
              </div>
            </div>
            {selectedAssignment.description && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">Description / Instructions</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedAssignment.description}</p>
              </div>
            )}
            <div className="flex items-center justify-end pt-2">
              <Button variant="secondary" className="w-auto px-5" onClick={closeModal}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {modalMode === 'delete' && selectedAssignment && (
        <Modal isOpen onClose={closeModal} title="Delete Assignment" maxWidth="max-w-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500 dark:text-red-400" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-white">"{selectedAssignment.title}"</span>?
                This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" className="w-auto px-5" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="danger" className="w-auto px-5" loading={isSubmitting} onClick={handleConfirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default HomeworkAssignments;