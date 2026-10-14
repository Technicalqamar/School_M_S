import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../hooks/useLocalization';
import {
  EyeIcon, TrashIcon, XMarkIcon, PaperAirplaneIcon, UsersIcon,
} from '@heroicons/react/24/outline';
import SearchInput from '../common/SearchInput/SearchInput';
import ConfirmationModal from '../common/ConfirmationModal/ConfirmationModal';
import Alert from '../common/Alert/Alert';
import Button from '../common/Button/Button';
import ClassSelector from './ClassSelector';
import smsService from '../../services/communication/sms.service';
import { useAuth } from '../../contexts/AuthContext';
import { hasReceptionistActionAccess } from '../../constants/receptionistPermissions';
import {
  getAudienceLabel,
  getStatusStyle,
  formatDateTime,
  truncate,
  classAudienceEnabled,
} from '../../utils/communicationUtils';

const ITEMS_PER_PAGE = 10;

const Sms = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Sending (and deleting) SMS is `sms-send`; viewing history is `sms-view`.
  const canSendSms = hasReceptionistActionAccess(user, 'communication', 'sms-send');

  // Compose form
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('All');
  const [classNames, setClassNames] = useState([]);
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState('');

  // List
  const [smsMessages, setSmsMessages] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [audienceFilter, setAudienceFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // View / delete
  const [viewSms, setViewSms] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await smsService.getSmsMessages({
        audience: audienceFilter,
        status: statusFilter,
        search,
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      });
      setSmsMessages(result.sms);
      setPagination(result.pagination);
    } catch {
      setSmsMessages([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [audienceFilter, statusFilter, search, currentPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMessages();
  }, [fetchMessages]);

  const handleAudienceChange = (value) => {
    setAudience(value);
    if (!classAudienceEnabled(value)) setClassNames([]);
  };

  const handleSend = async () => {
    setComposeError('');
    if (!message.trim()) {
      setComposeError(t('smsMessageRequired'));
      return;
    }
    if (message.trim().length < 3) {
      setComposeError(t('smsMessageTooShort'));
      return;
    }
    setSending(true);
    try {
      const created = await smsService.createSmsMessage({ message: message.trim(), audience, classNames });
      // No SMS gateway is configured, so the record is queued with a truthful
      // status (Pending) until an admin marks it Sent/Failed. The message must
      // not claim the SMS was dispatched.
      toast.success(t(created?.status === 'Sent' ? 'smsSent' : 'smsQueued'));
      setMessage('');
      setAudience('All');
      setClassNames([]);
      fetchMessages();
    } catch (err) {
      setComposeError(err?.response?.data?.message || t('failedToSave'));
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await smsService.updateSmsMessageStatus(id, status);
      toast.success(t('smsStatusUpdated'));
      setViewSms((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
      fetchMessages();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('failedToUpdate'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await smsService.deleteSmsMessage(deleteTarget.id);
      toast.success(t('smsDeleted'));
      setDeleteTarget(null);
      fetchMessages();
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('sms')}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('smsSubtitle')}</p>

      {/* Compose SMS */}
      {canSendSms && (
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <PaperAirplaneIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('composeSms')}</h2>
        </div>
        <div className="p-5">
          <div className="mb-4">
            <label htmlFor="sms-message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('smsMessage')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="sms-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={t('smsMessagePlaceholder')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <p className="text-right text-xs text-gray-400 mt-1">{message.length}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="sms-audience" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('audience')} <span className="text-red-500">*</span>
              </label>
              <select
                id="sms-audience"
                value={audience}
                onChange={(e) => handleAudienceChange(e.target.value)}
                className="appearance-none w-full px-4 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                {smsService.AUDIENCES.map((a) => (
                  <option key={a} value={a}>{getAudienceLabel(t, a)}</option>
                ))}
              </select>
            </div>
          </div>

          {classAudienceEnabled(audience) && (
            <div className="mb-4">
              <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('selectClasses')}</p>
              <ClassSelector value={classNames} onChange={setClassNames} />
              {classNames.length > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">{classNames.length} {t('classesSelected')}</p>
              )}
            </div>
          )}

          {composeError && <Alert message={composeError} type="error" className="mt-1" />}

          <div className="flex justify-end mt-2">
            <Button onClick={handleSend} loading={sending} disabled={sending} className="w-auto px-5">
              <PaperAirplaneIcon className="h-4 w-4 mr-2" />
              {t('sendSms')}
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* SMS History */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('sentSmsHistory')}</h2>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <SearchInput placeholder={t('searchSms')} value={search} onChange={setSearch} />
          <select
            value={audienceFilter}
            onChange={(e) => { setAudienceFilter(e.target.value); setCurrentPage(1); }}
            className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="All">{t('allAudiences')}</option>
            {smsService.AUDIENCES.map((a) => (
              <option key={a} value={a}>{getAudienceLabel(t, a)}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
          >
            <option value="All">{t('allStatuses')}</option>
            {smsService.STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loadError && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
              <span className="text-sm">{t('failedToLoad')}</span>
              <button onClick={fetchMessages} className="text-xs font-medium underline cursor-pointer">{t('retry')}</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('smsMessage')}</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('audience')}</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('recipientCount')}</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('status')}</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('dateLabel')}</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">{t('loading')}</td>
                </tr>
              ) : smsMessages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">{t('noSmsFound')}</td>
                </tr>
              ) : (
                smsMessages.map((sms) => (
                  <tr key={sms.id} className="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 max-w-[220px] truncate">{truncate(sms.message, 60)}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{getAudienceLabel(t, sms.audience)}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{sms.recipientCount ?? (sms.recipients || []).length}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusStyle(sms.status)}`}>
                        {sms.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateTime(sms.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewSms(sms)} className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer" title={t('view')}>
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {canSendSms && (
                          <button onClick={() => setDeleteTarget(sms)} className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer" title={t('delete')}>
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
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

      {/* View SMS Modal */}
      {viewSms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewSms(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('smsDetails')}</h2>
              <button onClick={() => setViewSms(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 max-h-[80vh] overflow-y-auto space-y-3">
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">{t('smsMessage')}</p>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{viewSms.message}</p>
              </div>
              <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs text-gray-500">{t('audience')}</span>
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{getAudienceLabel(t, viewSms.audience)}</span>
              </div>
              {(viewSms.classNames || []).length > 0 && (
                <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-500">{t('selectClasses')}</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{(viewSms.classNames || []).join(', ')}</span>
                </div>
              )}
              <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs text-gray-500">{t('recipientCount')}</span>
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{(viewSms.recipients || []).length}</span>
              </div>
              <div className="py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{t('status')}</span>
                  <select
                    value={viewSms.status}
                    onChange={(e) => handleStatusChange(viewSms.id, e.target.value)}
                    className="appearance-none px-2 py-1 pr-6 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    {smsService.STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs text-gray-500">{t('dateLabel')}</span>
                <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{formatDateTime(viewSms.createdAt)}</span>
              </div>
              {(viewSms.recipients || []).length > 0 && (
                <div className="py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2">{t('smsRecipients')}</p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {(viewSms.recipients || []).slice(0, 20).map((r, idx) => (
                      <div key={`${r.phone}-${idx}`} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{r.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-[10px]">{r.role}</span>
                          {r.phone}
                        </span>
                      </div>
                    ))}
                    {(viewSms.recipients || []).length > 20 && (
                      <p className="text-xs text-gray-400">+ {(viewSms.recipients || []).length - 20} {t('more')}</p>
                    )}
                  </div>
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
        title={t('deleteSms')}
        message={t('deleteSmsConfirm')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
};

export default Sms;