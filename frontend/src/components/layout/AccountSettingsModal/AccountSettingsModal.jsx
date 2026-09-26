import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, KeyIcon, EnvelopeIcon, CheckCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import authService from '../../../services/auth/auth.service';
import Button from '../../common/Button/Button';
import Input from '../../common/Input/Input';
import Alert from '../../common/Alert/Alert';
import OtpInput from '../../common/OtpInput/OtpInput';
import { toast } from 'react-hot-toast';
import Spinner from '../../common/Spinner/Spinner';

const OTP_EXPIRY_SEC = 300;

const calcRemaining = (expiresAt) => {
  if (!expiresAt) return OTP_EXPIRY_SEC;
  const diff = Math.floor((expiresAt - Date.now()) / 1000);
  return Math.max(0, diff);
};

const AccountSettingsModal = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [timer, setTimer] = useState(0);
  const [expiresAt, setExpiresAt] = useState(null);
  const timerRef = useRef(null);

  // Email flow state
  const [emailPassword, setEmailPassword] = useState('');
  const [emailPassVerified, setEmailPassVerified] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState(['', '', '', '', '', '']);
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  // Password flow state
  const [passCurrentPassword, setPassCurrentPassword] = useState('');
  const [passPasswordVerified, setPassPasswordVerified] = useState(false);
  const [passOtp, setPassOtp] = useState(['', '', '', '', '', '']);
  const [passOtpVerified, setPassOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Security lock state
  const [unlocked, setUnlocked] = useState(false);
  const [hasLock, setHasLock] = useState(null); // null | true | false
  const [lockMode, setLockMode] = useState(null); // 'setup' | 'verify' | 'change'
  const [lockInput, setLockInput] = useState('');
  const [newLockInput, setNewLockInput] = useState('');
  const [confirmLockInput, setConfirmLockInput] = useState('');
  const [verifiedOldLock, setVerifiedOldLock] = useState('');
  const [lockStep, setLockStep] = useState('old'); // 'old' | 'new' for change flow
  const [lockLoading, setLockLoading] = useState(false);

  const resetState = () => {
    setActiveSection(null);
    setLoading(false);
    setError('');
    setSuccess('');
    setTimer(0);
    setExpiresAt(null);
    clearTimeout(timerRef.current);

    setEmailPassword('');
    setEmailPassVerified(false);
    setNewEmail('');
    setEmailOtp(['', '', '', '', '', '']);
    setEmailOtpSent(false);

    setPassCurrentPassword('');
    setPassPasswordVerified(false);
    setPassOtp(['', '', '', '', '', '']);
    setPassOtpVerified(false);
    setNewPassword('');
    setConfirmPassword('');

    setUnlocked(false);
    setHasLock(null);
    setLockMode(null);
    setLockInput('');
    setNewLockInput('');
    setConfirmLockInput('');
    setVerifiedOldLock('');
    setLockStep('old');
    setLockLoading(false);
  };

  const checkLockStatus = async () => {
    setLockLoading(true);
    try {
      const data = await authService.verifySecurityLock('');
      setHasLock(data.hasLock);
      setLockMode(data.hasLock ? 'verify' : 'setup');
    } catch {
      setHasLock(true);
      setUnlocked(true);
    } finally {
      setLockLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      Promise.resolve().then(() => resetState());
    } else {
      Promise.resolve().then(() => checkLockStatus());
    }
  }, [isOpen]);

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setTimeout(() => {
        setTimer((prev) => {
          if (prev <= 1) return 0;
          if (expiresAt) return calcRemaining(expiresAt);
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [timer, expiresAt]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSetLock = async () => {
    if (!lockInput || lockInput.length < 4) {
      setError('Security lock must be at least 4 characters');
      return;
    }
    setLockLoading(true);
    setError('');
    try {
      await authService.setSecurityLock(lockInput);
      setUnlocked(true);
      setLockMode(null);
      setSuccess('Security lock created successfully');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to set security lock';
      setError(msg);
    } finally {
      setLockLoading(false);
    }
  };

  const handleVerifyLock = async () => {
    if (!lockInput) {
      setError('Please enter your security lock');
      return;
    }
    setLockLoading(true);
    setError('');
    try {
      const data = await authService.verifySecurityLock(lockInput);
      if (data.verified) {
        setUnlocked(true);
        setLockMode(null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid security lock';
      setError(msg);
      setLockInput('');
    } finally {
      setLockLoading(false);
    }
  };

  const handleVerifyOldLock = async () => {
    if (!lockInput) {
      setError('Please enter your current security lock');
      return;
    }
    setLockLoading(true);
    setError('');
    try {
      const data = await authService.verifySecurityLock(lockInput);
      if (data.verified) {
        setVerifiedOldLock(lockInput);
        setLockStep('new');
        setLockInput('');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid security lock';
      setError(msg);
      setLockInput('');
    } finally {
      setLockLoading(false);
    }
  };

  const handleChangeLockSave = async () => {
    if (!newLockInput || newLockInput.length < 4) {
      setError('New lock must be at least 4 characters');
      return;
    }
    if (newLockInput !== confirmLockInput) {
      setError('Locks do not match');
      return;
    }
    setLockLoading(true);
    setError('');
    try {
      await authService.changeSecurityLock(verifiedOldLock, newLockInput);
      setSuccess('Security lock changed successfully');
      setLockMode(null);
      setLockStep('old');
      setNewLockInput('');
      setConfirmLockInput('');
      setVerifiedOldLock('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to change security lock';
      setError(msg);
    } finally {
      setLockLoading(false);
    }
  };

  // Email flow handlers

  const handleEmailVerifyPassword = async () => {
    if (!emailPassword) { setError('Current password is required'); return; }
    setLoading(true); setError('');
    try {
      await authService.verifyEmailPassword(emailPassword);
      setEmailPassVerified(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Password verification failed';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleEmailSendOtp = async () => {
    if (!newEmail) { setError('Please enter your new email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { setError('Invalid email format'); return; }
    setLoading(true); setError('');
    try {
      const data = await authService.sendChangeEmailOtp(newEmail);
      setExpiresAt(data.expiresAt);
      setTimer(calcRemaining(data.expiresAt));
      setEmailOtp(['', '', '', '', '', '']);
      setEmailOtpSent(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send OTP';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleEmailVerifyOtp = async () => {
    const otpString = emailOtp.join('');
    if (otpString.length !== 6) { setError('Please enter all 6 digits'); return; }
    if (timer === 0) { setError('OTP has expired. Please request a new one.'); return; }
    setLoading(true); setError('');
    try {
      await authService.verifyChangeEmailOtp(otpString);
      toast.success('Email updated successfully');
      setSuccess('Email updated successfully');
      setTimeout(() => handleClose(), 1500);
    } catch (err) {
      const msg = err.response?.data?.message || 'OTP verification failed';
      setError(msg); setEmailOtp(['', '', '', '', '', '']); toast.error(msg);
    } finally { setLoading(false); }
  };

  const handleEmailResendOtp = async () => {
    if (!newEmail) return;
    setLoading(true);
    try {
      const data = await authService.sendChangeEmailOtp(newEmail);
      setExpiresAt(data.expiresAt);
      setTimer(OTP_EXPIRY_SEC);
      setEmailOtp(['', '', '', '', '', '']);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally { setLoading(false); }
  };

  // Password flow handlers

  const handlePassVerifyPassword = async () => {
    if (!passCurrentPassword) { setError('Current password is required'); return; }
    setLoading(true); setError('');
    try {
      const data = await authService.initiatePasswordChange(passCurrentPassword);
      setPassPasswordVerified(true);
      setExpiresAt(data.expiresAt);
      setTimer(calcRemaining(data.expiresAt));
    } catch (err) {
      const msg = err.response?.data?.message || 'Password verification failed';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  const handlePassVerifyOtp = async () => {
    const otpString = passOtp.join('');
    if (otpString.length !== 6) { setError('Please enter all 6 digits'); return; }
    if (timer === 0) { setError('OTP has expired. Please request a new one.'); return; }
    setLoading(true); setError('');
    try {
      await authService.verifyPasswordChangeOtp(otpString);
      setPassOtpVerified(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'OTP verification failed';
      setError(msg); setPassOtp(['', '', '', '', '', '']); toast.error(msg);
    } finally { setLoading(false); }
  };

  const handlePassResendOtp = async () => {
    if (!passCurrentPassword) return;
    setLoading(true);
    try {
      const data = await authService.initiatePasswordChange(passCurrentPassword);
      setExpiresAt(data.expiresAt);
      setTimer(OTP_EXPIRY_SEC);
      setPassOtp(['', '', '', '', '', '']);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally { setLoading(false); }
  };

  const handlePassComplete = async () => {
    if (!newPassword || newPassword.length < 6) { setError('New password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await authService.completePasswordChange(newPassword, confirmPassword);
      toast.success('Password updated successfully');
      setSuccess('Password updated successfully');
      setTimeout(() => handleClose(), 1500);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update password';
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  // Password flow renderers

  const renderPassStep1 = () => (
    <div className="space-y-4">
      <button onClick={() => { setActiveSection(null); setError(''); setPassCurrentPassword(''); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">&larr; Back</button>
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-900/30"><KeyIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Verify Identity</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Enter your current password to proceed.</p>
      <Input label="Current Password" name="currentPassword" type="password" value={passCurrentPassword} onChange={(e) => { setPassCurrentPassword(e.target.value); setError(''); }} placeholder="Enter current password" />
      <div className="flex gap-3 pt-1">
        <Button variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
        <Button onClick={handlePassVerifyPassword} loading={loading} className="flex-1">Verify</Button>
      </div>
    </div>
  );

  const renderPassStep2 = () => (
    <div className="space-y-5">
      <button onClick={() => { setPassPasswordVerified(false); setPassOtp(['', '', '', '', '', '']); setError(''); setTimer(0); setExpiresAt(null); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">&larr; Back</button>
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-900/30"><KeyIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Verify OTP</h3>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircleIcon className="h-4 w-4" />
        <span>Password verified</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">An OTP has been sent to your registered email.</p>
      <OtpInput value={passOtp} onChange={setPassOtp} />
      <div className="text-center">
        {timer > 0 ? (
          <p className="text-xs sm:text-sm text-gray-500">
            Code expires in <span className="font-semibold text-blue-600">{formatTime(timer)}</span>
          </p>
        ) : (
          <p className="text-xs sm:text-sm font-medium text-red-500">OTP has expired. Please request a new one.</p>
        )}
      </div>
      <Button onClick={handlePassVerifyOtp} loading={loading} disabled={timer === 0}>Verify Code</Button>
      <div className="text-center -mt-2">
        {timer > 0 ? (
          <button type="button" onClick={handlePassResendOtp} disabled={loading} className="text-xs sm:text-sm text-gray-400 hover:text-blue-600 disabled:opacity-50 transition-colors cursor-pointer">
            {loading ? 'Resending...' : 'Resend Code'}
          </button>
        ) : (
          <button type="button" onClick={handlePassResendOtp} disabled={loading} className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50 transition-colors cursor-pointer">
            {loading ? 'Resending...' : 'Resend Code'}
          </button>
        )}
      </div>
    </div>
  );

  const renderPassStep3 = () => (
    <div className="space-y-4">
      <button onClick={() => { setPassOtpVerified(false); setPassOtp(['', '', '', '', '', '']); setError(''); setNewPassword(''); setConfirmPassword(''); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">&larr; Back</button>
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-900/30"><KeyIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">New Password</h3>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircleIcon className="h-4 w-4" />
        <span>Identity verified</span>
      </div>
      <Input label="New Password" name="newPassword" type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setError(''); }} placeholder="Enter new password (min 6 characters)" />
      <Input label="Confirm Password" name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} placeholder="Confirm new password" />
      <div className="flex gap-3 pt-1">
        <Button variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
        <Button onClick={handlePassComplete} loading={loading} className="flex-1">Update Password</Button>
      </div>
    </div>
  );

  const renderPasswordFlow = () => {
    if (!passPasswordVerified) return renderPassStep1();
    if (!passOtpVerified) return renderPassStep2();
    return renderPassStep3();
  };

  // Email flow renderers

  const renderEmailStep1 = () => (
    <div className="space-y-4">
      <button onClick={() => { setActiveSection(null); setError(''); setEmailPassword(''); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">&larr; Back</button>
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-purple-100 dark:bg-purple-900/30"><EnvelopeIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Verify Identity</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Enter your current password to proceed.</p>
      <Input label="Current Password" name="currentPassword" type="password" value={emailPassword} onChange={(e) => { setEmailPassword(e.target.value); setError(''); }} placeholder="Enter current password" />
      <div className="flex gap-3 pt-1">
        <Button variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
        <Button onClick={handleEmailVerifyPassword} loading={loading} className="flex-1">Verify</Button>
      </div>
    </div>
  );

  const renderEmailStep2 = () => (
    <div className="space-y-4">
      <button onClick={() => { setEmailPassVerified(false); setError(''); setNewEmail(''); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">&larr; Back</button>
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-purple-100 dark:bg-purple-900/30"><EnvelopeIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">New Email</h3>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
        <CheckCircleIcon className="h-4 w-4" />
        <span>Password verified</span>
      </div>
      <Input label="New Email Address" name="newEmail" type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setError(''); }} placeholder="Enter new email address" />
      <p className="text-xs text-gray-500 dark:text-gray-400">An OTP will be sent to your new email for verification.</p>
      <div className="flex gap-3 pt-1">
        <Button variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
        <Button onClick={handleEmailSendOtp} loading={loading} className="flex-1">Send OTP</Button>
      </div>
    </div>
  );

  const renderEmailStep3 = () => (
    <div className="space-y-5">
      <button onClick={() => { setEmailOtpSent(false); setEmailOtp(['', '', '', '', '', '']); setError(''); setTimer(0); setExpiresAt(null); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">&larr; Back</button>
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-purple-100 dark:bg-purple-900/30"><EnvelopeIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Verify OTP</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Enter the 6-digit code sent to <span className="font-medium text-gray-700 dark:text-gray-300">{newEmail}</span></p>
      <OtpInput value={emailOtp} onChange={setEmailOtp} />
      <div className="text-center">
        {timer > 0 ? (
          <p className="text-xs sm:text-sm text-gray-500">
            Code expires in <span className="font-semibold text-blue-600">{formatTime(timer)}</span>
          </p>
        ) : (
          <p className="text-xs sm:text-sm font-medium text-red-500">OTP has expired. Please request a new one.</p>
        )}
      </div>
      <Button onClick={handleEmailVerifyOtp} loading={loading} disabled={timer === 0}>Verify Code</Button>
      <div className="text-center -mt-2">
        {timer > 0 ? (
          <button type="button" onClick={handleEmailResendOtp} disabled={loading} className="text-xs sm:text-sm text-gray-400 hover:text-blue-600 disabled:opacity-50 transition-colors cursor-pointer">
            {loading ? 'Resending...' : 'Resend Code'}
          </button>
        ) : (
          <button type="button" onClick={handleEmailResendOtp} disabled={loading} className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50 transition-colors cursor-pointer">
            {loading ? 'Resending...' : 'Resend Code'}
          </button>
        )}
      </div>
    </div>
  );

  const renderEmailFlow = () => {
    if (!emailPassVerified) return renderEmailStep1();
    if (!emailOtpSent) return renderEmailStep2();
    return renderEmailStep3();
  };

  // Security lock renderers

  const renderSetupLock = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><LockClosedIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Set Security Lock</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Create a security lock to protect your account settings.</p>
      <Input label="Set Security Lock" name="setLock" type="password" value={lockInput} onChange={(e) => { setLockInput(e.target.value); setError(''); }} placeholder="Enter a security lock (min 4 chars)" />
      <Button onClick={handleSetLock} loading={lockLoading} className="w-full">Create Lock</Button>
    </div>
  );

  const renderVerifyLock = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><LockClosedIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Account Settings Locked</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Enter your security lock to access account settings.</p>
      <Input label="Enter Security Lock" name="verifyLock" type="password" value={lockInput} onChange={(e) => { setLockInput(e.target.value); setError(''); }} placeholder="Enter security lock" />
      <Button onClick={handleVerifyLock} loading={lockLoading} className="w-full">Unlock</Button>
    </div>
  );

  const renderChangeLockOld = () => (
    <div className="space-y-4">
      <button onClick={() => { setLockMode(null); setLockInput(''); setError(''); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">&larr; Back</button>
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><LockClosedIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Change Security Lock</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Enter your current security lock to proceed.</p>
      <Input label="Current Lock" name="oldLock" type="password" value={lockInput} onChange={(e) => { setLockInput(e.target.value); setError(''); }} placeholder="Enter current security lock" />
      <Button onClick={handleVerifyOldLock} loading={lockLoading} className="w-full">Verify</Button>
    </div>
  );

  const renderChangeLockNew = () => (
    <div className="space-y-4">
      <button onClick={() => { setLockStep('old'); setLockInput(verifiedOldLock); setError(''); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">&larr; Back</button>
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><LockClosedIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /></div>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">New Security Lock</h3>
      </div>
      <Input label="New Lock" name="newLock" type="password" value={newLockInput} onChange={(e) => { setNewLockInput(e.target.value); setError(''); }} placeholder="Enter new lock (min 4 chars)" />
      <Input label="Confirm Lock" name="confirmLock" type="password" value={confirmLockInput} onChange={(e) => { setConfirmLockInput(e.target.value); setError(''); }} placeholder="Confirm new lock" />
      <div className="flex gap-3 pt-1">
        <Button variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
        <Button onClick={handleChangeLockSave} loading={lockLoading} className="flex-1">Save</Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white">Account Settings</h2>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"><XMarkIcon className="h-5 w-5" /></button>
        </div>

          <div className="px-6 py-6">
            <Alert message={error} type="error" onClose={() => setError('')} />
            <Alert message={success} type="success" onClose={() => setSuccess('')} />

            {hasLock === null && (
              <div className="flex justify-center py-8">
                <Spinner size="md" className="text-blue-600" />
              </div>
            )}

            {/* Security lock gate — not yet unlocked */}
            {hasLock === false && lockMode === 'setup' && !unlocked && renderSetupLock()}
            {hasLock === true && lockMode === 'verify' && !unlocked && renderVerifyLock()}

            {/* Change lock flow — accessible from unlocked menu */}
            {unlocked && lockMode === 'change' && lockStep === 'old' && renderChangeLockOld()}
            {unlocked && lockMode === 'change' && lockStep === 'new' && renderChangeLockNew()}

            {/* Unlocked menu */}
            {unlocked && !lockMode && !activeSection && (
              <div className="space-y-3">
                <button onClick={() => { setActiveSection('password'); setError(''); setSuccess(''); }} className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left cursor-pointer">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30"><KeyIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">Change Password</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">OTP verified password update</p>
                  </div>
                </button>
                <button onClick={() => { setActiveSection('email'); setError(''); setSuccess(''); }} className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left cursor-pointer">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30"><EnvelopeIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" /></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">Change Email</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">OTP verified email update</p>
                  </div>
                </button>
                <button onClick={() => { setLockMode('change'); setLockStep('old'); setLockInput(''); setNewLockInput(''); setConfirmLockInput(''); setVerifiedOldLock(''); setError(''); setSuccess(''); }} className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left cursor-pointer">
                  <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30"><LockClosedIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" /></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">Change Security Lock</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Update your security lock</p>
                  </div>
                </button>
              </div>
            )}

            {activeSection === 'password' && renderPasswordFlow()}
            {activeSection === 'email' && renderEmailFlow()}
          </div>
      </div>
    </div>
  );
};

export default AccountSettingsModal;