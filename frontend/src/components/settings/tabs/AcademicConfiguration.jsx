import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import CardSection from '../../common/CardSection/CardSection';
import SelectInput from '../../common/SelectInput/SelectInput';
import Input from '../../common/Input/Input';

const SCHOOL_SHIFTS = ['Morning', 'Evening', 'Both'];

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Toggle = ({ label, checked, onChange, disabled = false }) => (
  <div className="mb-4">
    <label className={`flex items-center gap-3 ${disabled ? '' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={disabled ? undefined : onChange}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        } ${
          checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={`text-sm font-medium ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
    </label>
  </div>
);

const AcademicConfiguration = ({ data, onSave, saving }) => {
  const [editing, setEditing] = useState(false);
  const [userEdits, setUserEdits] = useState({});

  const form = useMemo(() => {
    if (!editing) return { ...data };
    return { ...data, ...userEdits };
  }, [data, editing, userEdits]);

  const handleChange = (field) => (e) => {
    setUserEdits((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleToggle = (field) => () => {
    setUserEdits((prev) => ({ ...prev, [field]: !form[field] }));
  };

  const handleNumber = (field) => (e) => {
    setUserEdits((prev) => ({ ...prev, [field]: Number(e.target.value) }));
  };

  const toggleWeekendDay = (day) => {
    const current = form.weekendDays || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    setUserEdits((prev) => ({ ...prev, weekendDays: updated }));
  };

  const handleEdit = () => {
    setUserEdits({});
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.currentAcademicYear || !form.schoolShift || !form.schoolStartTime || !form.schoolEndTime) {
      toast.error('Please fill all required fields');
      return;
    }
    if (!/^\d{4}$/.test(form.currentAcademicYear.trim())) {
      toast.error('Current academic year must be a valid 4-digit year (e.g. 2026)');
      return;
    }
    await onSave(form);
    setEditing(false);
    setUserEdits({});
  };

  return (
    <div className="space-y-6">
      <CardSection title="Academic Year">
        <div className="max-w-md">
          <Input
            label="Current Academic Year"
            name="currentAcademicYear"
            value={form.currentAcademicYear}
            onChange={handleChange('currentAcademicYear')}
            placeholder="e.g. 2026"
            required
            disabled={!editing}
          />
        </div>
      </CardSection>

      <CardSection title="School Timing">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <SelectInput
            label="School Shift"
            name="schoolShift"
            value={form.schoolShift}
            onChange={handleChange('schoolShift')}
            options={SCHOOL_SHIFTS}
            placeholder="Select shift"
            required
            disabled={!editing}
          />

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              School Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              name="schoolStartTime"
              value={form.schoolStartTime}
              onChange={handleChange('schoolStartTime')}
              disabled={!editing}
              className={`appearance-none block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
                !editing ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700' : 'border-gray-300'
              }`}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              School End Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              name="schoolEndTime"
              value={form.schoolEndTime}
              onChange={handleChange('schoolEndTime')}
              disabled={!editing}
              className={`appearance-none block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
                !editing ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700' : 'border-gray-300'
              }`}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Attendance Start Time
            </label>
            <input
              type="time"
              name="attendanceStartTime"
              value={form.attendanceStartTime}
              onChange={handleChange('attendanceStartTime')}
              disabled={!editing}
              className={`appearance-none block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
                !editing ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700' : 'border-gray-300'
              }`}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Attendance Closing Time
            </label>
            <input
              type="time"
              name="attendanceClosingTime"
              value={form.attendanceClosingTime}
              onChange={handleChange('attendanceClosingTime')}
              disabled={!editing}
              className={`appearance-none block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
                !editing ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700' : 'border-gray-300'
              }`}
            />
          </div>
        </div>
      </CardSection>

      <CardSection title="Weekend Settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Toggle
            label="Weekend Enabled"
            checked={form.weekendEnabled}
            onChange={handleToggle('weekendEnabled')}
            disabled={!editing}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Weekend Days
          </label>
          <div className="flex flex-wrap gap-4">
            {WEEK_DAYS.map((day) => (
              <label
                key={day}
                className={`flex items-center gap-2 text-sm ${
                  editing ? 'cursor-pointer' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={(form.weekendDays || []).includes(day)}
                  onChange={() => toggleWeekendDay(day)}
                  disabled={!editing}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                />
                <span className={`text-sm font-medium ${
                  !editing ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {day}
                </span>
              </label>
            ))}
          </div>
        </div>
      </CardSection>

      <CardSection title="Attendance Rules">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Toggle
            label="Allow Attendance Edit After Submission"
            checked={form.allowEditAfterSubmit}
            onChange={handleToggle('allowEditAfterSubmit')}
            disabled={!editing}
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Attendance Edit Time Limit (Hours)
            </label>
            <input
              type="number"
              min="0"
              value={form.editTimeLimit}
              onChange={handleNumber('editTimeLimit')}
              disabled={!editing}
              className={`appearance-none block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
                !editing ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700' : 'border-gray-300'
              }`}
            />
          </div>
          <Toggle
            label="Auto Mark Absent After Closing Time"
            checked={form.autoMarkAbsent}
            onChange={handleToggle('autoMarkAbsent')}
            disabled={!editing}
          />
        </div>
      </CardSection>

      <CardSection title="Late Attendance Rules">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Toggle
            label="Late Allowed"
            checked={form.lateAllowed}
            onChange={handleToggle('lateAllowed')}
            disabled={!editing}
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Late Grace Period (Minutes)
            </label>
            <input
              type="number"
              min="0"
              value={form.lateGracePeriod}
              onChange={handleNumber('lateGracePeriod')}
              disabled={!editing}
              className={`appearance-none block w-full px-4 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
                !editing ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700' : 'border-gray-300'
              }`}
            />
          </div>
        </div>
      </CardSection>

      <CardSection title="Leave Rules">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Toggle
            label="Allow Leave Marking"
            checked={form.allowLeaveMarking}
            onChange={handleToggle('allowLeaveMarking')}
            disabled={!editing}
          />
          <Toggle
            label="Allow Half Day Leave"
            checked={form.allowHalfDayLeave}
            onChange={handleToggle('allowHalfDayLeave')}
            disabled={!editing}
          />
        </div>
      </CardSection>

      <div className="flex items-center gap-3">
        {editing ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Information'}
          </button>
        ) : (
          <button
            onClick={handleEdit}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit Information
          </button>
        )}
      </div>
    </div>
  );
};

export default AcademicConfiguration;
