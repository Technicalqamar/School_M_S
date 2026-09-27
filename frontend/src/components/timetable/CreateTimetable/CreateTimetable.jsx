import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Table from '../../common/Table/Table';
import ActionButtons from '../../common/ActionButtons/ActionButtons';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import Spinner from '../../common/Spinner/Spinner';
import timetableEntryService from '../../../services/timetable/timetableEntry.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { useFormatTime } from '../../../hooks/useLocalization';
import CreateTimetableFormModal from './CreateTimetableFormModal';

const groupBadgeClass = (group) =>
  group === 1
    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
    : group === 2
      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
      : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';

const toDate = (time) => new Date(`1970-01-01T${time}:00`);

const CreateTimetable = () => {
  const { academic } = useSchoolConfig();
  const formatClock = useFormatTime();
  const centralYear = String(academic.currentYear || '').trim();

  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const requestRef = useRef(0);

  const [showForm, setShowForm] = useState(false);
  const [formEntry, setFormEntry] = useState(null); // null => create mode
  const [formSession, setFormSession] = useState(0);

  const [deletingEntry, setDeletingEntry] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEntries = useCallback(
    async ({ silent = true } = {}) => {
      const reqId = ++requestRef.current;
      if (!silent) setLoading(true);
      setRefreshing(true);
      try {
        const params = { limit: 100 };
        // The academic year always comes from the school's central setting.
        if (centralYear) params.academicYear = centralYear;
        const result = await timetableEntryService.getAllTimetableEntries(params);
        if (reqId !== requestRef.current) return;
        setEntries(result.data?.timetableEntries || []);
        setTotalCount(result.data?.pagination?.totalItems || 0);
        setLoadError(null);
      } catch (err) {
        if (reqId !== requestRef.current) return;
        setLoadError(err.response?.data?.message || 'Failed to load timetable entries');
      } finally {
        if (reqId === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [centralYear],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEntries({ silent: false });
  }, [fetchEntries]);

  const openCreate = () => {
    setFormEntry(null);
    setFormSession((s) => s + 1);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setFormEntry(item);
    setFormSession((s) => s + 1);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setFormEntry(null);
    fetchEntries();
  };

  const handleDelete = async () => {
    if (!deletingEntry) return;
    setDeleting(true);
    try {
      const result = await timetableEntryService.deleteTimetableEntry(deletingEntry._id);
      toast.success(result.message || 'Timetable entry deleted successfully');
      setDeletingEntry(null);
      fetchEntries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete timetable entry');
    } finally {
      setDeleting(false);
    }
  };

  const tableColumns = [
    { key: 'group', label: 'Group' },
    { key: 'class', label: 'Class' },
    { key: 'timeSlot', label: 'Time Slot' },
    { key: 'subject', label: 'Subject' },
    { key: 'teacher', label: 'Teacher' },
    { key: 'actions', label: '', className: 'text-right' },
  ];

  const renderRow = (item) => (
    <>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${groupBadgeClass(
            item.group,
          )}`}
        >
          Group {item.group}
        </span>
      </td>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
        {item.classId?.className || '—'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-medium text-gray-900 dark:text-white">
          {item.timeSlotId
            ? `${formatClock(toDate(item.timeSlotId.startTime))} – ${formatClock(toDate(item.timeSlotId.endTime))}`
            : '—'}
        </span>
        {item.timeSlotId?.label && (
          <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.timeSlotId.label}</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-gray-700 dark:text-gray-300">{item.subjectId?.subjectName || '—'}</span>
        {item.subjectId?.subjectCode && (
          <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.subjectId.subjectCode}</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {item.teacherId ? (
          <>
            <span className="text-gray-700 dark:text-gray-300">{item.teacherId.fullName || '—'}</span>
            {item.teacherId.teacherId && (
              <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.teacherId.teacherId}</span>
            )}
          </>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <ActionButtons onEdit={() => openEdit(item)} onDelete={() => setDeletingEntry(item)} />
      </td>
    </>
  );

  const selectClass =
    'appearance-none px-4 py-2.5 pr-9 rounded-lg border text-sm font-medium transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer';

  const deletionMessage = useMemo(() => {
    if (!deletingEntry) return '';
    const className = deletingEntry.classId?.className || 'this class';
    const slot = deletingEntry.timeSlotId
      ? `${formatClock(toDate(deletingEntry.timeSlotId.startTime))} – ${formatClock(toDate(deletingEntry.timeSlotId.endTime))}`
      : 'this time slot';
    const subjectName = deletingEntry.subjectId?.subjectName || 'this subject';
    return `Are you sure you want to delete the ${subjectName} entry for ${className} at ${slot}? This cannot be undone.`;
  }, [deletingEntry, formatClock]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Timetable</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Schedule each class into its time slots with one subject per slot. The teacher is resolved automatically
            from Class Management — it is never assigned manually.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
          <div className="relative">
            <select
              value={centralYear}
              onChange={() => {}}
              disabled={!centralYear}
              className={selectClass}
              aria-label="Academic Year"
            >
              {centralYear ? <option value={centralYear}>{centralYear}</option> : <option value="">Loading...</option>}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => fetchEntries()}
            disabled={refreshing || loading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <PlusIcon className="h-4 w-4" /> Add Timetable Entry
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 min-w-0">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{loadError}</span>
          </div>
          <button
            onClick={() => fetchEntries({ silent: false })}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {totalCount} entr{totalCount === 1 ? 'y' : 'ies'}
            <span className="text-gray-400 dark:text-gray-500"> · Academic Year {centralYear || '—'}</span>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Sorted by class, then slot time</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
            <Spinner size="md" />
            <p className="mt-3 text-sm">Loading timetable entries...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <CalendarDaysIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">No timetable entries yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Schedule a class, time slot and subject to start building the {centralYear || 'academic year'} timetable.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer mx-auto"
            >
              <PlusIcon className="h-4 w-4" /> Add Timetable Entry
            </button>
          </div>
        ) : (
          <Table columns={tableColumns} data={entries} renderRow={renderRow} />
        )}
      </div>

      <CreateTimetableFormModal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setFormEntry(null);
        }}
        onSaved={handleSaved}
        entry={formEntry}
        year={centralYear}
        entries={entries}
        key={formSession}
      />

      <ConfirmationModal
        isOpen={Boolean(deletingEntry)}
        onClose={() => setDeletingEntry(null)}
        title="Delete Timetable Entry"
        message={deletionMessage}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default CreateTimetable;