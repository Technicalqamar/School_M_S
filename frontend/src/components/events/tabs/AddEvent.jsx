import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../hooks/useLocalization';
import { ArrowPathIcon, CameraIcon, TrashIcon } from '@heroicons/react/24/outline';
import SelectInput from '../../common/SelectInput/SelectInput';
import DateInput from '../../common/DateInput/DateInput';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import Button from '../../common/Button/Button';
import eventsService from '../../../services/events/events.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';

const initialForm = {
  name: '',
  category: '',
  date: '',
  startTime: '',
  endTime: '',
  venue: '',
  organizer: '',
  attendanceRequired: '',
  audience: '',
  description: '',
  status: 'Upcoming',
  academicYear: '',
};

const AddEvent = ({ onDataChange, editEvent, onClearEdit }) => {
  const { t } = useTranslation();
  const { academic } = useSchoolConfig();
  const [form, setForm] = useState({ ...initialForm, academicYear: academic.currentYear || '' });
  const [imagePreview, setImagePreview] = useState(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const yearDefaultRef = useRef(false);

  useEffect(() => {
    if (yearDefaultRef.current) return;
    if (academic.currentYear && !form.academicYear) {
      yearDefaultRef.current = true;
      setForm((prev) => ({ ...prev, academicYear: academic.currentYear }));
    }
  }, [academic.currentYear, form.academicYear]);

  useEffect(() => {
    if (editEvent) {
      setForm({
        name: editEvent.name || '',
        category: editEvent.category || '',
        date: editEvent.date || '',
        startTime: editEvent.startTime || '',
        endTime: editEvent.endTime || '',
        venue: editEvent.venue || '',
        organizer: editEvent.organizer || '',
        attendanceRequired: editEvent.attendanceRequired || '',
        audience: editEvent.audience || '',
        description: editEvent.description || '',
        status: editEvent.status || 'Upcoming',
        academicYear: editEvent.academicYear || academic.currentYear || '',
      });
      setImagePreview(editEvent.banner || null);
    }
  }, [editEvent, academic.currentYear]);

  const isEditing = !!editEvent;

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Only JPG, JPEG, and PNG files are allowed');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setShowRemoveConfirm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.name || !form.category || !form.date) {
      toast.error(t('pleaseFillRequired'));
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
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('category', form.category);
      fd.append('date', form.date);
      fd.append('startTime', form.startTime);
      fd.append('endTime', form.endTime);
      fd.append('venue', form.venue);
      fd.append('organizer', form.organizer);
      fd.append('attendanceRequired', form.attendanceRequired);
      fd.append('audience', form.audience);
      fd.append('description', form.description);
      fd.append('status', form.status);
      fd.append('academicYear', form.academicYear);
      if (fileInputRef.current?.files?.[0]) {
        fd.append('image', fileInputRef.current.files[0]);
      }
      if (isEditing) {
        await eventsService.updateEvent(editEvent._id, fd);
        toast.success(`${t('event')} ${t('updatedSuccessfully')}`);
        onClearEdit();
      } else {
        await eventsService.createEvent(fd);
        toast.success(`${t('event')} ${t('savedSuccessfully')}`);
      }
      setForm({ ...initialForm, academicYear: academic.currentYear || '' });
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onDataChange();
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToSave');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (isEditing) {
      onClearEdit();
    }
    setForm({ ...initialForm, academicYear: academic.currentYear || '' });
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const dateDisplay = form.date
    ? new Date(form.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">{isEditing ? t('editEvent') : t('addNewEvent')}</h2>

        {/* Image Upload */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center ring-2 ring-blue-400/50 overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Event preview" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <CameraIcon className="h-6 w-6 text-white" />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" className="hidden" onChange={handleImageChange} />
            </label>
          </div>
          <div className="flex items-center gap-3 mt-2">
            {imagePreview && (
              <button type="button" onClick={() => setShowRemoveConfirm(true)}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer">
                <TrashIcon className="h-3.5 w-3.5" /> {t('remove')}
              </button>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500">{imagePreview ? t('clickImageToReplace') : t('uploadEventImage')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('eventTitle')} <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all mb-4" placeholder={t('enterEventTitle')} />
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
          <SelectInput label={t('eventCategory')} name="category" value={form.category} onChange={(e) => update('category', e.target.value)} options={eventsService.EVENT_CATEGORIES} placeholder={t('selectCategory')} required />
          <SelectInput label={t('audience')} name="audience" value={form.audience} onChange={(e) => update('audience', e.target.value)} options={eventsService.AUDIENCES} placeholder={t('selectAudience')} />
          <DateInput label={t('eventDate')} name="date" value={form.date} onChange={(e) => update('date', e.target.value)} required />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('startTimeLabel')}</label>
            <input type="time" value={form.startTime} onChange={(e) => update('startTime', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('endTimeLabel')}</label>
            <input type="time" value={form.endTime} onChange={(e) => update('endTime', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('eventPlace')}</label>
            <input type="text" value={form.venue} onChange={(e) => update('venue', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder={t('enterEventPlace')} />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('organizerName')}</label>
            <input type="text" value={form.organizer} onChange={(e) => update('organizer', e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder={t('enterOrganizerName')} />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('attendanceRequired')}</label>
            <div className="relative">
              <select
                value={form.attendanceRequired}
                onChange={(e) => update('attendanceRequired', e.target.value)}
                className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="">{t('select')}</option>
                <option value="Yes">{t('yes')}</option>
                <option value="No">{t('no')}</option>
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="sm:col-span-2 mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('description')}</label>
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder={t('eventDescription')} />
          </div>
          <SelectInput label={t('status')} name="status" value={form.status} onChange={(e) => update('status', e.target.value)} options={eventsService.STATUSES} />
        </div>
      </div>

      {/* Preview Panel - Always Visible */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">{t('preview')}</h2>
        {(form.name || form.category || form.date) ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
            {imagePreview ? (
              <div className="h-32 overflow-hidden">
                <img src={imagePreview} alt="Event banner" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold text-lg">
                {form.name ? form.name.charAt(0) : 'E'}
              </div>
            )}
            <div className="p-4 space-y-2 text-xs">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{form.name || t('eventTitle')}</h3>
              <p className="text-gray-500">{form.category || t('category')}</p>
              <p className="text-gray-500">{dateDisplay || t('eventDate')} | {form.startTime || '--'} - {form.endTime || '--'}</p>
              <p className="text-gray-500">{form.venue || t('placeTbd')}</p>
              {form.organizer && <p className="text-gray-500">{t('byOrganizer')} {form.organizer}</p>}
              {form.description && <p className="text-gray-500 line-clamp-2">{form.description}</p>}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                {form.status}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
            <svg className="h-10 w-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <p className="text-xs">{t('startFillingForm')}</p>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="lg:col-span-3 flex flex-wrap gap-3">
        <Button onClick={handleSave} loading={saving} variant="primary" className="!w-auto px-6">
          {isEditing ? t('updateEvent') : t('saveEvent')}
        </Button>
        <button onClick={handleReset}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer">
          <ArrowPathIcon className="h-4 w-4" /> {isEditing ? t('cancelEdit') : t('reset')}
        </button>
      </div>

      {/* Remove Image Confirmation */}
      <ConfirmationModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        title={t('removeImage')}
        message={t('removeImageConfirm')}
        confirmLabel={t('remove')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleRemoveImage}
      />
    </div>
  );
};

export default AddEvent;
