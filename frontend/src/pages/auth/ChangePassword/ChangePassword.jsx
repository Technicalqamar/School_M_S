import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import authService from '../../../services/auth/auth.service';
import AuthLayout from '../../../components/Auth/AuthLayout';
import Input from '../../../components/common/Input/Input';
import Button from '../../../components/common/Button/Button';
import Alert from '../../../components/common/Alert/Alert';
import { toast } from 'react-hot-toast';
import {
  KeyIcon,
  LockClosedIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline';

const MIN_PASSWORD_LENGTH = 6;

/**
 * First-login Change Password screen for the Student and Teacher portals.
 *
 * Reachable while `user.mustChangePassword` is true (see ProtectedRoute with
 * `allowPasswordChange`) and intentionally rendered OUTSIDE StudentLayout /
 * TeacherLayout: those shells fire protected requests on mount, which the
 * backend blocks until the password is changed.
 *
 * On success the backend clears the flag; the auth state is refreshed here
 * (falling back to a local clear if /auth/me is unreachable) before navigating
 * to the portal dashboard, so ProtectedRoute never bounces the user back.
 */
const ChangePassword = () => {
  const { user, role, DASHBOARD_ROUTES, refreshUser, markPasswordChanged, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');

  // ProtectedRoute guarantees an authenticated user; the only time this is null
  // is during sign-out, when the guard takes over and redirects to the login.
  if (!user) {
    return null;
  }

  const validate = () => {
    if (!currentPassword) {
      return 'Current password is required';
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return `New password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (newPassword === currentPassword) {
      return 'New password must be different from the current password';
    }
    if (newPassword !== confirmPassword) {
      return 'Passwords do not match';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authService.changePassword(currentPassword, newPassword);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password. Please try again.');
      setLoading(false);
      return;
    }

    // The password is changed server-side. Sync the client session so the
    // cleared `mustChangePassword` flag is reflected before we route onward.
    try {
      await refreshUser();
    } catch {
      markPasswordChanged();
    }

    toast.success('Password updated successfully');
    setLoading(false);
    navigate(DASHBOARD_ROUTES[role] || '/', { replace: true });
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // ProtectedRoute redirects to the correct portal login once the session clears.
    await logout();
  };

  const isTeacher = role === 'teacher';
  const isReceptionist = role === 'receptionist';
  const portalLabel = isTeacher ? 'Teacher' : isReceptionist ? 'Receptionist' : 'Student';

  return (
    <AuthLayout
      role={role}
      title="Change Your Password"
      subtitle={`Replace the temporary password before you continue to the ${portalLabel} Portal`}
    >
      <Alert message={error} type="error" />

      <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="p-1 rounded-lg bg-blue-100">
          <KeyIcon className="h-4 w-4 text-blue-600" />
        </div>
        <p className="text-sm text-blue-700">
          Your account was created with a temporary password. For your security, you
          must set a new password before accessing the portal.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Current Password"
          name="currentPassword"
          type="password"
          required
          value={currentPassword}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            if (error) setError('');
          }}
          placeholder="Enter your temporary password"
          icon={LockClosedIcon}
        />

        <Input
          label="New Password"
          name="newPassword"
          type="password"
          required
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            if (error) setError('');
          }}
          placeholder="Enter a new password"
          icon={KeyIcon}
        />

        <Input
          label="Confirm New Password"
          name="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (error) setError('');
          }}
          placeholder="Re-enter the new password"
          icon={KeyIcon}
        />

        <Button type="submit" loading={loading}>
          Update Password
        </Button>
      </form>

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeftOnRectangleIcon className="h-4 w-4" />
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </AuthLayout>
  );
};

export default ChangePassword;
