import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../../../hooks/useLocalization';
import toast from 'react-hot-toast';
import {
  ChevronDownIcon, EyeIcon, PencilSquareIcon, TrashIcon,
  XMarkIcon, PlusIcon,
} from '@heroicons/react/24/outline';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import Button from '../../common/Button/Button';
import eventsService from '../../../services/events/events.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';

const ITEMS_PER_PAGE = 10;

const initialForm = {
  name: '',
  startDate: '',
  endDate: '',
  type: '',
  appliesTo: '',
  description: '',
  academicYear: '',
};

const getStatusStyle = (status) => {
  const styles = {
    Upcoming: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    Ongoing: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
    Completed: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600',
  };
  return styles[status] || styles.Upcoming;
};

const HolidayManagement = ({ onDataChange, editHoliday, onEditHoliday, onClearHolidayEdit }) => {
  const { t } = useTranslation();
  const { academic } = useSchoolConfig();
  const [holidays, setHolidays] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...initialForm, academicYear: academic.currentYear || '' });
  const [academicYear, setAcademicYear] = useState(academic.currentYear);
  const [yearOptions, setYearOptions] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewHoliday, setViewHoliday] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const yearInitializedRef = useRef(false);
  const yearDefaultRef = useRef(false);

  useEffect(() => {
    if (yearInitializedRef.current) return;
    if (academic.currentYear) {
      yearInitializedRef.current = true;
      setAcademicYear(academic.currentYear);
    }
  }, [academic.currentYear]);

  useEffect(() => {
    if (yearDefaultRef.current) return;
    if (academic.currentYear && !form.academicYear) {
      yearDefaultRef.current = true;
      setForm((prev) => ({ ...prev, academicYear: academic.currentYear }));
    }
  }, [academic.currentYear, form.academicYear]);

  useEffect(() => {
    let mounted = true;
    eventsService
      .getHolidayAcademicYears()
      .then((years) => {
        if (mounted) setYearOptions(years || []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const isEditing = !!editHoliday;

  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: ITEMS_PER_PAGE };
      if (academicYear) params.academicYear = academicYear;
      if (typeFilter) params.type = typeFilter;
      const result = await eventsService.getHolidays(params);
      setHolidays(result.holidays || []);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalItems(result.pagination?.totalItems || 0);
    } catch {
      setHolidays([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [academicYear, typeFilter, currentPage]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  useEffect(() => {
    if (editHoliday) {
      setForm({
        name: editHoliday.name || '',
        startDate: editHoliday.startDate || '',
        endDate: editHoliday.endDate || '',
        type: editHoliday.type || '',
        appliesTo: editHoliday.appliesTo || '',
        description: editHoliday.description || '',
        academicYear: editHoliday.academicYear || academic.currentYear || '',
      });
      setShowForm(true);
    }
  }, [editHoliday, academic.currentYear]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const calcDays = (s, e) => {
    if (!s || !e) return 0;
    return Math.floor((new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleAdd = async () => {
    if (!form.name || !form.startDate || !form.endDate || !form.type) {
      toast.error(t('pleaseFillRequired'));
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error(t('endDateAfterStart'));
      return;
    }
    if (!form.academicYear) {
      toast.error(t('pleaseFillRequired'));
      return;
    }
    if (!/^\d{4}$/.test(form.academicYear)) {
      toast.error(t('invalidAcademicYear'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        academicYear: form.academicYear,
      };
      if (isEditing) {
        await eventsService.updateHoliday(editHoliday._id, payload);
        toast.success(`${t('holiday')} ${t('updatedSuccessfully')}`);
        onClearHolidayEdit();
      } else {
        await eventsService.createHoliday(payload);
        toast.success(`${t('holiday')} ${t('savedSuccessfully')}`);
      }
      setForm({ ...initialForm, academicYear: academic.currentYear || '' });
      setShowForm(false);
      onDataChange();
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToSave');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await eventsService.deleteHoliday(deleteTarget._id);
      toast.success(t('holidayDeleted'));
    } catch {
      toast.error(t('failedToDelete'));
    }
    setDeleteTarget(null);
    setDeleting(false);
    onDataChange();
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }

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
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('holiday')}s</h2>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-sm transition-all flex items-center gap-2 cursor-pointer">
            <PlusIcon className="h-4 w-4" /> {showForm ? t('cancel') : t('addHoliday')}
          </button>
        </div>

        {showForm && (
          <div className="mb-5 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">{isEditing ? t('editHoliday') : t('newHoliday')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('holidayName')} <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder={t('holidayName')} />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('academicYearLabel')} <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.academicYear}
                  onChange={(e) => update('academicYear', e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                  placeholder={t('enterAcademicYear')}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('startDate')} <span className="text-red-500">*</span></label>
                <input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('endDate')} <span className="text-red-500">*</span></label>
                <input type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('holidayType')} <span className="text-red-500">*</span></label>
                <div className="relative">
                  <select value={form.type} onChange={(e) => update('type', e.target.value)}
                    className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                    <option value="" disabled>{t('selectType')}</option>
                    {eventsService.HOLIDAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('appliesTo')}</label>
                <div className="relative">
                  <select value={form.appliesTo} onChange={(e) => update('appliesTo', e.target.value)}
                    className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                    <option value="" disabled>{t('select')}</option>
                    {eventsService.AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div className="mb-4 sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('description')}</label>
                <input type="text" value={form.description} onChange={(e) => update('description', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder={t('notes')} />
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <Button onClick={handleAdd} loading={saving} className="!w-auto !px-5">
                {isEditing ? t('updateHoliday') : t('saveHoliday')}
              </Button>
              <button onClick={() => { setForm({ ...initialForm, academicYear: academic.currentYear || '' }); setShowForm(false); if (isEditing) onClearHolidayEdit(); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer">
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('academicYearLabel')}</label>
            <div className="relative mt-1">
              <select value={academicYear} onChange={(e) => { setAcademicYear(e.target.value); setCurrentPage(1); }}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                <option value="">{t('allYears')}</option>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('holidayType')}</label>
            <div className="relative mt-1">
              <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                <option value="">{t('allTypes')}</option>
                {eventsService.HOLIDAY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('holidayName')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('startDate')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('endDate')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('totalDays')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('holidayType')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('appliesTo')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('status')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {holidays.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">{t('noHolidaysFound')}</td></tr>
            ) : (
              holidays.map((h) => (
                <tr key={h._id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">{h.name}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{h.startDateDisplay}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{h.endDateDisplay}</td>
                  <td className="px-3 py-3 text-xs font-mono font-medium text-gray-700 dark:text-gray-300">{h.totalDays}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700">
                      {h.type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{h.appliesTo}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusStyle(h.status)}`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewHoliday(h)} className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer" title={t('view')}>
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => onEditHoliday(h)} className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors cursor-pointer" title={t('edit')}>
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(h)} className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer" title={t('delete')}>
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {totalItems > 0 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
            {totalItems} {totalItems !== 1 ? `${t('holiday')}s` : t('holiday')}
          </div>
        )}
      </div>

      {renderPagination()}

      {/* View Modal */}
      {viewHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewHoliday(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('holidayDetails')}</h2>
              <button onClick={() => setViewHoliday(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 max-h-[80vh] overflow-y-auto">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{viewHoliday.name}</h3>
              <div className="space-y-3">
                {[
                  [t('type'), viewHoliday.type],
                  [t('startDate'), viewHoliday.startDateDisplay],
                  [t('endDate'), viewHoliday.endDateDisplay],
                  [t('totalDays'), viewHoliday.totalDays],
                  [t('appliesTo'), viewHoliday.appliesTo],
                  [t('academicYearLabel'), viewHoliday.academicYear],
                  [t('status'), viewHoliday.status],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{value}</span>
                  </div>
                ))}
                {viewHoliday.description && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">{t('description')}</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">{viewHoliday.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        title={t('deleteHoliday')}
        message={t('deleteHolidayConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
};

export default HolidayManagement;
