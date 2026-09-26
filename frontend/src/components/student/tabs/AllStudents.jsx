import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../../hooks/useLocalization';
import toast from 'react-hot-toast';
import { UsersIcon, UserGroupIcon, UserMinusIcon, UserPlusIcon, ArrowPathIcon, ArrowTopRightOnSquareIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import FilterDropdown from '../../common/FilterDropdown/FilterDropdown';
import SearchInput from '../../common/SearchInput/SearchInput';
import ViewToggle from '../../common/ViewToggle/ViewToggle';
import Table from '../../common/Table/Table';
import StatusBadge from '../../common/StatusBadge/StatusBadge';
import ActionButtons from '../../common/ActionButtons/ActionButtons';
import StudentCard from '../../common/StudentCard/StudentCard';
import EditStudentModal from '../../common/EditStudentModal/EditStudentModal';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import { getImageUrl } from '../../../utils/imageUrl';
import studentService from '../../../services/student/student.service';
import portalService from '../../../services/portal/portal.service';
import { CLASS_NAMES } from '../../../utils/classNames';
import Spinner from '../../common/Spinner/Spinner';

const ITEMS_PER_PAGE = 10;

const AllStudents = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const classOptions = [t('allClasses'), ...CLASS_NAMES];

  const statusOptions = [t('all'), t('active'), t('inactive')];

  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [studentIdFilter, setStudentIdFilter] = useState('');
  const [classFilter, setClassFilter] = useState(t('allClasses'));
  const [statusFilter, setStatusFilter] = useState(t('all'));
  const [currentPage, setCurrentPage] = useState(1);
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ totalStudents: 0, totalPages: 0, currentPage: 1 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [portalStudent, setPortalStudent] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const debounceRef = useRef(null);
  const pendingPortalTokenRef = useRef(null);

  useEffect(() => {
    const handlePortalHandshake = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'SMS_PORTAL_READY') return;
      const pending = pendingPortalTokenRef.current;
      if (!pending || !pending.token || !pending.window) return;
      if (event.source !== pending.window) return;
      event.source.postMessage(
        { type: 'SMS_PORTAL_ACCESS_TOKEN', token: pending.token },
        event.origin
      );
      pending.token = null;
    };
    window.addEventListener('message', handlePortalHandshake);
    return () => window.removeEventListener('message', handlePortalHandshake);
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setFetchError('');

    try {
      const params = { page: currentPage, limit: ITEMS_PER_PAGE };
      if (classFilter !== 'All Classes') params.class = classFilter;
      if (statusFilter !== 'All') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const idTerm = studentIdFilter.trim();
      const isStudentIdFormat = /^\d{1,6}$/.test(idTerm) || /^STD-\d{6}$/i.test(idTerm);

      if (isStudentIdFormat) {
        params.studentId = idTerm;
      } else if (idTerm) {
        params.search = idTerm;
      }

      const result = await studentService.getAllStudents(params);
      setStudents(result.data.students);
      setPagination(result.data.pagination);
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToLoad');
      setFetchError(msg);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, classFilter, statusFilter, search, studentIdFilter]);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      fetchStudents();
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [currentPage, classFilter, statusFilter, search, studentIdFilter, fetchStudents]);

  const handleReset = () => {
    setClassFilter(t('allClasses'));
    setStatusFilter(t('all'));
    setSearch('');
    setStudentIdFilter('');
    setCurrentPage(1);
  };

  const handleEditSave = async (studentId, formData) => {
    await studentService.updateStudent(studentId, formData);
    setEditingStudent(null);
    fetchStudents();
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    try {
      await studentService.deleteStudent(deletingStudent.studentId);
      toast.success(t('deletedSuccessfully'));
      setDeletingStudent(null);
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || t('failedToDelete'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!portalStudent) return;

    const portalWindow = window.open('/portal/access', '_blank');
    setPortalLoading(true);

    try {
      const res = await portalService.openPortal(portalStudent.studentId);
      const portalToken = res.data?.portalToken;
      if (!portalToken) throw new Error('No portal token returned');

      if (!portalWindow) {
        toast.error(t('popupBlocked'));
        setPortalStudent(null);
        return;
      }

      pendingPortalTokenRef.current = { token: portalToken, window: portalWindow };
      portalWindow.postMessage(
        { type: 'SMS_PORTAL_ACCESS_TOKEN', token: portalToken },
        window.location.origin
      );

      setPortalStudent(null);
    } catch (err) {
      if (portalWindow) portalWindow.close();
      toast.error(err.response?.data?.message || t('portalAccessFailed'));
    } finally {
      setPortalLoading(false);
    }
  };

  const totalStudents = pagination.totalStudents;
  const activeStudents = students.filter((s) => s.status === 'Active').length;
  const inactiveStudents = students.filter((s) => s.status === 'Inactive').length;
  const newAdmissions = students.filter((s) => ['Nursery', 'Montessori', 'KG 1'].includes(s.class)).length;

  const tableColumns = [
    { key: 'student', label: t('student') },
    { key: 'id', label: t('studentIdLabel') },
    { key: 'class', label: t('class') },
    { key: 'gender', label: t('gender') },
    { key: 'parentPhone', label: t('parentPhone') },
    { key: 'status', label: t('status') },
    { key: 'actions', label: t('actions'), className: 'text-right' },
  ];

  const renderTableRow = (student) => (
    <>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/50 flex-shrink-0 overflow-hidden">
            {getImageUrl(student.studentImage) ? (
              <img src={getImageUrl(student.studentImage)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              student.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{student.fullName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('sonOf')}{student.fatherName}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{student.studentId}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{student.class}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{student.gender}</td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{student.fatherPhone}</td>
      <td className="px-4 py-3">
        <StatusBadge status={student.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <ActionButtons
            onView={() => navigate(`/admin/students/${student.studentId}`, { state: { student } })}
            onEdit={() => setEditingStudent(student)}
            onDelete={() => setDeletingStudent(student)}
          />
          <button
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-indigo-500/15 cursor-pointer border border-indigo-200 dark:border-indigo-800/50"
            title={t('openPortal')}
            onClick={() => setPortalStudent(student)}
          >
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{t('portal')}</span>
          </button>
        </div>
      </td>
    </>
  );

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    const pages = [];
    const totalPages = pagination.totalPages;
    const safeCurrentPage = pagination.currentPage;

    let start = Math.max(1, safeCurrentPage - 2);
    let end = Math.min(totalPages, safeCurrentPage + 2);
    if (end - start < 4) {
      if (start === 1) end = Math.min(totalPages, start + 4);
      else start = Math.max(1, end - 4);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    const startRecord = (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1;
    const endRecord = Math.min(safeCurrentPage * ITEMS_PER_PAGE, pagination.totalStudents);

    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('showing')} {startRecord}–{endRecord} {t('of')} {pagination.totalStudents}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage === 1 || loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {t('previous')}
          </button>
          {start > 1 && (
            <>
              <button onClick={() => setCurrentPage(1)} className="w-9 h-9 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer">1</button>
              {start > 2 && <span className="px-1 text-gray-400">...</span>}
            </>
          )}
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              disabled={loading}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                safeCurrentPage === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {page}
            </button>
          ))}
          {end < totalPages && (
            <>
              {end < totalPages - 1 && <span className="px-1 text-gray-400">...</span>}
              <button onClick={() => setCurrentPage(totalPages)} className="w-9 h-9 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer">{totalPages}</button>
            </>
          )}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage === totalPages || loading}
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
      {fetchError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {fetchError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('studentManagement')}</h1>
        <div className="w-full sm:w-56">
          <SearchInput
            placeholder={t('searchByStudentIdOrName')}
            value={studentIdFilter}
            onChange={(v) => { setStudentIdFilter(v); setCurrentPage(1); }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UsersIcon} label={t('totalStudents')} value={totalStudents} color="blue" />
        <StatCard icon={UserGroupIcon} label={t('activeStudents')} value={activeStudents} color="green" />
        <StatCard icon={UserMinusIcon} label={t('inactiveStudents')} value={inactiveStudents} color="red" />
        <StatCard icon={UserPlusIcon} label={t('newAdmissions')} value={newAdmissions} color="yellow" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
        <div className="w-full sm:w-44">
          <FilterDropdown
            label={t('class')}
            options={classOptions}
            value={classFilter}
            onChange={(v) => { setClassFilter(v); setCurrentPage(1); }}
          />
        </div>
        <div className="w-full sm:w-36">
          <FilterDropdown
            label={t('status')}
            options={statusOptions}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
          />
        </div>
        <div className="w-full sm:w-56">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">
            {t('searchNameOrId')}
          </label>
          <SearchInput
            placeholder={t('search')}
            value={search}
            onChange={(v) => { setSearch(v); setCurrentPage(1); }}
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
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" className="text-blue-600" />
        </div>
      ) : (
        <>
          {view === 'table' ? (
            <>
              <Table columns={tableColumns} data={students} renderRow={renderTableRow} />
              {renderPagination()}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {students.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-gray-400 dark:text-gray-500">
                    {t('noData')}
                  </div>
                ) : (
                  students.map((student) => (
                    <StudentCard
                      key={student.studentId}
                      student={student}
                      onView={() => navigate(`/admin/students/${student.studentId}`, { state: { student } })}
                      onEdit={() => setEditingStudent(student)}
                      onDelete={() => setDeletingStudent(student)}
                    />
                  ))
                )}
              </div>
              {renderPagination()}
            </>
          )}
        </>
      )}

      <EditStudentModal
        key={editingStudent?.studentId || 'new'}
        student={editingStudent}
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        onSave={handleEditSave}
      />

      <ConfirmationModal
        isOpen={!!deletingStudent}
        onClose={() => setDeletingStudent(null)}
        title={`${t('delete')} ${t('student')}`}
        message={`${t('confirmDelete')}`}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
      />

      <ConfirmationModal
        isOpen={!!portalStudent}
        onClose={() => setPortalStudent(null)}
        title={t('studentPortalAccess')}
        confirmLabel={t('goToStudentPortal')}
        cancelLabel={t('cancel')}
        variant="primary"
        loading={portalLoading}
        onConfirm={handleOpenPortal}
        maxWidth="max-w-md"
      >
        {portalStudent && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl ring-2 ring-yellow-400/50 flex-shrink-0 overflow-hidden">
                {getImageUrl(portalStudent.studentImage) ? (
                  <img
                    src={getImageUrl(portalStudent.studentImage)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  portalStudent.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{portalStudent.fullName}</p>
                <p className="text-sm font-mono text-gray-500 dark:text-gray-400">{portalStudent.studentId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 dark:bg-gray-900/40 p-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('class')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{portalStudent.class}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('academicYear')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{portalStudent.academicYear}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('profileStatus')}</p>
                <StatusBadge status={portalStudent.status} />
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/60 p-3.5">
              <ShieldCheckIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed text-indigo-900 dark:text-indigo-200">
                {t('portalAccessConfirmation')}
              </p>
            </div>
          </div>
        )}
      </ConfirmationModal>
    </div>
  );
};

export default AllStudents;
