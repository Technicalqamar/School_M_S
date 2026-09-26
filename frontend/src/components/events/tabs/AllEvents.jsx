import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../hooks/useLocalization';
import {
  MagnifyingGlassIcon, ChevronDownIcon, EyeIcon, PencilSquareIcon,
  TrashIcon, XMarkIcon, CalendarDaysIcon, ClockIcon, MapPinIcon,
} from '@heroicons/react/24/outline';
import SearchInput from '../../common/SearchInput/SearchInput';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import eventsService from '../../../services/events/events.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';

const ITEMS_PER_PAGE = 10;

const getStatusStyle = (status) => {
  const styles = {
    Upcoming: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    Ongoing: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
    Completed: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600',
    Cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  };
  return styles[status] || styles.Upcoming;
};

const AllEvents = ({ onDataChange, onEditEvent }) => {
  const { t } = useTranslation();
  const { academic } = useSchoolConfig();
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [academicYear, setAcademicYear] = useState(academic.currentYear);
  const [yearOptions, setYearOptions] = useState([]);
  const [category, setCategory] = useState('');
  const [month, setMonth] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewEvent, setViewEvent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const yearInitializedRef = useRef(false);

  useEffect(() => {
    if (yearInitializedRef.current) return;
    if (academic.currentYear) {
      yearInitializedRef.current = true;
      setAcademicYear(academic.currentYear);
    }
  }, [academic.currentYear]);

  useEffect(() => {
    let mounted = true;
    eventsService
      .getEventAcademicYears()
      .then((years) => {
        if (mounted) setYearOptions(years || []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: currentPage, limit: ITEMS_PER_PAGE };
      if (search) params.search = search;
      if (academicYear) params.academicYear = academicYear;
      if (category) params.category = category;
      if (month) params.month = month;
      const result = await eventsService.getEvents(params);
      const mapped = (result.events || []).map((e) => ({ ...e, id: e._id, banner: e.bannerImage }));
      setEvents(mapped);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalItems(result.pagination?.totalItems || 0);
    } catch {
      setEvents([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [search, academicYear, category, month, currentPage]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await eventsService.deleteEvent(deleteTarget._id);
      toast.success(t('eventDeleted'));
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('category')}</label>
            <div className="relative mt-1">
              <select value={category} onChange={(e) => { setCategory(e.target.value); setCurrentPage(1); }}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                <option value="">{t('allCategories')}</option>
                {eventsService.EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('month')}</label>
            <div className="relative mt-1">
              <select value={month} onChange={(e) => { setMonth(e.target.value); setCurrentPage(1); }}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                <option value="">{t('allMonths')}</option>
                {eventsService.MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">&nbsp;</label>
            <SearchInput placeholder={t('searchEvents')} value={search} onChange={(v) => { setSearch(v); setCurrentPage(1); }} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('banner')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('eventName')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('category')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('eventDate')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('eventTimeLabel')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('venue')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('audience')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('status')}</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {events.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">{t('noEventsFound')}</td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event._id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-3 py-3">
                    {event.banner ? (
                      <img src={event.banner} alt={event.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: event.color }}>
                        {event.name.charAt(0)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">{event.name}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                      {event.category}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{event.dateDisplay}</td>
                  <td className="px-3 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">{event.startTime} - {event.endTime}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{event.venue}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{event.audience}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusStyle(event.status)}`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewEvent(event)} className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer" title={t('view')}>
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => onEditEvent(event)} className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors cursor-pointer" title={t('edit')}>
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(event)} className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer" title={t('delete')}>
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
            {totalItems} {totalItems !== 1 ? `${t('event')}s` : t('event')}
          </div>
        )}
      </div>

      {renderPagination()}

      {/* View Modal */}
      {viewEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewEvent(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{t('eventDetails')}</h2>
              <button onClick={() => setViewEvent(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                {viewEvent.banner ? (
                  <img src={viewEvent.banner} alt={viewEvent.name} className="w-12 h-12 rounded-xl object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: viewEvent.color }}>
                    {viewEvent.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">{viewEvent.name}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusStyle(viewEvent.status)}`}>
                    {viewEvent.status}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                  <div><p className="text-xs text-gray-500">{t('eventDate')}</p><p className="text-xs font-medium text-gray-800 dark:text-gray-200">{viewEvent.dateDisplay}</p></div>
                </div>
                <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <ClockIcon className="h-4 w-4 text-gray-400" />
                  <div><p className="text-xs text-gray-500">{t('eventTimeLabel')}</p><p className="text-xs font-medium text-gray-800 dark:text-gray-200">{viewEvent.startTime} - {viewEvent.endTime}</p></div>
                </div>
                <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <MapPinIcon className="h-4 w-4 text-gray-400" />
                  <div><p className="text-xs text-gray-500">{t('venue')}</p><p className="text-xs font-medium text-gray-800 dark:text-gray-200">{viewEvent.venue}</p></div>
                </div>
                {[
                  [t('category'), viewEvent.category],
                  [t('audience'), viewEvent.audience],
                  [t('organizer'), viewEvent.organizer],
                  [t('academicYearLabel'), viewEvent.academicYear],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{value}</span>
                  </div>
                ))}
              </div>
              {viewEvent.description && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">{t('description')}</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">{viewEvent.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        title={t('deleteEvent')}
        message={t('deleteEventConfirm', { name: deleteTarget?.name })}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
};

export default AllEvents;
