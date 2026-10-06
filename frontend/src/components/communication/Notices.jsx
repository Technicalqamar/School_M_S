import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../hooks/useLocalization';
import {
  EyeIcon, TrashIcon, XMarkIcon, PlusIcon, PencilSquareIcon, MegaphoneIcon,
} from '@heroicons/react/24/outline';
import SearchInput from '../common/SearchInput/SearchInput';
import ConfirmationModal from '../common/ConfirmationModal/ConfirmationModal';
import Modal from '../common/Modal/Modal';
import Button from '../common/Button/Button';
import ClassSelector from './ClassSelector';
import noticeService from '../../services/communication/notice.service';
import {
  getAudienceLabel,
  getStatusStyle,
  formatDate,
  formatDateTime,
  truncate,
  classAudienceEnabled,
} from '../../utils/communicationUtils';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';
import { ACADEMIC_YEARS } from '../../utils/classNames';

const ITEMS_PER_PAGE = 10;

// `Parents`/`Staff` are not offered any more (there is no Parent Portal and no
// Staff Portal) and the backend rejects them. They are still listed here purely
// so that a notice stored with one of those audiences before the cleanup can be
// opened and re-targeted without the audience silently flipping to "Everyone".
const LEGACY_AUDIENCES = ['Parents', 'Staff'];

const initialForm = {
  title: '',
  message: '',
  audience: 'All',
  classNames: [],
  status: 'Draft',
  academicYear: '',
};

