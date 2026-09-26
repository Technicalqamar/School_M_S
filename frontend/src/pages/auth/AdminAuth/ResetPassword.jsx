import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import authService from '../../../services/auth/auth.service';
import AuthLayout from '../../../components/Auth/AuthLayout';
import StepIndicator from '../../../components/Auth/StepIndicator';
import Input from '../../../components/common/Input/Input';
import Button from '../../../components/common/Button/Button';
import Alert from '../../../components/common/Alert/Alert';
import { toast } from 'react-hot-toast';
import { ArrowLeftIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!email) {
      navigate('/admin/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.adminResetPassword(email, newPassword, confirmPassword);
      toast.success('Password Reset Successfully');
      setTimeout(() => navigate('/admin/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, label: 'Email' },
    { id: 2, label: 'Verify' },
    { id: 3, label: 'Reset' },
  ];

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Choose a new password for your account"
    >
      <StepIndicator steps={steps} currentStep={3} />

      <Alert message={error} type="error" />

      <form onSubmit={handleResetPassword} className="space-y-4">
        <Input
          label="New Password"
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="••••••••"
          icon={LockClosedIcon}
        />
        <Input
          label="Confirm Password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          icon={LockClosedIcon}
        />
        <Button type="submit" loading={loading}>
          Reset Password
        </Button>
        <div className="text-center">
          <Link
            to="/admin/verify-otp"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to verification
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
