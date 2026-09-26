import { useRef, useEffect } from 'react';

const OtpInput = ({ value, onChange, onPaste, disabled = false }) => {
  const otpRefs = useRef([]);
  const otp = Array.isArray(value) ? value : value.split('').concat(Array(6).fill('')).slice(0, 6);

  useEffect(() => {
    otpRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, val) => {
    if (val.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = val;
    if (onChange) onChange(newOtp);
    if (val && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        if (onChange) onChange(newOtp);
        otpRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    if (onChange) onChange(newOtp);
    if (onPaste) onPaste(newOtp);
    const nextIndex = Math.min(pastedData.length, 5);
    otpRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { otpRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          disabled={disabled}
          className={`w-10 h-11 sm:w-11 sm:h-12 text-center text-lg sm:text-xl font-bold rounded-xl border-2 transition-all duration-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white text-gray-800 ${
            digit ? 'border-blue-400 shadow-sm' : 'border-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
};

export default OtpInput;