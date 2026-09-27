import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Table from '../../common/Table/Table';
import ActionButtons from '../../common/ActionButtons/ActionButtons';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import Spinner from '../../common/Spinner/Spinner';
import timeSlotService from '../../../services/timetable/timeSlot.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { useFormatTime } from '../../../hooks/useLocalization';
import TimeSlotFormModal from './TimeSlotFormModal';

const typeBadgeClass = (type) =>
  type === 'BREAK'
    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';

const statusBadgeClass = (status) =>
  status === 'Active'
    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400';

const durationMinutes = (start, end) => {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};

const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} hr ${m} min`;
  if (h > 0) return `${h} hr`;
  return `${m} min`;
};

const TimeSlots = () => {
  const { academic } = useSchoolConfig();
  const formatClock = useFormatTime();
  // The single academic year this tab manages comes from the school's central
  // setting — never a hard-coded value.
  const centralYear = String(academic.currentYear || '').trim();

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const requestRef = useRef(0);

  const [showForm, setShowForm] = useState(false);
  const [formSlot, setFormSlot] = useState(null); // null => create mode
  // Incremented on every open so the form modal remounts with fresh state.
  const [formSession, setFormSession] = useState(0);

  const [deletingSlot, setDeletingSlot] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSlots = useCallback(
    async ({ silent = true } = {}) => {
      const reqId = ++requestRef.current;
      if (!silent) setLoading(true);
      setRefreshing(true);
      try {
        const params = { limit: 100 };
        if (centralYear) params.academicYear = centralYear;
        const result = await timeSlotService.getAllTimeSlots(params);
        if (reqId !== requestRef.current) return;
        setSlots(result.data?.timeSlots || []);
        setLoadError(null);
      } catch (err) {
        if (reqId !== requestRef.current) return;
        setLoadError(err.response?.data?.message || 'Failed to load time slots');
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
    fetchSlots({ silent: false });
  }, [fetchSlots]);

  // Slots always render chronologically (the backend also sorts them this way).
  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))),
    [slots],
  );

  const openCreate = () => {
    setFormSlot(null);
    setFormSession((s) => s + 1);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setFormSlot(item);
    setFormSession((s) => s + 1);
    setShowForm(true);
  };

  const handleSaved = () => {
    setShowForm(false);
    setFormSlot(null);
    fetchSlots();
  };

  const handleDelete = async () => {
    if (!deletingSlot) return;
    setDeleting(true);
    try {
      const result = await timeSlotService.deleteTimeSlot(deletingSlot._id);
      toast.success(result.message || 'Time slot deleted successfully');
      setDeletingSlot(null);
      fetchSlots();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete time slot');
    } finally {
      setDeleting(false);
    }
  };

  const tableColumns = [
    { key: 'order', label: '#' },
    { key: 'startTime', label: 'Start Time' },
    { key: 'endTime', label: 'End Time' },
    { key: 'duration', label: 'Duration' },
    { key: 'type', label: 'Type' },
    { key: 'label', label: 'Label' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: '', className: 'text-right' },
  ];

  const renderRow = (item) => {
    const index = sortedSlots.indexOf(item);
    return (
      <>
        <td className="px-4 py-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700/60 text-xs font-semibold text-gray-600 dark:text-gray-300">
            {index + 1}
          </span>
        </td>
        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white whitespace-nowrap">
          {formatClock(new Date(`1970-01-01T${item.startTime}:00`))}
        </td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {formatClock(new Date(`1970-01-01T${item.endTime}:00`))}
        </td>
        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
          {formatDuration(durationMinutes(item.startTime, item.endTime))}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${typeBadgeClass(
              item.type,
            )}`}
          >
            {item.type === 'BREAK' ? 'Break' : 'Period'}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[220px]">
          <span className="block truncate">{item.label || '—'}</span>
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusBadgeClass(
              item.status,
            )}`}
          >
            {item.status}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <ActionButtons onEdit={() => openEdit(item)} onDelete={() => setDeletingSlot(item)} />
        </td>
      </>
    );
  };

  const selectClass =
    'appearance-none px-4 py-2.5 pr-9 rounded-lg border text-sm font-medium transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Time Slots</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Define the teaching periods and breaks that make up the school day. Time slots are saved to the backend and
            stay consistent for the whole Timetable module.
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
            onClick={() => fetchSlots()}
            disabled={refreshing || loading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <PlusIcon className="h-4 w-4" /> Add Time Slot
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
            onClick={() => fetchSlots({ silent: false })}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {sortedSlots.length} slot{sortedSlots.length === 1 ? '' : 's'}
            <span className="text-gray-400 dark:text-gray-500"> · Academic Year {centralYear || '—'}</span>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Sorted by start time</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
            <Spinner size="md" />
            <p className="mt-3 text-sm">Loading time slots...</p>
          </div>
        ) : sortedSlots.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <ClockIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">No time slots found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Add the teaching periods and breaks for {centralYear || 'the academic year'} to get started.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer mx-auto"
            >
              <PlusIcon className="h-4 w-4" /> Add Time Slot
            </button>
          </div>
        ) : (
          <Table columns={tableColumns} data={sortedSlots} renderRow={renderRow} />
        )}
      </div>

      <TimeSlotFormModal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setFormSlot(null);
        }}
        onSaved={handleSaved}
        slot={formSlot}
        year={centralYear}
        key={formSession}
      />

      <ConfirmationModal
        isOpen={Boolean(deletingSlot)}
        onClose={() => setDeletingSlot(null)}
        title="Delete Time Slot"
        message={
          deletingSlot
            ? `Are you sure you want to delete the ${deletingSlot.type === 'BREAK' ? 'break' : 'period'} slot ${
                deletingSlot.startTime
              } – ${deletingSlot.endTime}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default TimeSlots;