import { useState } from 'react';
import toast from 'react-hot-toast';
import { CameraIcon } from '@heroicons/react/24/outline';
import CardSection from '../../components/common/CardSection/CardSection';
import Input from '../../components/common/Input/Input';
import SelectInput from '../../components/common/SelectInput/SelectInput';
import DateInput from '../../components/common/DateInput/DateInput';
import Alert from '../../components/common/Alert/Alert';
import teacherService from '../../services/teacher/teacher.service';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';

const genderOptions = ['Male', 'Female'];
const statusOptions = ['Active', 'Inactive'];
const maritalOptions = ['Single', 'Married'];
const qualificationOptions = ['B.Ed', 'M.Ed', 'BS Education', 'MA Education', 'PhD Education', 'Other'];
const experienceOptions = ['Fresher', '1 Year', '2 Years', '3 Years', '5 Years', '10+ Years'];

const today = new Date().toISOString().slice(0, 10);

const initialFormState = {
  photo: null,
  fullName: '',
  fatherName: '',
  gender: '',
  dob: '',
  cnic: '',
  maritalStatus: '',
  qualification: '',
  experience: '',
  joiningDate: today,
  status: 'Active',
  academicYear: '',
  phone: '',
  alternatePhone: '',
  email: '',
  city: '',
  address: '',
};

const AddTeacherForm = ({ onSuccess }) => {
  const { academic } = useSchoolConfig();
  const [form, setForm] = useState(() => ({ ...initialFormState, academicYear: academic?.currentYear || '' }));
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
    setForm((prev) => ({ ...initialFormState, academicYear: academic?.currentYear || prev.academicYear || '' }));
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
      if (form.photo) formData.append('teacherImage', form.photo);
      formData.append('fullName', form.fullName.trim());
      formData.append('fatherName', form.fatherName.trim());
      formData.append('gender', form.gender);
      formData.append('dateOfBirth', form.dob);
      formData.append('cnic', form.cnic.trim());
      formData.append('maritalStatus', form.maritalStatus);
      formData.append('qualification', form.qualification);
      formData.append('experience', form.experience);
      formData.append('joiningDate', form.joiningDate);
      formData.append('status', form.status);
      formData.append('academicYear', form.academicYear.trim());
      formData.append('phoneNumber', form.phone.trim());
      if (form.alternatePhone) formData.append('alternatePhoneNumber', form.alternatePhone.trim());
      if (form.email) formData.append('email', form.email.trim());
      formData.append('city', form.city.trim());
      formData.append('address', form.address.trim());

      await teacherService.createTeacher(formData);

      toast.success('Teacher created successfully');
      resetForm();
      if (onSuccess) onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create teacher';
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
        <CardSection title="Personal Information">
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
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Teacher Photo</p>
          </div>

          <Input
            label="Teacher ID"
            name="teacherId"
            value="Auto Generated"
            disabled
          />
          <Input
            label="Full Name"
            name="fullName"
            value={form.fullName}
            onChange={handleChange('fullName')}
            placeholder="Enter full name"
          />
          <Input
            label="Father Name"
            name="fatherName"
            value={form.fatherName}
            onChange={handleChange('fatherName')}
            placeholder="Enter father name"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-3">
            <SelectInput
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={handleChange('gender')}
              options={genderOptions}
            />
            <DateInput
              label="Date of Birth"
              name="dob"
              value={form.dob}
              onChange={handleChange('dob')}
            />
          </div>
          <Input
            label="CNIC"
            name="cnic"
            value={form.cnic}
            onChange={handleChange('cnic')}
            placeholder="XXXXX-XXXXXXX-X"
          />
          <SelectInput
            label="Marital Status"
            name="maritalStatus"
            value={form.maritalStatus}
            onChange={handleChange('maritalStatus')}
            options={maritalOptions}
          />
        </CardSection>

        <CardSection title="Professional Information">
          <SelectInput
            label="Qualification"
            name="qualification"
            value={form.qualification}
            onChange={handleChange('qualification')}
            options={qualificationOptions}
          />
          <SelectInput
            label="Experience"
            name="experience"
            value={form.experience}
            onChange={handleChange('experience')}
            options={experienceOptions}
          />
          <DateInput
            label="Joining Date"
            name="joiningDate"
            value={form.joiningDate}
            onChange={handleChange('joiningDate')}
          />
          <SelectInput
            label="Status"
            name="status"
            value={form.status}
            onChange={handleChange('status')}
            options={statusOptions}
          />
          <Input
            label="Academic Year"
            name="academicYear"
            value={form.academicYear}
            onChange={handleChange('academicYear')}
            placeholder="e.g. 2026"
          />
        </CardSection>
      </div>

      <CardSection title="Contact Information">
          <Input
            label="Phone Number"
            name="phone"
            value={form.phone}
            onChange={handleChange('phone')}
            placeholder="Enter phone number"
          />
          <Input
            label="Alternate Phone Number"
            name="alternatePhone"
            value={form.alternatePhone}
            onChange={handleChange('alternatePhone')}
            placeholder="Enter alternate phone"
          />
          <Input
            label="Email"
            name="email"
            value={form.email}
            onChange={handleChange('email')}
            placeholder="Enter email address"
          />
          <Input
            label="City"
            name="city"
            value={form.city}
            onChange={handleChange('city')}
            placeholder="Enter city"
          />
          <div className="mb-4">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              value={form.address}
              onChange={handleChange('address')}
              placeholder="Enter full address"
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
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2.5 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving Teacher...' : 'Save Teacher'}
        </button>
      </div>
    </div>
  );
};

export default AddTeacherForm;
