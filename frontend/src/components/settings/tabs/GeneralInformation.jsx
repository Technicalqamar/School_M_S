import { useState } from 'react';
import toast from 'react-hot-toast';
import CardSection from '../../common/CardSection/CardSection';
import Input from '../../common/Input/Input';

const PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan', 'Azad Kashmir', 'Islamabad'];

const GeneralInformation = ({ data, onSave, saving }) => {
  const [form, setForm] = useState(() => ({ ...data }));
  const [editing, setEditing] = useState(false);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleEdit = () => {
    setForm({ ...data });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form.schoolName || !form.shortName || !form.registrationNumber || !form.principalName || !form.schoolEmail || !form.contactNumber || !form.city || !form.country) {
      toast.error('Please fill all required fields');
      return;
    }
    await onSave(form);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <CardSection title="School Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <Input label="School Name" name="schoolName" value={form.schoolName} onChange={handleChange('schoolName')} placeholder="Enter school name" required disabled={!editing} />
          <Input label="Short Name" name="shortName" value={form.shortName} onChange={handleChange('shortName')} placeholder="e.g. IQRA" required disabled={!editing} />
          <Input label="Registration Number" name="registrationNumber" value={form.registrationNumber} onChange={handleChange('registrationNumber')} placeholder="Enter registration number" required disabled={!editing} />
          <Input label="Principal Name" name="principalName" value={form.principalName} onChange={handleChange('principalName')} placeholder="Enter principal name" required disabled={!editing} />
          <Input label="School Email" name="schoolEmail" type="email" value={form.schoolEmail} onChange={handleChange('schoolEmail')} placeholder="info@school.edu.pk" required disabled={!editing} />
          <Input label="Contact Number" name="contactNumber" type="tel" value={form.contactNumber} onChange={handleChange('contactNumber')} placeholder="+92-XXX-XXXXXXX" required disabled={!editing} />
          <Input label="WhatsApp Number" name="whatsappNumber" type="tel" value={form.whatsappNumber} onChange={handleChange('whatsappNumber')} placeholder="+92-XXX-XXXXXXX" disabled={!editing} />
          <Input label="Website" name="website" type="url" value={form.website} onChange={handleChange('website')} placeholder="www.school.edu.pk" disabled={!editing} />
        </div>
      </CardSection>

      <CardSection title="Address & Location">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <div className="md:col-span-2 mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Complete Address
            </label>
            <textarea
              name="completeAddress"
              value={form.completeAddress}
              onChange={handleChange('completeAddress')}
              placeholder="Enter complete address"
              rows={3}
              disabled={!editing}
              className={`appearance-none block w-full px-4 py-2.5 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 ${
                !editing ? 'text-gray-500 dark:text-gray-400 cursor-not-allowed' : 'border-gray-300'
              }`}
            />
          </div>
          <Input label="City" name="city" value={form.city} onChange={handleChange('city')} placeholder="Enter city" required disabled={!editing} />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Province</label>
            <select
              name="province"
              value={form.province}
              onChange={handleChange('province')}
              disabled={!editing}
              className={`appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border text-sm transition-all bg-white dark:bg-gray-800 ${
                !editing
                  ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer'
              }`}
            >
              <option value="">Select province</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Input label="Country" name="country" value={form.country} onChange={handleChange('country')} placeholder="Enter country" required disabled={!editing} />
          <Input label="Google Map Location" name="googleMapLocation" value={form.googleMapLocation} onChange={handleChange('googleMapLocation')} placeholder="Optional: embed URL or coordinates" disabled={!editing} />
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

export default GeneralInformation;
