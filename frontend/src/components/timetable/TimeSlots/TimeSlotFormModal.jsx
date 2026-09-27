import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Modal from '../../common/Modal/Modal';
import Button from '../../common/Button/Button';
import timeSlotService from '../../../services/timetable/timeSlot.service';

// Same 24-hour HH:mm format enforced by the Time Slots backend.
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const toMinutes = (time) => {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
};

const initialForm = { startTime: '', endTime: '', type: 'PERIOD', label: '', status: 'Active' };

const buildInitialForm = (slot) =>
  slot
    ? {
        startTime: slot.startTime,
        endTime: slot.endTime,
        type: slot.type,
        label: slot.label || '',
        status: slot.status || 'Active',
      }
    : initialForm;

const inputClass =
  'appearance-none w-full px-4 py-2.5 rounded-lg border text-sm transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-gray-400';

const selectClass =
  'appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border text-sm transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer';

const TimeSlotFormModal = ({ isOpen, onClose, onSaved, slot, year }) => {
  // Fresh state per open: the parent remounts this modal (via a changing `key`)
  // so create/edit always starts from the target slot, never stale values.
  const [form, setForm] = useState(() => buildInitialForm(slot));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const next = {};
    const start = (form.startTime || '').trim();
    const end = (form.endTime || '').trim();

    if (!start) next.startTime = 'Start time is required';
    else if (!TIME_REGEX.test(start)) next.startTime = 'Start time must be in HH:mm format';

    if (!end) next.endTime = 'End time is required';
    else if (!TIME_REGEX.test(end)) next.endTime = 'End time must be in HH:mm format';

    if (!next.startTime && !next.endTime && toMinutes(end) <= toMinutes(start)) {
      next.endTime = 'End time must be after start time';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    const payload = {
      startTime: form.startTime.trim(),
      endTime: form.endTime.trim(),
      type: form.type,
      label: form.label.trim(),
      status: form.status,
    };
    // The academic year always comes from the school's central setting; it is
    // never typed or hard-coded. The backend also defaults to it when omitted.
    if (year) payload.academicYear = year;

    try {
      const result = slot
        ? await timeSlotService.updateTimeSlot(slot._id, payload)
        : await timeSlotService.createTimeSlot(payload);
      toast.success(result.message || (slot ? 'Time slot updated successfully' : 'Time slot created successfully'));
      onSaved();
    } catch (err) {
      // 400 validation, 409 duplicate/overlap, 404 etc. — always show the backend message.
      toast.error(err.response?.data?.message || 'Failed to save time slot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={slot ? 'Edit Time Slot' : 'Add Time Slot'} maxWidth="max-w-lg">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        {slot
          ? 'Update the time range or details of this slot. Slots must not overlap with other slots in the same academic year.'
          : 'Add a teaching period or break to the school day. Breaks are added explicitly and never require a subject or teacher.'}
      </p>

      {/* Academic Year — read-only, sourced from the school settings */}
      <div className="mb-4">
        <label htmlFor="timeSlotAcademicYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Academic Year
        </label>
        <input
          id="timeSlotAcademicYear"
          type="text"
          value={year || '—'}
          disabled
          className="appearance-none w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Uses the school&apos;s current academic year setting.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="timeSlotStartTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Start Time <span className="text-red-500">*</span>
          </label>
          <input
            id="timeSlotStartTime"
            name="startTime"
            type="time"
            value={form.startTime}
            onChange={handleChange}
            className={inputClass}
          />
          {errors.startTime && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.startTime}</p>}
        </div>
        <div>
          <label htmlFor="timeSlotEndTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            End Time <span className="text-red-500">*</span>
          </label>
          <input
            id="timeSlotEndTime"
            name="endTime"
            type="time"
            value={form.endTime}
            onChange={handleChange}
            className={inputClass}
          />
          {errors.endTime && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.endTime}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="timeSlotType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Slot Type <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select id="timeSlotType" name="type" value={form.type} onChange={handleChange} className={selectClass}>
              <option value="PERIOD">Period</option>
              <option value="BREAK">Break</option>
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {form.type === 'BREAK'
              ? 'Breaks are explicit slots and never require a subject or teacher.'
              : 'A normal teaching period.'}
          </p>
        </div>
        <div>
          <label htmlFor="timeSlotStatus" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Status
          </label>
          <div className="relative">
            <select id="timeSlotStatus" name="status" value={form.status} onChange={handleChange} className={selectClass}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Inactive slots are kept but not used by the timetable.</p>
        </div>
      </div>

      <div className="mb-2">
        <label htmlFor="timeSlotLabel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Label <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="timeSlotLabel"
          name="label"
          type="text"
          value={form.label}
          onChange={handleChange}
          placeholder="e.g. Morning Break, First Period"
          maxLength={100}
          className={inputClass}
        />
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={submitting}>
          {slot ? 'Save Changes' : 'Create Time Slot'}
        </Button>
      </div>
    </Modal>
  );
};

export default TimeSlotFormModal;