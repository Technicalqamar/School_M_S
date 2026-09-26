import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import authService from '../../../services/auth/auth.service';
import AuthLayout from '../../../components/Auth/AuthLayout';
import StepIndicator from '../../../components/Auth/StepIndicator';
import OtpInput from '../../../components/common/OtpInput/OtpInput';
import Button from '../../../components/common/Button/Button';
import Alert from '../../../components/common/Alert/Alert';
import { toast } from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const OTP_EXPIRY_SEC = 300;

const calcRemaining = (expiresAt) => {
  if (!expiresAt) return OTP_EXPIRY_SEC;
  const diff = Math.floor((expiresAt - Date.now()) / 1000);
  return Math.max(0, diff);
};

const VerifyOTP = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;
  const initialExpiresAt = location.state?.expiresAt;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(() =>
    initialExpiresAt ? calcRemaining(initialExpiresAt) : OTP_EXPIRY_SEC
  );
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt || null);
  const [resendLoading, setResendLoading] = useState(false);

  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!email) {
      navigate('/admin/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearTimer();
            return 0;
          }
          if (expiresAt) {
            return calcRemaining(expiresAt);
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timer === 0) {
      clearTimer();
    }
    return clearTimer;
  }, [timer, expiresAt, clearTimer]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.adminVerifyOtp(email, otpString);
      toast.success('OTP Verified Successfully');
      navigate('/admin/reset-password', { state: { email } });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendLoading(true);
    setError('');
    try {
      const data = await authService.adminForgotPassword(email);
      setExpiresAt(data.expiresAt);
      setTimer(OTP_EXPIRY_SEC);
      setOtp(['', '', '', '', '', '']);
      toast.success('OTP Resent Successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setResendLoading(false);
    }
  };

  const steps = [
    { id: 1, label: 'Email' },
    { id: 2, label: 'Verify' },
    { id: 3, label: 'Reset' },
  ];

  return (
    <AuthLayout
      title="Verify OTP"
      subtitle="Enter the 6-digit code sent to your email"
    >
      <StepIndicator steps={steps} currentStep={2} />

      <Alert message={error} type="error" />

      <form onSubmit={handleVerifyOtp} className="space-y-5">
        <OtpInput value={otp} onChange={setOtp} />

        <div className="text-center">
          {timer > 0 ? (
            <p className="text-sm text-gray-500">
              Code expires in{' '}
              <span className="font-semibold text-blue-600">
                {formatTime(timer)}
              </span>
            </p>
          ) : (
            <p className="text-sm font-medium text-red-500">
              OTP has expired. Please request a new one.
            </p>
          )}
        </div>

        <Button type="submit" loading={loading} disabled={timer === 0}>
          Verify Code
        </Button>

        <div className="text-center">
          {timer > 0 ? (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendLoading}
              className="text-sm text-gray-400 hover:text-blue-600 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {resendLoading ? 'Resending...' : 'Resend Code'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendLoading}
              className="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {resendLoading ? 'Resending...' : 'Resend Code'}
            </button>
          )}
        </div>

        <div className="text-center">
          <Link
            to="/admin/forgot-password"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            Change email
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default VerifyOTP;
