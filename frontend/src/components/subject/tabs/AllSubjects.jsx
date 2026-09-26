import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../hooks/useLocalization';
import { BookOpenIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import FilterDropdown from '../../common/FilterDropdown/FilterDropdown';
import SearchInput from '../../common/SearchInput/SearchInput';
import ViewToggle from '../../common/ViewToggle/ViewToggle';
import Table from '../../common/Table/Table';
import StatusBadge from '../../common/StatusBadge/StatusBadge';
import ActionButtons from '../../common/ActionButtons/ActionButtons';
import SubjectCard from '../../common/SubjectCard/SubjectCard';
import SubjectViewModal from '../../common/SubjectViewModal/SubjectViewModal';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import subjectService from '../../../services/subject/subject.service';

const ITEMS_PER_PAGE = 10;

const AllSubjects = ({ onViewDetails, onEditSubject, selectedSubject, onCloseView }) => {
  const { t } = useTranslation();
  const statusOptions = [t('all'), t('active'), t('inactive')];
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(t('all'));
  const [currentPage, setCurrentPage] = useState(1);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingSubject, setDeletingSubject] = useState(null);

  const fetchSubjects = async () => {
    try {
      const result = await subjectService.getAllSubjects();
      setSubjects(result.data?.subjects || []);
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToLoad');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSubjects();
  }, []);

  const filteredSubjects = subjects.filter((s) => {
    if (search && !s.subjectName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== t('all') && s.status !== statusFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredSubjects.length / ITEMS_PER_PAGE);
  const paginatedSubjects = filteredSubjects.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleReset = () => {
    setStatusFilter(t('all'));
    setSearch('');
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!deletingSubject) return;

    try {
      await subjectService.deleteSubject(deletingSubject._id);
      toast.success(t('deletedSuccessfully'));
      setDeletingSubject(null);
      setLoading(true);
      await fetchSubjects();
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToDelete');
      toast.error(msg);
    }
  };

  const totalSubjects = subjects.length;
  const activeSubjects = subjects.filter((s) => s.status === 'Active').length;
  const inactiveSubjects = subjects.filter((s) => s.status === 'Inactive').length;

  const tableColumns = [
    { key: 'subjectName', label: t('subjectName') },
    { key: 'subjectCode', label: t('subjectCode') },
    { key: 'classes', label: t('classSubjectAssignment') },
    { key: 'status', label: t('status') },
    { key: 'actions', label: t('actions'), className: 'text-right' },
  ];

  const renderTableRow = (subject) => (
    <>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/50 flex-shrink-0">
            {subject.subjectName?.slice(0, 2).toUpperCase() || 'SB'}
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{subject.subjectName}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{subject.subjectCode}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{subject.assignedClassesCount || 0}</td>
      <td className="px-4 py-3">
        <StatusBadge status={subject.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <ActionButtons
          onView={() => onViewDetails(subject)}
          onEdit={() => onEditSubject(subject)}
          onDelete={() => setDeletingSubject(subject)}
        />
      </td>
    </>
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {Math.min(filteredSubjects.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}&ndash;{Math.min(currentPage * ITEMS_PER_PAGE, filteredSubjects.length)} {t('of')} {filteredSubjects.length}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {t('previous')}
          </button>
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                currentPage === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-gray-500">
        <p className="text-sm">{t('loadingSubjects')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('allSubjects')}</h1>
        <div className="w-full sm:w-56">
          <SearchInput
            placeholder={t('search')}
            value={search}
            onChange={(v) => { setSearch(v); setCurrentPage(1); }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={BookOpenIcon} label={t('total') + ' ' + t('subject') + 's'} value={totalSubjects} color="blue" />
        <StatCard icon={CheckCircleIcon} label={t('active') + ' ' + t('subject') + 's'} value={activeSubjects} color="green" />
        <StatCard icon={XCircleIcon} label={t('inactive') + ' ' + t('subject') + 's'} value={inactiveSubjects} color="red" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
        <div className="w-full sm:w-36">
          <FilterDropdown
            label={t('status')}
            options={statusOptions}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
          />
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer sm:self-end"
        >
          <ArrowPathIcon className="h-4 w-4" />
          {t('reset')}
        </button>
        <div className="sm:ml-auto">
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {view === 'table' ? (
        <>
          {filteredSubjects.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <Table columns={tableColumns} data={paginatedSubjects} renderRow={renderTableRow} />
            </div>
          ) : (
            <>
              <Table columns={tableColumns} data={paginatedSubjects} renderRow={renderTableRow} />
              {renderPagination()}
            </>
          )}
        </>
      ) : (
        <>
          {paginatedSubjects.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-sm">{t('noSubjects')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {paginatedSubjects.map((subject) => (
                  <SubjectCard
                    key={subject._id}
                    subject={subject}
                    onView={() => onViewDetails(subject)}
                    onEdit={() => onEditSubject(subject)}
                    onDelete={() => setDeletingSubject(subject)}
                  />
                ))}
              </div>
              {renderPagination()}
            </>
          )}
        </>
      )}

      <SubjectViewModal
        subject={selectedSubject}
        isOpen={!!selectedSubject}
        onClose={onCloseView}
      />

      <ConfirmationModal
        isOpen={!!deletingSubject}
        onClose={() => setDeletingSubject(null)}
        title={t('delete')}
        message={t('confirmDelete')}
        confirmLabel={t('confirmDeleteLabel')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default AllSubjects;
