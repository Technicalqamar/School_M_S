import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../hooks/useLocalization';
import { BookOpenIcon, CheckCircleIcon, XCircleIcon, UsersIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import FilterDropdown from '../../common/FilterDropdown/FilterDropdown';
import SearchInput from '../../common/SearchInput/SearchInput';
import ViewToggle from '../../common/ViewToggle/ViewToggle';
import Table from '../../common/Table/Table';
import StatusBadge from '../../common/StatusBadge/StatusBadge';
import ActionButtons from '../../common/ActionButtons/ActionButtons';
import ClassCard from '../../common/ClassCard/ClassCard';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import classService from '../../../services/class/class.service';

const ITEMS_PER_PAGE = 10;

const AllClasses = ({ onViewDetails, onEditClass }) => {
  const { t } = useTranslation();
  const statusOptions = [t('all'), t('active'), t('inactive')];
  const [view, setView] = useState('table');
  const [academicYearFilter, setAcademicYearFilter] = useState(t('selectYear'));
  const [statusFilter, setStatusFilter] = useState(t('all'));
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingClass, setDeletingClass] = useState(null);

  const academicYearOptions = [
    t('selectYear'),
    ...[...new Set(classes.map((c) => c.academicYear).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  ];

  const fetchClasses = async () => {
    try {
      const result = await classService.getAllClasses();
      setClasses(result.data?.classes || []);
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToLoad');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClasses();
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchClasses();
      }
    };

    const handleFocus = () => {
      fetchClasses();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const filteredClasses = classes.filter((c) => {
    if (academicYearFilter !== t('selectYear') && c.academicYear !== academicYearFilter) return false;
    if (statusFilter !== t('all') && c.status !== statusFilter) return false;
    if (searchQuery && !c.className?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredClasses.length / ITEMS_PER_PAGE);
  const paginatedClasses = filteredClasses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleReset = () => {
    setAcademicYearFilter(t('selectYear'));
    setStatusFilter(t('all'));
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!deletingClass) return;

    try {
      await classService.deleteClass(deletingClass._id);
      toast.success(t('deletedSuccessfully'));
      setDeletingClass(null);
      setLoading(true);
      await fetchClasses();
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToDelete');
      toast.error(msg);
    }
  };

  const statistics = {
    totalClasses: classes.length,
    activeClasses: classes.filter((c) => c.status === 'Active').length,
    inactiveClasses: classes.filter((c) => c.status === 'Inactive').length,
    totalStudents: classes.reduce((sum, c) => sum + (c.totalStudents || 0), 0),
  };

  const tableColumns = [
    { key: 'className', label: t('className') },
    { key: 'academicYear', label: t('academicYearLabel') },
    { key: 'students', label: t('totalStudentsInClass') },
    { key: 'status', label: t('status') },
    { key: 'actions', label: t('actions'), className: 'text-right' },
  ];

  const renderTableRow = (classData) => (
    <>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/50 flex-shrink-0">
            {classData.className?.slice(0, 2).toUpperCase() || 'CL'}
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-white">{classData.className}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{classData.academicYear}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{classData.totalStudents || 0}</td>
      <td className="px-4 py-3">
        <StatusBadge status={classData.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <ActionButtons
          onView={() => onViewDetails(classData)}
          onEdit={() => onEditClass(classData)}
          onDelete={() => setDeletingClass(classData)}
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
          {Math.min(filteredClasses.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}&ndash;{Math.min(currentPage * ITEMS_PER_PAGE, filteredClasses.length)} {t('of')} {filteredClasses.length}
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
        <p className="text-sm">{t('loadingClasses')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('allClassesTitle')}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpenIcon} label={t('totalClasses')} value={statistics.totalClasses} color="blue" />
        <StatCard icon={CheckCircleIcon} label={t('active')} value={statistics.activeClasses} color="green" />
        <StatCard icon={XCircleIcon} label={t('inactive')} value={statistics.inactiveClasses} color="red" />
        <StatCard icon={UsersIcon} label={t('totalStudentsInClass')} value={statistics.totalStudents} color="yellow" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
        <div className="w-full sm:w-44">
          <FilterDropdown
            label={t('academicYearLabel')}
            options={academicYearOptions}
            value={academicYearFilter}
            onChange={(v) => { setAcademicYearFilter(v); setCurrentPage(1); }}
          />
        </div>
        <div className="w-full sm:w-36">
          <FilterDropdown
            label={t('statusLabel')}
            options={statusOptions}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
          />
        </div>
        <div className="w-full sm:w-56">
          <SearchInput
            placeholder={t('search')}
            value={searchQuery}
            onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
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
          {filteredClasses.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <Table columns={tableColumns} data={paginatedClasses} renderRow={renderTableRow} />
            </div>
          ) : (
            <>
              <Table columns={tableColumns} data={paginatedClasses} renderRow={renderTableRow} />
              {renderPagination()}
            </>
          )}
        </>
      ) : (
        <>
          {paginatedClasses.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-sm">{t('noClasses')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {paginatedClasses.map((classData) => (
                  <ClassCard
                    key={classData._id}
                    classData={classData}
                    onView={() => onViewDetails(classData)}
                    onEdit={() => onEditClass(classData)}
                    onDelete={() => setDeletingClass(classData)}
                  />
                ))}
              </div>
              {renderPagination()}
            </>
          )}
        </>
      )}

      <ConfirmationModal
        isOpen={!!deletingClass}
        onClose={() => setDeletingClass(null)}
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

export default AllClasses;
