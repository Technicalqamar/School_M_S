import { useState } from 'react';
import toast from 'react-hot-toast';
import receptionistService from '../../../services/receptionist/receptionist.service';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import PermissionEditor from '../PermissionEditor/PermissionEditor';
import {
  DEFAULT_RECEPTIONIST_PERMISSIONS,
} from '../../../constants/receptionistPermissions';

const emptyForm = {
  receptionistId: '',
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  isActive: true,
};

const AddReceptionist = ({ onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [permissions, setPermissions] = useState([...DEFAULT_RECEPTIONIST_PERMISSIONS]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!form.receptionistId || !form.receptionistId.trim()) {
      newErrors.receptionistId = 'Login ID is required';
    } else if (form.receptionistId.trim().length > 50) {
      newErrors.receptionistId = 'Login ID must be at most 50 characters';
    }

    if (!form.fullName || form.fullName.trim().length < 3) {
      newErrors.fullName = 'Full name must be at least 3 characters';
    }

    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (form.password.length > 128) {
      newErrors.password = 'Password must be at most 128 characters';
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm the password';
    } else if (form.confirmPassword !== form.password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    try {
      await receptionistService.createReceptionist({
        receptionistId: form.receptionistId.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        isActive: form.isActive,
        permissions,
      });
      toast.success('Receptionist account created successfully');
      setForm(emptyForm);
      setPermissions([...DEFAULT_RECEPTIONIST_PERMISSIONS]);
      setErrors({});
      if (onCreated) onCreated();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create receptionist';
      if (message.includes('already in use')) {
        setErrors((prev) => ({ ...prev, receptionistId: message }));
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Receptionist</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Enter the login ID and password manually - no default passwords, no
          auto-generation. The password is stored hashed and can never be viewed
          or reset by anyone.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <Input
            label="Login ID (Receptionist ID)"
            name="receptionistId"
            type="text"
            required
            value={form.receptionistId}
            onChange={handleChange}
            placeholder="e.g. RANA123 or front-desk-01"
            error={errors.receptionistId}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            This is what the receptionist types to sign in. Must be unique.
          </p>
        </div>
        <Input
          label="Full Name"
          name="fullName"
          type="text"
          required
          value={form.fullName}
          onChange={handleChange}
          placeholder="e.g. Ayesha Khan"
          error={errors.fullName}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="optional"
          error={errors.email}
        />
        <Input
          label="Phone"
          name="phone"
          type="text"
          value={form.phone}
          onChange={handleChange}
          placeholder="optional"
        />
        <Input
          label="Password"
          name="password"
          type="password"
          required
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />
        <Input
          label="Confirm Password"
          name="confirmPassword"
          type="password"
          required
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
        />
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          name="isActive"
          checked={form.isActive}
          onChange={handleChange}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-200">
          Account is active immediately (can sign in)
        </span>
      </label>

      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Module Access
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Tick which Admin modules this receptionist can open. The Dashboard
          grant is included by default.
        </p>
        <PermissionEditor value={permissions} onChange={setPermissions} busy={submitting} />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <Button type="submit" loading={submitting}>
          Create Receptionist
        </Button>
      </div>
    </form>
  );
};

export default AddReceptionist;