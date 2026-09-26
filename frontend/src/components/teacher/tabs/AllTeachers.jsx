import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { UsersIcon, UserGroupIcon, UserMinusIcon, UserPlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import FilterDropdown from '../../common/FilterDropdown/FilterDropdown';
import SearchInput from '../../common/SearchInput/SearchInput';
import ViewToggle from '../../common/ViewToggle/ViewToggle';
import Table from '../../common/Table/Table';
import StatusBadge from '../../common/StatusBadge/StatusBadge';
import ActionButtons from '../../common/ActionButtons/ActionButtons';
import TeacherCard from '../../common/TeacherCard/TeacherCard';
import TeacherViewModal from '../../common/TeacherViewModal/TeacherViewModal';
import EditTeacherModal from '../../common/EditTeacherModal/EditTeacherModal';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import { getImageUrl } from '../../../utils/imageUrl';
import { useTranslation } from '../../../hooks/useLocalization';
import teacherService from '../../../services/teacher/teacher.service';

const ITEMS_PER_PAGE = 10;

const formatDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toISOString().slice(0, 10);
};

const isCurrentMonth = (d) => {
  if (!d) return false;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return false;
  const now = new Date();
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
};

const AllTeachers = ({ onSuccess }) => {
  const { t } = useTranslation();
  const statusOptions = [t('all'), t('active'), t('inactive')];
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(t('all'));
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deletingTeacher, setDeletingTeacher] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [pagination, setPagination] = useState({ totalTeachers: 0, totalPages: 0, currentPage: 1 });
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: ITEMS_PER_PAGE };
      if (statusFilter !== 'All') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const result = await teacherService.getAllTeachers(params);
      setTeachers(result.data?.teachers || []);
      setPagination(result.data?.pagination || { totalTeachers: 0, totalPages: 0, currentPage: 1 });
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToLoad');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, search]);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      fetchTeachers();
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [currentPage, statusFilter, search, fetchTeachers]);

  const handleReset = () => {
    setStatusFilter(t('all'));
    setSearch('');
    setCurrentPage(1);
  };

  const totalTeachers = teachers.length;
  const activeTeachers = teachers.filter((t) => t.status === 'Active').length;
  const inactiveTeachers = teachers.filter((t) => t.status === 'Inactive').length;
  const newTeachers = teachers.filter((t) => isCurrentMonth(t.joiningDate)).length;

  const handleEditSave = async (teacherId, formData) => {
    const result = await teacherService.updateTeacher(teacherId, formData);
    toast.success(t('updatedSuccessfully'));
    await fetchTeachers();
    return result;
  };

  const handleDelete = async () => {
    try {
      await teacherService.deleteTeacher(deletingTeacher.teacherId);
      toast.success(t('deletedSuccessfully'));
      setDeletingTeacher(null);
      await fetchTeachers();
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToDelete');
      toast.error(msg);
    }
  };

  const tableColumns = [
    { key: 'teacher', label: t('teacher') },
    { key: 'teacherId', label: t('teacherIdLabel') },
    { key: 'academicYear', label: t('academicYear') },
    { key: 'phone', label: t('phoneNumber') },
    { key: 'joiningDate', label: t('joiningDate') },
    { key: 'status', label: t('status') },
    { key: 'actions', label: t('actions'), className: 'text-right' },
  ];

  const renderTableRow = (teacher) => {
    const initials = teacher.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || t('noDataDash');
    const imgSrc = getImageUrl(teacher.teacherImage);

    return (
      <>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/50 flex-shrink-0 overflow-hidden">
              {imgSrc ? (
                <img src={imgSrc} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{teacher.fullName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('sonOf')}{teacher.fatherName}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{teacher.teacherId}</td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{teacher.academicYear || '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{teacher.phoneNumber}</td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(teacher.joiningDate)}</td>
        <td className="px-4 py-3">
          <StatusBadge status={teacher.status} />
        </td>
        <td className="px-4 py-3 text-right">
          <ActionButtons
            onView={() => setSelectedTeacher(teacher)}
            onEdit={() => setEditingTeacher(teacher)}
            onDelete={() => setDeletingTeacher(teacher)}
          />
        </td>
      </>
    );
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= pagination.totalPages; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('page')} {Math.min(pagination.totalTeachers, (currentPage - 1) * ITEMS_PER_PAGE + 1)}&ndash;{Math.min(currentPage * ITEMS_PER_PAGE, pagination.totalTeachers)} {t('of')} {pagination.totalTeachers}
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
            onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
            disabled={currentPage === pagination.totalPages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('manageTeachers')}</h1>
        <div className="w-full sm:w-64">
          <SearchInput
            placeholder={t('searchByTeacherIdOrName')}
            value={search}
            onChange={(v) => { setSearch(v); setCurrentPage(1); }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UsersIcon} label={t('totalTeachers')} value={totalTeachers} color="blue" />
        <StatCard icon={UserGroupIcon} label={t('activeTeachers')} value={activeTeachers} color="green" />
        <StatCard icon={UserMinusIcon} label={t('inactiveTeachers')} value={inactiveTeachers} color="red" />
        <StatCard icon={UserPlusIcon} label={t('newTeachers')} value={newTeachers} color="yellow" />
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

      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-sm">{t('loadingTeachers')}</p>
        </div>
      ) : (
        <>
          {teachers.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <p className="text-sm">{t('noTeachersFound')}</p>
            </div>
          ) : view === 'table' ? (
            <>
              <Table columns={tableColumns} data={teachers} renderRow={renderTableRow} />
              {renderPagination()}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {teachers.map((teacher) => (
                  <TeacherCard
                    key={teacher.teacherId}
                    teacher={teacher}
                    onView={() => setSelectedTeacher(teacher)}
                    onEdit={() => setEditingTeacher(teacher)}
                    onDelete={() => setDeletingTeacher(teacher)}
                  />
                ))}
              </div>
              {renderPagination()}
            </>
          )}
        </>
      )}

      <TeacherViewModal
        teacher={selectedTeacher}
        isOpen={!!selectedTeacher}
        onClose={() => setSelectedTeacher(null)}
      />

      <EditTeacherModal
        key={editingTeacher?._id || 'new'}
        teacher={editingTeacher}
        isOpen={!!editingTeacher}
        onClose={() => setEditingTeacher(null)}
        onSave={handleEditSave}
      />

      <ConfirmationModal
        isOpen={!!deletingTeacher}
        onClose={() => setDeletingTeacher(null)}
        title={t('deleteTeacher')}
        message={t('deleteTeacherConfirm')}
        confirmLabel={t('confirmDeleteLabel')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default AllTeachers;
