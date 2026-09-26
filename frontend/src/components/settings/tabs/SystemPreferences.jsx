import { useState } from 'react';
import toast from 'react-hot-toast';
import CardSection from '../../common/CardSection/CardSection';
import SelectInput from '../../common/SelectInput/SelectInput';
import { ADMIN_MODULES } from '../../../constants/adminModules';

const LANDING_PAGES = Object.keys(ADMIN_MODULES);

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

const SystemPreferences = ({ data, onSave, saving }) => {
  const [form, setForm] = useState(() => ({ ...data }));
  const [editing, setEditing] = useState(false);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = () => {
    setForm({ ...data });
    setEditing(true);
  };

  const handleSave = async () => {
    await onSave(form);
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <CardSection title="Security & Notifications">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <SelectInput
            label="Default Landing Page"
            name="defaultLandingPage"
            value={form.defaultLandingPage}
            onChange={handleChange('defaultLandingPage')}
            options={LANDING_PAGES}
            placeholder="Select page"
            disabled={!editing}
          />
          <Toggle label="Auto Logout" checked={form.autoLogout} onChange={() => setForm((p) => ({ ...p, autoLogout: !p.autoLogout }))} disabled={!editing} />
          <Toggle label="Enable Notifications" checked={form.enableNotifications} onChange={() => setForm((p) => ({ ...p, enableNotifications: !p.enableNotifications }))} disabled={!editing} />
          <Toggle label="Email Notifications" checked={form.enableEmailNotifications} onChange={() => setForm((p) => ({ ...p, enableEmailNotifications: !p.enableEmailNotifications }))} disabled={!editing} />
          <Toggle label="SMS Notifications" checked={form.enableSmsNotifications} onChange={() => setForm((p) => ({ ...p, enableSmsNotifications: !p.enableSmsNotifications }))} disabled={!editing} />
          <Toggle label="WhatsApp Notifications" checked={form.enableWhatsAppNotifications} onChange={() => setForm((p) => ({ ...p, enableWhatsAppNotifications: !p.enableWhatsAppNotifications }))} disabled={!editing} />
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

export default SystemPreferences;
