import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { CameraIcon } from '@heroicons/react/24/outline';
import Modal from '../Modal/Modal';
import CardSection from '../CardSection/CardSection';
import Input from '../Input/Input';
import SelectInput from '../SelectInput/SelectInput';
import DateInput from '../DateInput/DateInput';
import Button from '../Button/Button';
import Alert from '../Alert/Alert';
import { getImageUrl } from '../../../utils/imageUrl';
import { useTranslation } from '../../../hooks/useLocalization';

const getInitialFormData = (teacher) => teacher ? {
  fullName: teacher.fullName || '',
  fatherName: teacher.fatherName || '',
  gender: teacher.gender || '',
  dateOfBirth: teacher.dateOfBirth ? teacher.dateOfBirth.slice(0, 10) : '',
  cnic: teacher.cnic || '',
  maritalStatus: teacher.maritalStatus || '',
  qualification: teacher.qualification || '',
  experience: teacher.experience || '',
  joiningDate: teacher.joiningDate ? teacher.joiningDate.slice(0, 10) : '',
  status: teacher.status || '',
  phoneNumber: teacher.phoneNumber || '',
  alternatePhoneNumber: teacher.alternatePhoneNumber || '',
  email: teacher.email || '',
  city: teacher.city || '',
  address: teacher.address || '',
} : {
  fullName: '',
  fatherName: '',
  gender: '',
  dateOfBirth: '',
  cnic: '',
  maritalStatus: '',
  qualification: '',
  experience: '',
  joiningDate: '',
  status: '',
  phoneNumber: '',
  alternatePhoneNumber: '',
  email: '',
  city: '',
  address: '',
};

const EditTeacherModal = ({ teacher, isOpen, onClose, onSave }) => {
  const { t } = useTranslation();
  const genderOptions = [t('male'), t('female')];
  const statusOptions = [t('active'), t('inactive')];
  const maritalOptions = [t('single'), t('married')];
  const qualificationOptions = ['B.Ed', 'M.Ed', 'BS Education', 'MA Education', 'PhD Education', t('other')];
  const experienceOptions = [t('fresher'), `1 ${t('year')}`, `2 ${t('years')}`, `3 ${t('years')}`, `5 ${t('years')}`, t('plusYears')];
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState(() => getInitialFormData(teacher));
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(() => teacher ? getImageUrl(teacher.teacherImage) : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');

    try {
      const fd = new FormData();
      if (photoFile) fd.append('teacherImage', photoFile);
      if (formData.fullName) fd.append('fullName', formData.fullName.trim());
      if (formData.fatherName) fd.append('fatherName', formData.fatherName.trim());
      if (formData.gender) fd.append('gender', formData.gender);
      if (formData.dateOfBirth) fd.append('dateOfBirth', formData.dateOfBirth);
      if (formData.cnic) fd.append('cnic', formData.cnic.trim());
      if (formData.maritalStatus) fd.append('maritalStatus', formData.maritalStatus);
      if (formData.qualification) fd.append('qualification', formData.qualification);
      if (formData.experience) fd.append('experience', formData.experience);
      if (formData.joiningDate) fd.append('joiningDate', formData.joiningDate);
      if (formData.status) fd.append('status', formData.status);
      if (formData.phoneNumber) fd.append('phoneNumber', formData.phoneNumber.trim());
      if (formData.alternatePhoneNumber) fd.append('alternatePhoneNumber', formData.alternatePhoneNumber.trim());
      if (formData.email) fd.append('email', formData.email.trim());
      if (formData.city) fd.append('city', formData.city.trim());
      if (formData.address) fd.append('address', formData.address.trim());

      await onSave(teacher.teacherId, fd);
      toast.success(t('updatedSuccessfully'));
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToSave');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const initials = teacher?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || t('noDataDash');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('edit') + ' ' + t('teacher')} maxWidth="max-w-2xl">
      <div className="max-h-[70vh] overflow-y-auto pr-1 -mr-1">
        {error && <Alert message={error} type="error" />}

        <CardSection title={t('basicInformation')}>
          <div className="flex flex-col items-center mb-5">
            <div
              className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl ring-2 ring-yellow-400/50 cursor-pointer overflow-hidden group"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                initials
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <CameraIcon className="h-6 w-6 text-white" />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('clickToChangePhoto')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
            <Input label={t('fullName')} name="fullName" value={formData.fullName} onChange={handleChange('fullName')} placeholder={t('enterFullName')} />
            <Input label={t('fatherName')} name="fatherName" value={formData.fatherName} onChange={handleChange('fatherName')} placeholder={t('enterFatherName')} />
            <SelectInput label={t('gender')} name="gender" value={formData.gender} onChange={handleChange('gender')} options={genderOptions} placeholder={t('selectGender')} />
            <DateInput label={t('dateOfBirth')} name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange('dateOfBirth')} />
            <Input label={t('cnic')} name="cnic" value={formData.cnic} onChange={handleChange('cnic')} placeholder="XXXXX-XXXXXXX-X" />
            <SelectInput label={t('maritalStatus')} name="maritalStatus" value={formData.maritalStatus} onChange={handleChange('maritalStatus')} options={maritalOptions} placeholder={t('selectMaritalStatus')} />
          </div>
        </CardSection>

        <div className="mt-4">
          <CardSection title={t('professionalInformation')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <SelectInput label={t('qualification')} name="qualification" value={formData.qualification} onChange={handleChange('qualification')} options={qualificationOptions} placeholder={t('selectQualification')} />
              <SelectInput label={t('experience')} name="experience" value={formData.experience} onChange={handleChange('experience')} options={experienceOptions} placeholder={t('selectExperience')} />
              <DateInput label={t('joiningDate')} name="joiningDate" value={formData.joiningDate} onChange={handleChange('joiningDate')} />
              <SelectInput label={t('status')} name="status" value={formData.status} onChange={handleChange('status')} options={statusOptions} placeholder={t('selectStatus')} />
            </div>
          </CardSection>
        </div>

        <div className="mt-4">
          <CardSection title={t('contactInformation')}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
              <Input label={t('phoneNumber')} name="phoneNumber" value={formData.phoneNumber} onChange={handleChange('phoneNumber')} placeholder={t('enterPhoneNumber')} />
              <Input label={t('alternativePhone')} name="alternatePhoneNumber" value={formData.alternatePhoneNumber} onChange={handleChange('alternatePhoneNumber')} placeholder={t('enterAlternativePhone')} />
              <Input label={t('email')} name="email" value={formData.email} onChange={handleChange('email')} placeholder={t('enterEmailAddress')} />
              <Input label={t('city')} name="city" value={formData.city} onChange={handleChange('city')} placeholder={t('enterCity')} />
            </div>
            <div className="mb-4">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('address')}
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange('address')}
                rows={3}
                placeholder={t('enterAddress')}
                className="appearance-none block w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white resize-none"
              />
            </div>
          </CardSection>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-gray-200 dark:border-gray-700">
        <Button variant="secondary" onClick={onClose} disabled={loading}>{t('cancel')}</Button>
        <Button variant="primary" onClick={handleSave} loading={loading}>{t('update')} {t('teacher')}</Button>
      </div>
    </Modal>
  );
};

export default EditTeacherModal;
