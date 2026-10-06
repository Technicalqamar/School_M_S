import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../hooks/useLocalization';
import {
  EyeIcon, TrashIcon, XMarkIcon, PlusIcon, BellIcon, CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import SearchInput from '../common/SearchInput/SearchInput';
import ConfirmationModal from '../common/ConfirmationModal/ConfirmationModal';
import Modal from '../common/Modal/Modal';
import Button from '../common/Button/Button';
import StatCard from '../common/StatCard/StatCard';
import ClassSelector from './ClassSelector';
import notificationService from '../../services/communication/notification.service';
import {
  getAudienceLabel,
  formatDateTime,
  truncate,
  classAudienceEnabled,
} from '../../utils/communicationUtils';

const ITEMS_PER_PAGE = 10;

const initialForm = {
  title: '',
  message: '',
  audience: 'All',
  classNames: [],
};

const Notifications = () => {
  const { t } = useTranslation();

  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [audienceFilter, setAudienceFilter] = useState('All');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...initialForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [viewNotification, setViewNotification] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await notificationService.getNotifications({
        audience: audienceFilter,
        unreadOnly,
        search,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
      setNotifications(result.notifications);
      setPagination(result.pagination);
    } catch {
      setNotifications([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [audienceFilter, unreadOnly, search, currentPage]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Non-fatal: the summary stat cannot be computed, the list still renders.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const refreshAll = useCallback(() => {
    fetchList();
    fetchUnreadCount();
  }, [fetchList, fetchUnreadCount]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'audience' && !classAudienceEnabled(value)) next.classNames = [];
      return next;
    });
  };

  const handleCreate = async () => {
    setFormError('');
    if (!form.title.trim() || !form.message.trim()) {
      setFormError(t('pleaseFillRequired'));
      return;
    }
    setSaving(true);
    try {
      await notificationService.createNotification({
        title: form.title.trim(),
        message: form.message.trim(),
        audience: form.audience,
        classNames: classAudienceEnabled(form.audience) ? form.classNames : [],
      });
      toast.success(t('notificationCreated'));
      setFormOpen(false);
      setForm({ ...initialForm });
      refreshAll();
      notificationService.emitChange();
    } catch (err) {
      setFormError(err?.response?.data?.message || t('failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      toast.success(t('notificationMarkedRead'));
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setViewNotification((prev) => (prev && prev.id === id ? { ...prev, read: true } : prev));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      fetchList();
      notificationService.emitChange();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('failedToUpdate'));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const updated = await notificationService.markAllRead();
      toast.success(t('allMarkedRead'));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      if (updated > 0) fetchList();
      notificationService.emitChange();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('failedToUpdate'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // notificationService.deleteNotification emits the change event itself
      // (that is what refreshes the Header Bell badge), so no extra emit here.
      await notificationService.deleteNotification(deleteTarget.id);
      toast.success(t('notificationDeleted'));
      setDeleteTarget(null);
      refreshAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('failedToDelete'));
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = pagination.totalPages || 1;
  const totalItems = pagination.totalItems || 0;
  const unreadNotifications = notifications.filter((n) => !n.read);

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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('notifications')}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('notificationsSubtitle')}</p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard icon={BellIcon} label={t('unreadNotifications')} value={unreadCount} color="red" />
        <StatCard icon={CheckBadgeIcon} label={t('totalNotifications')} value={totalItems} color="blue" />
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => { setForm({ ...initialForm }); setFormError(''); setFormOpen(true); }} className="w-auto px-5">
          <PlusIcon className="h-4 w-4 mr-2" />
          {t('createNotification')}
        </Button>
      </div>

      <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('notificationsList')}</h2>
            {unreadNotifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium transition-colors cursor-pointer"
              >
                {t('markAllRead')}
              </button>
            )}
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SearchInput placeholder={t('searchNotification')} value={search} onChange={setSearch} />
          <select
            value={audienceFilter}
            onChange={(e) => { setAudienceFilter(e.target.value); setCurrentPage(1); }}
            className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="All">{t('allAudiences')}</option>
            {notificationService.AUDIENCES.map((a) => (
              <option key={a} value={a}>{getAudienceLabel(t, a)}</option>
            ))}
          </select>
          <select
            value={unreadOnly ? 'unread' : 'all'}
            onChange={(e) => { setUnreadOnly(e.target.value === 'unread'); setCurrentPage(1); }}
            className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="all">{t('allNotifications')}</option>
            <option value="unread">{t('unreadNotifications')}</option>
          </select>
        </div>

        {loadError && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
              <span className="text-sm">{t('failedToLoad')}</span>
              <button onClick={fetchList} className="text-xs font-medium underline cursor-pointer">{t('retry')}</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('notificationTitle')}</th>
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
              ) : notifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">{t('noNotificationsFound')}</td>
                </tr>
              ) : (
                notifications.map((notification) => (
                  <tr key={notification.id} className="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <span className={`text-xs font-medium max-w-[240px] truncate ${notification.read ? 'text-gray-600 dark:text-gray-300 font-normal' : 'text-gray-900 dark:text-white'}`}>
                          {truncate(notification.title, 55)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{getAudienceLabel(t, notification.audience)}</td>
                    <td className="px-3 py-3">
                      {notification.read ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {t('read')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-blue-300 dark:border-blue-700 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {t('unread')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(notification.time || notification.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <button onClick={() => handleMarkRead(notification.id)} className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer" title={t('markAsRead')}>
                            <CheckBadgeIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => setViewNotification(notification)} className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors cursor-pointer" title={t('view')}>
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(notification)} className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer" title={t('delete')}>
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

      {/* Create Notification Modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => { if (!saving) setFormOpen(false); }}
        title={t('createNotification')}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="notification-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('notificationTitle')} <span className="text-red-500">*</span>
            </label>
            <input
              id="notification-title"
              type="text"
              value={form.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder={t('notificationTitlePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div>
            <label htmlFor="notification-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('notificationMessage')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="notification-message"
              value={form.message}
              onChange={(e) => handleFieldChange('message', e.target.value)}
              rows={4}
              placeholder={t('notificationMessagePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div>
            <label htmlFor="notification-audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('audience')} <span className="text-red-500">*</span>
            </label>
            <select
              id="notification-audience"
              value={form.audience}
              onChange={(e) => handleFieldChange('audience', e.target.value)}
              className="appearance-none w-full px-4 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              {notificationService.AUDIENCES.map((a) => (
                <option key={a} value={a}>{getAudienceLabel(t, a)}</option>
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
            <Button onClick={handleCreate} loading={saving} disabled={saving} className="w-auto px-5">
              {t('sendNotification')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Notification Modal */}
      {viewNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewNotification(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('notificationDetails')}</h2>
              <button onClick={() => setViewNotification(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 max-h-[80vh] overflow-y-auto space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white break-words">{viewNotification.title}</h3>
                {!viewNotification.read ? (
                  <button
                    onClick={() => handleMarkRead(viewNotification.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0 cursor-pointer"
                  >
                    <CheckBadgeIcon className="h-3.5 w-3.5" />
                    {t('markAsRead')}
                  </button>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">
                    {t('read')}
                  </span>
                )}
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">{t('notificationMessage')}</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{viewNotification.message || viewNotification.content}</p>
              </div>
              <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs text-gray-500">{t('audience')}</span>
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{getAudienceLabel(t, viewNotification.audience)}</span>
              </div>
              {(viewNotification.classNames || []).length > 0 && (
                <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-500">{t('selectClasses')}</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{(viewNotification.classNames || []).join(', ')}</span>
                </div>
              )}
              <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs text-gray-500">{t('createdOn')}</span>
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{formatDateTime(viewNotification.time || viewNotification.createdAt)}</span>
              </div>
              {viewNotification.createdBy?.fullName && (
                <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-500">{t('createdBy')}</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{viewNotification.createdBy.fullName}</span>
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
        title={t('deleteNotification')}
        message={t('deleteNotificationConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
};

export default Notifications;