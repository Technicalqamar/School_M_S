import { useState } from 'react';
import { KeyIcon } from '@heroicons/react/24/outline';
import Modal from '../../common/Modal/Modal';
import Input from '../../common/Input/Input';
import Button from '../../common/Button/Button';
import Alert from '../../common/Alert/Alert';
import authService from '../../../services/auth/auth.service';
import { toast } from 'react-hot-toast';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = () => {
    setCurrentPassword('');
    setNewPassword('');
    setError('');
    onClose();
  };

  const handleUpdate = async () => {
    if (!currentPassword) {
      setError('Current password is required');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update password';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Change Password">
      <div className="space-y-4">
        <Alert message={error} type="error" />

        <div className="flex items-center gap-2 mb-1">
          <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <KeyIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Update Password</h3>
        </div>

        <Input
          label="Current Password"
          name="currentPassword"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
        />

        <Input
          label="New Password"
          name="newPassword"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password"
        />

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={handleCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleUpdate} loading={loading} className="flex-1">
            Update Password
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ChangePasswordModal;
