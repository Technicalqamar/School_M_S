import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, CameraIcon } from '@heroicons/react/24/outline';
import authService from '../../../services/auth/auth.service';
import Button from '../../common/Button/Button';
import Input from '../../common/Input/Input';
import Alert from '../../common/Alert/Alert';
import { toast } from 'react-hot-toast';
import { getImageUrl } from '../../../utils/imageUrl';
import Spinner from '../../common/Spinner/Spinner';
import { useFormatTime } from '../../../hooks/useLocalization';

const ProfileModal = ({ isOpen, onClose, onProfileUpdated, initialEdit = false, readOnly = false }) => {
  const formatTime = useFormatTime();

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' | ' + formatTime(d);
  };
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [editForm, setEditForm] = useState({ fullName: '', phone: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const fileInputRef = useRef(null);

  const loadProfile = async () => {
    try {
      const data = await authService.getProfile();
      setProfile(data.user);
      setEditForm({ fullName: data.user.fullName || '', phone: data.user.phone || '' });
      setImagePreview(null);
      setImageFile(null);
      setIsEditing(Boolean(initialEdit) && !readOnly);
      setFieldErrors({});
    } catch {
      setError('Failed to load profile');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadProfile();
    }
  }, [isOpen]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    setImageFile(file);
  };

  const validate = () => {
    const errors = {};
    const name = (editForm.fullName || '').trim();
    if (!name) {
      errors.fullName = 'Full name is required';
    } else if (name.length < 3 || name.length > 100) {
      errors.fullName = 'Full name must be between 3 and 100 characters';
    }

    const phone = (editForm.phone || '').trim();
    if (!phone) {
      errors.phone = 'Phone number is required';
    } else if (!/^03\d{9}$/.test(phone)) {
      errors.phone = 'Enter a valid Pakistani mobile number (03XXXXXXXXX)';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('fullName', editForm.fullName.trim());
      formData.append('phone', editForm.phone.trim());
      if (imageFile) {
        formData.append('profileImage', imageFile);
      }

      const data = await authService.updateProfile(formData);
      setProfile(data.user);
      setIsEditing(false);
      setImageFile(null);
      setImagePreview(null);
      toast.success('Profile updated successfully');
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update profile';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm({ fullName: profile?.fullName || '', phone: profile?.phone || '' });
    setImageFile(null);
    setImagePreview(null);
    setIsEditing(false);
    setError('');
    setFieldErrors({});
  };

  const handleClose = () => {
    handleCancelEdit();
    onClose();
  };

  const getProfileImageUrl = () => {
    if (imagePreview) return imagePreview;
    return getImageUrl(profile?.profileImage);
  };

  const initials = profile?.fullName
    ? profile.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  const roleLabel = profile?.role === 'admin' ? 'Administrator' : profile?.role?.charAt(0).toUpperCase() + profile?.role?.slice(1);
  const profileImageUrl = getProfileImageUrl();

  if (!isOpen) return null;

  const displayValue = (val) => val || 'Not set';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">
            {isEditing ? 'Edit Profile' : 'My Profile'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          {fetching ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" className="text-blue-600" />
            </div>
          ) : (
            <>
              <Alert message={error} type="error" />

              {/* Top Section */}
              <div className="flex flex-col items-center mb-6">
                {isEditing ? (
                  <div className="relative group mb-3">
                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center ring-2 ring-yellow-400/50 shadow-lg overflow-hidden">
                      {profileImageUrl ? (
                        <img src={profileImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-gray-400">{initials}</span>
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <CameraIcon className="h-6 w-6 text-white" />
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
                    </label>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-2xl ring-2 ring-yellow-400/50 shadow-lg mb-3 overflow-hidden">
                    {profileImageUrl ? (
                      <img src={profileImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{profile?.fullName}</h3>
                <span className="inline-flex items-center gap-1 mt-1 px-3 py-0.5 text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full border border-green-200 dark:border-green-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  {roleLabel}
                </span>
              </div>

              {/* Personal Information */}
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Personal Information
                </h4>

                {isEditing ? (
                  <div className="space-y-4">
                    <Input
                      label="Full Name"
                      name="fullName"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      error={fieldErrors.fullName}
                    />
                    <Input
                      label="Phone Number"
                      name="phone"
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      error={fieldErrors.phone}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                        {profile?.email}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          {roleLabel}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm">
                        {profile?.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Inactive
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Login</label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(profile?.lastLogin)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Created</label>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-300">
                        {formatDate(profile?.createdAt)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Profile Image" value={profileImageUrl ? 'Uploaded' : 'Not set'} />
                    <Field label="Full Name" value={profile?.fullName} />
                    <Field label="Email" value={profile?.email} />
                    <Field label="Phone Number" value={displayValue(profile?.phone)} />
                    <Field label="Role" value={
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        {roleLabel}
                      </span>
                    } />
                    <Field label="Status" value={
                      profile?.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 text-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Inactive
                        </span>
                      )
                    } />
                    <Field label="Last Login" value={formatDate(profile?.lastLogin)} />
                    <Field label="Account Created" value={formatDate(profile?.createdAt)} />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                {isEditing ? (
                  <>
                    <Button variant="secondary" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpdate} loading={loading}>
                      Update Profile
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" onClick={handleClose}>
                      Cancel
                    </Button>
                    {!readOnly && (
                      <Button onClick={() => { setIsEditing(true); setError(''); setFieldErrors({}); }}>
                        Edit Profile
                      </Button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5 border border-gray-100 dark:border-gray-600">
    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{value}</p>
  </div>
);

export default ProfileModal;