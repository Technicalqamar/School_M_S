import { useState } from 'react';
import { useTranslation } from '../../hooks/useLocalization';
import { CameraIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import Input from '../../components/common/Input/Input';
import SelectInput from '../../components/common/SelectInput/SelectInput';
import DateInput from '../../components/common/DateInput/DateInput';
import Alert from '../../components/common/Alert/Alert';
import studentService from '../../services/student/student.service';
import { CLASS_NAMES } from '../../utils/classNames';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';

const today = new Date().toISOString().split('T')[0];

const getInitialState = () => ({
  photo: null,
  fullName: '',
  fatherName: '',
  gender: '',
  dob: '',
  status: 'Active',
  admissionDate: today,
  class: '',
  fatherPhone: '',
  altPhone: '',
  city: '',
  address: '',
});

const AddStudentForm = ({ onSuccess }) => {
  const { t } = useTranslation();
  const genderOptions = [t('male'), t('female')];
  const statusOptions = [t('active'), t('inactive')];
  const { academic, loading: configLoading } = useSchoolConfig();
  const academicYear = (academic?.currentYear || '').trim();
  const [form, setForm] = useState(() => getInitialState());
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, photo: file });
      const reader = new FileReader();
      reader.onload = (event) => setPhotoPreview(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setForm(getInitialState());
    setPhotoPreview(null);
    setError('');
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      if (form.photo) {
        formData.append('studentImage', form.photo);
      }
      formData.append('fullName', form.fullName.trim());
      formData.append('fatherName', form.fatherName.trim());
      formData.append('gender', form.gender);
      formData.append('dateOfBirth', form.dob);
      formData.append('status', form.status);
      formData.append('admissionDate', form.admissionDate);
      formData.append('class', form.class);
      formData.append('fatherPhone', form.fatherPhone);
      if (form.altPhone) {
        formData.append('alternatePhone', form.altPhone);
      }
      formData.append('city', form.city.trim());
      formData.append('address', form.address.trim());

      await studentService.createStudent(formData);

      toast.success(t('savedSuccessfully'));
      resetForm();
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToSave');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && <Alert message={error} type="error" />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CardSection title={t('student')}>
          <div className="flex flex-col items-center mb-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center ring-2 ring-yellow-400/50 overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <CameraIcon className="h-6 w-6 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </label>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('student')} {t('photo')}</p>
          </div>

          <Input
            label={t('studentIdLabel')}
            name="studentId"
            value="Auto Generated"
            disabled
          />
          <Input
            label={t('fullName')}
            name="fullName"
            value={form.fullName}
            onChange={handleChange('fullName')}
            placeholder={t('fullName')}
          />
          <Input
            label={t('fatherName')}
            name="fatherName"
            value={form.fatherName}
            onChange={handleChange('fatherName')}
            placeholder={t('fatherName')}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-3">
            <SelectInput
              label={t('gender')}
              name="gender"
              value={form.gender}
              onChange={handleChange('gender')}
              options={genderOptions}
            />
            <DateInput
              label={t('dateOfBirth')}
              name="dob"
              value={form.dob}
              onChange={handleChange('dob')}
            />
          </div>
          <SelectInput
            label={t('status')}
            name="status"
            value={form.status}
            onChange={handleChange('status')}
            options={statusOptions}
          />
        </CardSection>

        <CardSection title={t('academicSettings')}>
          <DateInput
            label={t('admissionDate')}
            name="admissionDate"
            value={form.admissionDate}
            onChange={handleChange('admissionDate')}
          />
          <Input
            label={t('admissionNumber')}
            name="admissionNumber"
            value="Auto Generated"
            disabled
          />
          <SelectInput
            label={t('class')}
            name="class"
            value={form.class}
            onChange={handleChange('class')}
            options={CLASS_NAMES}
          />
          <Input
            label={t('academicYear')}
            name="academicYear"
            value={configLoading ? '' : academicYear}
            placeholder={configLoading ? t('loading') : '—'}
            disabled
          />
          {!configLoading && !academicYear && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Academic year not configured. Set it in School Settings → Attendance Settings → Current Academic Year.
            </p>
          )}
        </CardSection>
      </div>

      <CardSection title={t('contactInformation')}>
          <Input
            label={t('fatherPhoneNumber')}
            name="fatherPhone"
            value={form.fatherPhone}
            onChange={handleChange('fatherPhone')}
            placeholder={t('phoneNumber')}
          />
          <Input
            label={t('alternativePhoneNumber')}
            name="altPhone"
            value={form.altPhone}
            onChange={handleChange('altPhone')}
            placeholder={t('alternativePhoneNumber')}
          />
          <Input
            label={t('city')}
            name="city"
            value={form.city}
            onChange={handleChange('city')}
            placeholder={t('city')}
          />
          <div className="mb-4">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('address')}
            </label>
            <textarea
              id="address"
              name="address"
              value={form.address}
              onChange={handleChange('address')}
              placeholder={t('address')}
              rows={4}
              className="appearance-none block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white resize-none"
            />
          </div>
      </CardSection>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2.5 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
};

export default AddStudentForm;