const Notices = () => {
  const { t } = useTranslation();
  const { academic } = useSchoolConfig();

  const [notices, setNotices] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [audienceFilter, setAudienceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...initialForm, academicYear: academic.currentYear || '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [viewNotice, setViewNotice] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Only the supported audiences are offered, plus the legacy value of the
  // notice being edited when that value is no longer offered (see
  // LEGACY_AUDIENCES). Creating a notice never exposes those values.
  const audienceOptions = LEGACY_AUDIENCES.includes(form.audience)
    ? [...noticeService.AUDIENCES, form.audience]
    : noticeService.AUDIENCES;

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await noticeService.getNotices({
        audience: audienceFilter,
        status: statusFilter,
        search,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
      setNotices(result.notices);
      setPagination(result.pagination);
    } catch {
      setNotices([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [audienceFilter, statusFilter, search, currentPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotices();
  }, [fetchNotices]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...initialForm, academicYear: academic.currentYear || '' });
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (notice) => {
    setEditing(notice);
    setForm({
      title: notice.title || '',
      message: notice.message || notice.content || '',
      audience: notice.audience || 'All',
      classNames: notice.classNames || [],
      status: notice.status || 'Draft',
      academicYear: notice.academicYear || academic.currentYear || '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const handleFieldChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'audience' && !classAudienceEnabled(value)) next.classNames = [];
      return next;
    });
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.title.trim()) {
      setFormError(t('pleaseFillRequired'));
      return;
    }
    if (!form.message.trim()) {
      setFormError(t('pleaseFillRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        audience: form.audience,
        classNames: classAudienceEnabled(form.audience) ? form.classNames : [],
        status: form.status,
        academicYear: form.academicYear,
      };
      if (editing) {
        await noticeService.updateNotice(editing.id, payload);
        toast.success(t('noticeUpdated'));
      } else {
        await noticeService.createNotice(payload);
        toast.success(t('noticeCreated'));
      }
      setFormOpen(false);
      setEditing(null);
      fetchNotices();
    } catch (err) {
      setFormError(err?.response?.data?.message || t('failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await noticeService.deleteNotice(deleteTarget.id);
      toast.success(t('noticeDeleted'));
      setDeleteTarget(null);
      fetchNotices();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('failedToDelete'));
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = pagination.totalPages || 1;
  const totalItems = pagination.totalItems || 0;

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('page')} {Math.min(totalItems, (currentPage - 1) * ITEMS_PER_PAGE + 1)}&ndash;{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} {t('of')} {totalItems}
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('notices')}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('noticesSubtitle')}</p>

      <div className="mt-6 flex justify-end">
        <Button onClick={openCreate} className="w-auto px-5">
          <PlusIcon className="h-4 w-4 mr-2" />
          {t('createNotice')}
        </Button>
      </div>

      <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <MegaphoneIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('noticesList')}</h2>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SearchInput placeholder={t('searchNotice')} value={search} onChange={setSearch} />
          <select
            value={audienceFilter}
            onChange={(e) => { setAudienceFilter(e.target.value); setCurrentPage(1); }}
            className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="All">{t('allAudiences')}</option>
            {noticeService.AUDIENCES.map((a) => (
              <option key={a} value={a}>{getAudienceLabel(t, a)}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="All">{t('allStatuses')}</option>
            {noticeService.STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loadError && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
              <span className="text-sm">{t('failedToLoad')}</span>
              <button onClick={fetchNotices} className="text-xs font-medium underline cursor-pointer">{t('retry')}</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('noticeTitle')}</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('audience')}</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('status')}</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('dateLabel')}</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">{t('loading')}</td>
                </tr>
              ) : notices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">{t('noNoticesFound')}</td>
                </tr>
              ) : (
                notices.map((notice) => (
                  <tr key={notice.id} className="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-3 py-3 text-xs font-medium text-gray-800 dark:text-gray-200 max-w-[240px] truncate">{truncate(notice.title, 55)}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{getAudienceLabel(t, notice.audience)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusStyle(notice.status)}`}>
                        {notice.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(notice.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewNotice(notice)} className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer" title={t('view')}>
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(notice)} className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors cursor-pointer" title={t('edit')}>
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(notice)} className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer" title={t('delete')}>
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4">{renderPagination()}</div>
      </div>

      {/* Create / Edit Notice Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => { if (!saving) setFormOpen(false); }}
        title={editing ? t('editNotice') : t('createNotice')}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="notice-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('noticeTitle')} <span className="text-red-500">*</span>
            </label>
            <input
              id="notice-title"
              type="text"
              value={form.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder={t('noticeTitlePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div>
            <label htmlFor="notice-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('noticeMessage')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="notice-message"
              value={form.message}
              onChange={(e) => handleFieldChange('message', e.target.value)}
              rows={4}
              placeholder={t('noticeMessagePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="notice-audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('audience')} <span className="text-red-500">*</span>
              </label>
              <select
                id="notice-audience"
                value={form.audience}
                onChange={(e) => handleFieldChange('audience', e.target.value)}
                className="appearance-none w-full px-4 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                {audienceOptions.map((a) => (
                  <option key={a} value={a}>{getAudienceLabel(t, a)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="notice-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('noticeStatus')} <span className="text-red-500">*</span>
              </label>
              <select
                id="notice-status"
                value={form.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
                className="appearance-none w-full px-4 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                {noticeService.STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="notice-year" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('academicYearLabel')} <span className="text-red-500">*</span>
            </label>
            <select
              id="notice-year"
              value={form.academicYear}
              onChange={(e) => handleFieldChange('academicYear', e.target.value)}
              className="appearance-none w-full px-4 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              {ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {classAudienceEnabled(form.audience) && (
            <div>
              <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('selectClasses')}</p>
              <ClassSelector value={form.classNames} onChange={(v) => handleFieldChange('classNames', v)} />
              {form.classNames.length > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">{form.classNames.length} {t('classesSelected')}</p>
              )}
            </div>
          )}
          {formError && (
            <div className="flex items-start gap-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
              <span className="text-sm">{formError}</span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving} className="w-auto px-5">
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={saving} className="w-auto px-5">
              {editing ? t('update') : t('save')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Notice Modal */}
      {viewNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewNotice(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('noticeDetails')}</h2>
              <button onClick={() => setViewNotice(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 max-h-[80vh] overflow-y-auto space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white break-words">{viewNotice.title}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${getStatusStyle(viewNotice.status)}`}>
                  {viewNotice.status}
                </span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">{t('noticeMessage')}</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{viewNotice.message || viewNotice.content}</p>
              </div>
              <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs text-gray-500">{t('audience')}</span>
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{getAudienceLabel(t, viewNotice.audience)}</span>
              </div>
              {(viewNotice.classNames || []).length > 0 && (
                <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-500">{t('selectClasses')}</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{(viewNotice.classNames || []).join(', ')}</span>
                </div>
              )}
              <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs text-gray-500">{t('academicYearLabel')}</span>
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{viewNotice.academicYear || '—'}</span>
              </div>
              {viewNotice.publishedAt && viewNotice.status === 'Published' && (
                <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-500">{t('publishedOn')}</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{formatDateTime(viewNotice.publishedAt)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs text-gray-500">{t('createdOn')}</span>
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{formatDateTime(viewNotice.createdAt)}</span>
              </div>
              {viewNotice.createdBy?.fullName && (
                <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-500">{t('createdBy')}</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{viewNotice.createdBy.fullName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        title={t('deleteNotice')}
        message={t('deleteNoticeConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
};

export default Notices;