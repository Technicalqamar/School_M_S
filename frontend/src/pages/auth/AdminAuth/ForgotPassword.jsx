import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import authService from '../../../services/auth/auth.service';
import AuthLayout from '../../../components/Auth/AuthLayout';
import StepIndicator from '../../../components/Auth/StepIndicator';
import Input from '../../../components/common/Input/Input';
import Button from '../../../components/common/Button/Button';
import Alert from '../../../components/common/Alert/Alert';
import { toast } from 'react-hot-toast';
import { ArrowLeftIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const steps = [
    { id: 1, label: 'Email' },
    { id: 2, label: 'Verify' },
    { id: 3, label: 'Reset' },
  ];

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await authService.adminForgotPassword(email);
      toast.success('OTP sent to your email');
      navigate('/admin/verify-otp', { state: { email, expiresAt: data.expiresAt } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your email to receive a verification code"
    >
      <StepIndicator steps={steps} currentStep={1} />

      <Alert message={error} type="error" />

      <form onSubmit={handleSendOtp} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@school.com"
          icon={EnvelopeIcon}
        />
        <Button type="submit" loading={loading}>
          Send OTP
        </Button>
        <div className="text-center">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Back to login
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
