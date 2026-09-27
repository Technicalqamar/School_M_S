import { useState, useEffect, useMemo } from 'react';
import { ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Modal from '../../common/Modal/Modal';
import Button from '../../common/Button/Button';
import Spinner from '../../common/Spinner/Spinner';
import classService from '../../../services/class/class.service';
import timeSlotService from '../../../services/timetable/timeSlot.service';
import timetableEntryService from '../../../services/timetable/timetableEntry.service';
import { useFormatTime } from '../../../hooks/useLocalization';

// Groups are derived from the existing Class Management data (the fixed class
// name set). Only the *group definitions* are listed here — the actual class
// options in the dropdown always come from the Class Management backend.
const GROUP_DEFS = [
  { id: 1, label: 'Group 1', note: 'Montessori · Nursery · KG 1 · KG 2' },
  { id: 2, label: 'Group 2', note: 'Class 1 – Class 5' },
  { id: 3, label: 'Group 3', note: 'Class 6 – Class 10' },
];

const GROUP_NAMES = {
  1: ['Montessori', 'Nursery', 'KG 1', 'KG 2'],
  2: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'],
  3: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'],
};

const normalizeKey = (value) => String(value || '').toLowerCase().replace(/\s+/g, '');

// Mirrors the backend derivation: map a class name to its group, with a numeric
// fallback so an out-of-enum class name never crashes the dropdown.
const groupOfClass = (className) => {
  const key = normalizeKey(className);
  for (const groupId of [1, 2, 3]) {
    if (GROUP_NAMES[groupId].some((name) => normalizeKey(name) === key)) return groupId;
  }
  const numeric = String(className || '').match(/(\d+)/);
  if (numeric) {
    const n = Number(numeric[1]);
    if (n >= 1 && n <= 5) return 2;
    if (n >= 6 && n <= 10) return 3;
  }
  return null;
};

const toDate = (time) => new Date(`1970-01-01T${time}:00`);

const initialForm = { group: '', classId: '', slotId: '', subjectId: '' };

const buildInitialForm = (entry) =>
  entry
    ? {
        group: entry.group ? String(entry.group) : '',
        classId: entry.classId?._id ? String(entry.classId._id) : '',
        slotId: entry.timeSlotId?._id ? String(entry.timeSlotId._id) : '',
        subjectId: entry.subjectId?._id ? String(entry.subjectId._id) : '',
      }
    : initialForm;

const selectClass =
  'appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border text-sm transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer';

const CreateTimetableFormModal = ({ isOpen, onClose, onSaved, entry, year, entries }) => {
  // Fresh state per open: the parent remounts this modal (via a changing `key`)
  // so create/edit always starts from the target entry, never stale values.
  const [form, setForm] = useState(() => buildInitialForm(entry));
  // Reference data loaded from the real backends (Class Management + Time Slots).
  const [classes, setClasses] = useState([]);
  const [slots, setSlots] = useState([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [supportError, setSupportError] = useState(null);
  // Class → subjects/teachers payload from Class Management's teacher-assignment
  // endpoint (the source of truth for which subjects and teachers are valid).
  const [assignments, setAssignments] = useState(null);
  const [assignError, setAssignError] = useState(null);
  // Inline conflict message (backend 400/409: teacher overlap, duplicate, ...).
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const formatClock = useFormatTime();

  // Load classes (+ the year's time slots) every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const load = async () => {
      try {
        const [classesResult, slotsResult] = await Promise.all([
          classService.getAllClasses(),
          timeSlotService.getAllTimeSlots({ academicYear: year, limit: 100 }),
        ]);
        if (!active) return;
        setClasses(classesResult.data?.classes || []);
        setSlots(slotsResult.data?.timeSlots || []);
        setSupportError(null);
      } catch (err) {
        if (!active) return;
        setSupportError(err.response?.data?.message || 'Failed to load classes and time slots');
      } finally {
        if (active) setSupportLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isOpen, year]);

  // Load the selected class's subjects + teacher assignments from Class
  // Management whenever (and only when) a class is chosen.
  useEffect(() => {
    if (!form.classId || !isOpen) return;
    let active = true;
    const load = async () => {
      try {
        const result = await classService.getClassTeacherAssignments(form.classId);
        if (!active) return;
        setAssignments(result.data || {});
        setAssignError(null);
      } catch (err) {
        if (!active) return;
        setAssignError(err.response?.data?.message || 'Failed to load class assignments');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [form.classId, isOpen]);

  const yearClasses = useMemo(
    () => classes.filter((c) => String(c.academicYear) === String(year) && c.status === 'Active'),
    [classes, year],
  );

  const groupClassOptions = useMemo(
    () => yearClasses.filter((c) => form.group && groupOfClass(c.className) === Number(form.group)),
    [yearClasses, form.group],
  );

  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))),
    [slots],
  );

  // Slots already used by the selected class are offered as disabled so the
  // backend (still authoritative) is rarely asked to reject a duplicate.
  const usedSlotIds = useMemo(() => {
    const set = new Set();
    if (!form.classId) return set;
    for (const e of entries || []) {
      if (String(e.classId?._id) === form.classId) set.add(String(e.timeSlotId?._id));
    }
    // Editing: keep the entry's own slot selectable.
    if (entry) set.delete(String(entry.timeSlotId?._id));
    return set;
  }, [entries, form.classId, entry]);

  const classSubjects = assignments?.classSubjects || [];

  const teacherBySubject = useMemo(() => {
    const map = {};
    for (const assignment of assignments?.teacherAssignments || []) {
      for (const subject of assignment.subjects || []) {
        map[String(subject._id)] = assignment.teacher;
      }
    }
    return map;
  }, [assignments]);

  const resolvedTeacher = form.subjectId ? teacherBySubject[String(form.subjectId)] : null;

  const assignmentLoading = Boolean(form.classId) && !assignments && !assignError;

  const handleGroupChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, group: value, classId: '', subjectId: '' }));
    setError('');
    setAssignments(null);
    setAssignError(null);
  };

  const handleClassChange = (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, classId: value, subjectId: '' }));
    setError('');
    setAssignments(null);
    setAssignError(null);
  };

  const handleSlotChange = (e) => {
    setForm((prev) => ({ ...prev, slotId: e.target.value }));
    setError('');
  };

  const handleSubjectChange = (e) => {
    setForm((prev) => ({ ...prev, subjectId: e.target.value }));
    setError('');
  };

  const validate = () => {
    if (!form.group) {
      setError('Please select a group');
      return false;
    }
    if (!form.classId) {
      setError('Please select a class');
      return false;
    }
    if (!form.slotId) {
      setError('Please select a time slot');
      return false;
    }
    if (!form.subjectId) {
      setError(
        classSubjects.length > 0
          ? 'Please select a subject'
          : 'This class has no subjects assigned in Class Management',
      );
      return false;
    }
    if (!resolvedTeacher) {
      setError('This subject has no teacher assigned to it for the selected class. Add the teacher in Class Management first.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setError('');

    const payload = {
      academicYear: year,
      classId: form.classId,
      timeSlotId: form.slotId,
      subjectId: form.subjectId,
    };
    // The teacher is deliberately NOT sent — the backend resolves it from the
    // Class Management assignment and rejects a manual teacherId.

    try {
      const result = entry
        ? await timetableEntryService.updateTimetableEntry(entry._id, payload)
        : await timetableEntryService.createTimetableEntry(payload);
      toast.success(result.message || (entry ? 'Timetable entry updated successfully' : 'Timetable entry created successfully'));
      onSaved();
    } catch (err) {
      // Conflict (teacher already teaching another class, duplicate class+slot,
      // break slot, validation, ...): keep the form open and surface the actual
      // backend message instead of swallowing it.
      const message = err.response?.data?.message || 'Failed to save timetable entry';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={entry ? 'Edit Timetable Entry' : 'Add Timetable Entry'} maxWidth="max-w-2xl">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        {entry
          ? 'Change the class, time slot or subject of this timetable entry. The teacher is resolved automatically from Class Management.'
          : 'Schedule one class into one time slot with one subject. The teacher is resolved automatically — it is never manually selected.'}
      </p>

      {supportLoading && (
        <div className="flex items-center gap-2 justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
          <Spinner size="sm" /> Loading classes and time slots...
        </div>
      )}

      {supportError && !supportLoading && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 mb-4">
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 min-w-0">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{supportError}</span>
          </div>
          <button
            onClick={() => {
              setSupportLoading(true);
              setSupportError(null);
              setClasses([]);
              setSlots([]);
              const reload = async () => {
                try {
                  const [classesResult, slotsResult] = await Promise.all([
                    classService.getAllClasses(),
                    timeSlotService.getAllTimeSlots({ academicYear: year, limit: 100 }),
                  ]);
                  setClasses(classesResult.data?.classes || []);
                  setSlots(slotsResult.data?.timeSlots || []);
                  setSupportError(null);
                } catch (err) {
                  setSupportError(err.response?.data?.message || 'Failed to load classes and time slots');
                } finally {
                  setSupportLoading(false);
                }
              };
              reload();
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 mb-4">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {!supportLoading && !supportError && (
        <div className="space-y-5">
          {/* 1 · Academic Year — read-only, from the school's central setting */}
          <div>
            <label htmlFor="timetableAcademicYear" className={stepLabelClass}>
              1 · Academic Year
            </label>
            <input
              id="timetableAcademicYear"
              type="text"
              value={year || '—'}
              disabled
              className="appearance-none w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed"
            />
          </div>

          {/* 2 · Group */}
          <div>
            <label htmlFor="timetableGroup" className={stepLabelClass}>
              2 · Group <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="timetableGroup"
                value={form.group}
                onChange={handleGroupChange}
                className={selectClass}
              >
                <option value="">Select group...</option>
                {GROUP_DEFS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} — {g.note}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* 3 · Class — options come from Class Management, filtered by the group */}
          <div>
            <label htmlFor="timetableClass" className={stepLabelClass}>
              3 · Class <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="timetableClass"
                value={form.classId}
                onChange={handleClassChange}
                disabled={!form.group}
                className={`${selectClass} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <option value="">{form.group ? 'Select class...' : 'Select a group first'}</option>
                {groupClassOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.className}
                  </option>
                ))}
                {form.group && groupClassOptions.length === 0 && (
                  <option value="" disabled>
                    No classes in this group for {year}
                  </option>
                )}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* 4 · Time Slot — real slots from the Time Slots backend; breaks are disabled */}
          <div>
            <label htmlFor="timetableSlot" className={stepLabelClass}>
              4 · Time Slot <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="timetableSlot"
                value={form.slotId}
                onChange={handleSlotChange}
                className={selectClass}
              >
                <option value="">Select time slot...</option>
                {sortedSlots.map((slot) => {
                  const isBreak = slot.type === 'BREAK';
                  const alreadyUsed = usedSlotIds.has(String(slot._id));
                  const disabled = isBreak || alreadyUsed;
                  const suffix = isBreak
                    ? ' · Break'
                    : alreadyUsed
                      ? ' · already scheduled for this class'
                      : '';
                  return (
                    <option key={slot._id} value={slot._id} disabled={disabled}>
                      {formatClock(toDate(slot.startTime))} – {formatClock(toDate(slot.endTime))}
                      {slot.label ? ` · ${slot.label}` : ''}
                      {suffix}
                    </option>
                  );
                })}
                {sortedSlots.length === 0 && (
                  <option value="" disabled>
                    No time slots defined for {year}
                  </option>
                )}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              A Break can never be scheduled for a subject entry. Slots already scheduled for this class are disabled.
            </p>
          </div>

          {/* 5 · Subject — only subjects actually assigned to the class */}
          <div>
            <label htmlFor="timetableSubject" className={stepLabelClass}>
              5 · Subject <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="timetableSubject"
                value={form.subjectId}
                onChange={handleSubjectChange}
                disabled={!form.classId || assignmentLoading || Boolean(assignError)}
                className={`${selectClass} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {!form.classId ? (
                  <option value="">Select a class first</option>
                ) : assignmentLoading ? (
                  <option value="">Loading subjects...</option>
                ) : assignError ? (
                  <option value="">Failed to load subjects</option>
                ) : (
                  <>
                    <option value="">Select subject...</option>
                    {classSubjects.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.subjectName}
                        {s.subjectCode ? ` (${s.subjectCode})` : ''}
                      </option>
                    ))}
                    {classSubjects.length === 0 && (
                      <option value="" disabled>
                        No subjects assigned to this class
                      </option>
                    )}
                  </>
                )}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            {assignError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{assignError}</p>
            )}
          </div>

          {/* 6 · Teacher — read-only, never a manual selection */}
          <div>
            <label htmlFor="timetableTeacher" className={stepLabelClass}>
              6 · Teacher
            </label>
            <input
              id="timetableTeacher"
              type="text"
              disabled
              value={
                resolvedTeacher
                  ? `${resolvedTeacher.fullName || '—'}${resolvedTeacher.teacherId ? ` (${resolvedTeacher.teacherId})` : ''}`
                  : form.subjectId
                    ? 'No teacher assigned to this subject for the class'
                    : 'Select a subject to resolve the teacher'
              }
              className="appearance-none w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Resolved automatically from the Class Management assignment for this class + subject. Teachers are never
              manually selected here.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              {entry ? 'Save Changes' : 'Create Timetable Entry'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default CreateTimetableFormModal;