import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowPathIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  PrinterIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Spinner from '../../common/Spinner/Spinner';
import timetableDesignerService from '../../../services/timetable/timetableDesigner.service';
import timetableEntryService from '../../../services/timetable/timetableEntry.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { useFormatTime } from '../../../hooks/useLocalization';
import CreateTimetableFormModal from '../CreateTimetable/CreateTimetableFormModal';
import EntryDetailsModal from './EntryDetailsModal';
import { buildTimetablePrintHtml, printTimetable, downloadTimetablePdf } from './timetablePrint';

// Only the group DEFINITIONS are listed here — the actual class columns always
// come from the Class Management backend via the Designer API, so newly created
// classes appear in the grid automatically (never hard-coded).
const GROUP_PILLS = [
  { id: 1, label: 'Group 1', note: 'Montessori · Nursery · KG 1 · KG 2' },
  { id: 2, label: 'Group 2', note: 'Class 1 – Class 5' },
  { id: 3, label: 'Group 3', note: 'Class 6 – Class 10' },
];

const toDate = (time) => new Date(`1970-01-01T${time}:00`);

const selectClass =
  'appearance-none px-4 py-2.5 pr-9 rounded-lg border text-sm font-medium transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer';

const Designer = () => {
  const { academic, schoolInfo, localization } = useSchoolConfig();
  const formatClock = useFormatTime();
  const centralYear = String(academic.currentYear || '').trim();
  const timeFormat = String(localization?.timeFormat || '12');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const requestRef = useRef(0);

  const [activeGroup, setActiveGroup] = useState(1);

  // Cell interactions: a details modal (view), an edit modal (reuses the Create
  // Timetable form) and a confirmed delete — the backend stays authoritative.
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editSession, setEditSession] = useState(0);

  const fetchDesigner = useCallback(
    async ({ silent = true } = {}) => {
      const reqId = ++requestRef.current;
      if (!silent) setLoading(true);
      setRefreshing(true);
      try {
        const params = {};
        // The academic year always comes from the school's central setting.
        if (centralYear) params.academicYear = centralYear;
        const result = await timetableDesignerService.getTimetableDesigner(params);
        if (reqId !== requestRef.current) return;
        setData(result.data || null);
        setLoadError(null);
      } catch (err) {
        if (reqId !== requestRef.current) return;
        setLoadError(err.response?.data?.message || 'Failed to load the timetable');
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
    fetchDesigner({ silent: false });
  }, [fetchDesigner]);

  const timeSlots = useMemo(() => data?.timeSlots || [], [data]);

  const activeGroupData = useMemo(
    () => data?.groups?.find((g) => Number(g.group) === Number(activeGroup)) || null,
    [data, activeGroup],
  );

  const classes = activeGroupData?.classes || [];
  const scheduledCount = activeGroupData?.entries?.length || 0;

  // Adapted entries for the edit form so it can disable slots already used by
  // the class (the backend remains the authority for conflicts).
  const editEntries = useMemo(
    () => (activeGroupData?.entries || []).map((cell) => ({ classId: { _id: cell.classId }, timeSlotId: { _id: cell.timeSlotId } })),
    [activeGroupData],
  );

  const openEdit = (cell) => {
    setSelectedCell(null);
    setEditingCell(cell);
    setEditSession((s) => s + 1);
  };

  const handleEditSaved = () => {
    setEditingCell(null);
    fetchDesigner();
  };

  const handleDelete = async (cell) => {
    try {
      const result = await timetableEntryService.deleteTimetableEntry(cell.entryId);
      toast.success(result.message || 'Timetable entry deleted successfully');
      setSelectedCell(null);
      fetchDesigner();
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete timetable entry');
      return false;
    }
  };

  // Print / PDF — always uses the selected group's REAL designer data.
  const [exportingPdf, setExportingPdf] = useState(false);

  const printPayload = useMemo(() => {
    if (!data || !activeGroupData) return null;
    return {
      academicYear: data.academicYear || centralYear,
      group: activeGroupData.group,
      label: activeGroupData.label,
      note: activeGroupData.note,
      timeSlots,
      classes: activeGroupData.classes,
      grid: activeGroupData.grid,
      schoolInfo,
      timeFormat,
    };
  }, [data, activeGroupData, centralYear, timeSlots, schoolInfo, timeFormat]);

  const handlePrint = () => {
    if (!printPayload || !activeGroupData?.classes?.length) return;
    const html = buildTimetablePrintHtml(printPayload);
    if (!html) return;
    // Launches the browser's print dialog on a blank window that contains ONLY
    // the A4 timetable document — no app chrome, sidebar or buttons.
    printTimetable(html);
  };

  const handleDownloadPdf = async () => {
    if (!printPayload || !activeGroupData?.classes?.length) return;
    const html = buildTimetablePrintHtml(printPayload);
    if (!html) return;
    setExportingPdf(true);
    try {
      await downloadTimetablePdf(html, `Timetable-Group-${activeGroupData.group}-${printPayload.academicYear}.pdf`);
      toast.success(`PDF downloaded — ${activeGroupData.label} (${printPayload.academicYear})`);
    } catch {
      toast.error('Failed to generate the PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const editEntry = editingCell
    ? {
        _id: editingCell.entryId,
        group: editingCell.group,
        classId: { _id: editingCell.classId },
        timeSlotId: { _id: editingCell.timeSlotId },
        subjectId: { _id: editingCell.subjectId },
      }
    : null;

  const activePill = GROUP_PILLS.find((g) => g.id === Number(activeGroup)) || GROUP_PILLS[0];
  const logo = schoolInfo?.logo || null;

  return (
    <div className="space-y-6 min-w-0">
      {/* Professional school header — logo, name, title, academic year & principal info */}
      <header className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600" />
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {logo ? (
              <img
                src={logo}
                alt={`${schoolInfo.name || 'School'} logo`}
                className="h-14 w-14 rounded-xl object-cover ring-2 ring-blue-100 dark:ring-blue-900 flex-shrink-0"
              />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <BuildingLibraryIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                {schoolInfo.name || 'School'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Class Timetable{schoolInfo.shortName ? ` · ${schoolInfo.shortName}` : ''} · Academic Year{' '}
                {centralYear || '—'}
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right flex-shrink-0">
            <p className="text-xs text-gray-400 dark:text-gray-500">Principal</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{schoolInfo.principalName || '—'}</p>
            {(schoolInfo.registrationNumber || schoolInfo.city) && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {[schoolInfo.registrationNumber, schoolInfo.city].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Controls: Academic Year · Group · Refresh */}
      <div className="flex flex-wrap items-center gap-3">
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

        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {GROUP_PILLS.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              title={g.note}
              className={`px-4 py-2.5 text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeGroup === g.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchDesigner()}
          disabled={refreshing || loading}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>

        <div className="w-px self-stretch bg-gray-200 dark:bg-gray-700" />

        <button
          onClick={handlePrint}
          disabled={!printPayload || exportingPdf || loading}
          title={`Print ${activePill.label} (${centralYear || ''})`}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          <PrinterIcon className="h-4 w-4" /> Print
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={!printPayload || exportingPdf || loading}
          title={`Download ${activePill.label} (${centralYear || ''}) as PDF`}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          {exportingPdf ? (
            <>
              <Spinner size="sm" className="-ml-1 mr-1" /> Creating PDF...
            </>
          ) : (
            <>
              <DocumentArrowDownIcon className="h-4 w-4" /> PDF
            </>
          )}
        </button>
      </div>

      {/* Active group summary + tiny legend */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-white">{activePill.label}</span>
          <span className="text-gray-400 dark:text-gray-500"> · {activePill.note}</span>
        </p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span>
            {classes.length} class{classes.length === 1 ? '' : 'es'} · {timeSlots.length} slot
            {timeSlots.length === 1 ? '' : 's'}
          </span>
          <span className="text-blue-600 dark:text-blue-400 font-medium">{scheduledCount} scheduled</span>
          <span className="hidden sm:flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-blue-100 dark:bg-blue-900/40 inline-block" /> Scheduled
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-100 dark:bg-amber-900/40 inline-block" /> Break
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 inline-block" />{' '}
              Free
            </span>
          </span>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 min-w-0">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{loadError}</span>
          </div>
          <button
            onClick={() => fetchDesigner({ silent: false })}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Timetable grid — horizontal/vertical scrolling lives here, never on the page */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Spinner size="md" />
            <p className="mt-3 text-sm">Loading timetable...</p>
          </div>
        </div>
      ) : (
        data && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="max-h-[72vh] overflow-auto">
              {classes.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <UserGroupIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">No classes in this group</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Create {activePill.label} classes ({activePill.note}) in Class Management for{' '}
                    {centralYear || 'the academic year'} and they will appear here automatically.
                  </p>
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <CalendarDaysIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">No time slots defined</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Add the {centralYear || 'academic year'} time slots (periods and breaks) in the Time Slots tab.
                  </p>
                </div>
              ) : (
                <table className="min-w-max w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-30 w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700">
                        Time
                      </th>
                      {classes.map((cls) => {
                        const inactive = String(cls.status || '').toLowerCase() !== 'active';
                        return (
                          <th
                            key={cls._id}
                            className="sticky top-0 z-20 w-[8.5rem] px-3 py-3 text-left bg-gray-50 dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700"
                          >
                            <span className="text-sm font-semibold text-gray-900 dark:text-white block truncate">
                              {cls.className}
                            </span>
                            {inactive && cls.status ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                {cls.status}
                              </span>
                            ) : (
                              <span className="block text-[10px] text-gray-400 dark:text-gray-500">Active</span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((slot) => {
                      const isBreak = String(slot.type || '').toUpperCase() === 'BREAK';

                      if (isBreak) {
                        return (
                          <tr key={slot._id}>
                            <td className="sticky left-0 z-10 w-40 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-r border-amber-100 dark:border-amber-900/30">
                              <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {formatClock(toDate(slot.startTime))} – {formatClock(toDate(slot.endTime))}
                              </span>
                            </td>
                            <td
                              colSpan={Math.max(classes.length, 1)}
                              className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold tracking-wide">
                                  BREAK
                                </span>
                                {slot.label && (
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    {slot.label}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatClock(toDate(slot.startTime))} – {formatClock(toDate(slot.endTime))}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={slot._id}>
                          <td className="sticky left-0 z-10 w-40 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-r border-gray-200 dark:border-gray-700">
                            <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {formatClock(toDate(slot.startTime))} – {formatClock(toDate(slot.endTime))}
                            </span>
                            {slot.label && (
                              <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                                {slot.label}
                              </span>
                            )}
                          </td>
                          {classes.map((cls) => {
                            const cell = activeGroupData?.grid?.[String(slot._id)]?.[String(cls._id)];

                            if (!cell) {
                              return (
                                <td
                                  key={cls._id}
                                  className="w-[8.5rem] px-3 py-3 bg-white dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700"
                                />
                              );
                            }

                            return (
                              <td
                                key={cls._id}
                                className="w-[8.5rem] p-0 bg-white dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700"
                              >
                                <button
                                  onClick={() => setSelectedCell(cell)}
                                  title={`${cell.subjectName || 'Subject'} · ${cell.teacherFullName || 'Teacher'}`}
                                  className="w-full h-full text-left px-3 py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
                                >
                                  <span className="block text-xs font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300">
                                    {cell.teacherFullName || '—'}
                                  </span>
                                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {cell.subjectName || '—'}
                                  </span>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      )}

      {/* View/Edit/Delete an entry from its grid cell */}
      {selectedCell && (
        <EntryDetailsModal
          cell={selectedCell}
          groupLabel={activePill.label}
          onClose={() => setSelectedCell(null)}
          onEdit={() => openEdit(selectedCell)}
          onDelete={() => handleDelete(selectedCell)}
        />
      )}

      {/* Edit reuses the Create Timetable form modal, pre-filled with the entry */}
      <CreateTimetableFormModal
        isOpen={Boolean(editingCell)}
        onClose={() => setEditingCell(null)}
        onSaved={handleEditSaved}
        entry={editEntry}
        year={centralYear}
        entries={editEntries}
        key={editSession}
      />
    </div>
  );
};

export default Designer;