import { useEffect, useRef } from 'react';
import { QrCodeIcon, BoltIcon, XCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { UsbQrCapture } from '../../../utils/usbQrScannerCapture';

const STATUS_BADGE = {
  Present: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  Absent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  Late: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  Leave: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  Pending: 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600',
};

const badgeStyle = (status) => STATUS_BADGE[status] || STATUS_BADGE.Pending;

// Working Hours = exact Check-out − Check-in, both stored DB timestamps.
// Mirrors the helper used by the Teacher Attendance table.
const getWorkingHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return '--';
  const inMs = new Date(checkIn).getTime();
  const outMs = new Date(checkOut).getTime();
  if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs <= inMs) return '--';
  const totalMinutes = Math.floor((outMs - inMs) / 60000);
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
};

// USB QR Scanner input mode.
//
// A separate input mode next to the existing camera scanner. It never requests
// camera access and never opens the webcam: while active it keeps a dedicated
// hidden input focused and treats the USB scanner as a HID keyboard (the
// decoded QR value followed by Enter). Each completed scan is forwarded to the
// SAME QR processing path the camera scanner uses, so the common QR handler
// identifies Student vs Teacher independently of the open tab and the existing
// attendance rules (Present/Late/Leave, duplicates, check-in/check-out, the
// 10-minute checkout window and school timing rules) apply unchanged.
const UsbQrScanner = ({
  active = false,
  disabled = false,
  onActivate,
  onDeactivate,
  onScan,
  result = null,
}) => {
  const inputRef = useRef(null);

  // Keep the latest onScan without recreating the capture instance.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const captureRef = useRef(null);

  // While USB mode is active, hold focus on the dedicated capture input so the
  // scanner's keystrokes are always received — including after the user clicks
  // something else or the window regains focus. The deferred refocus lets any
  // click (e.g. on the Stop button) run to completion first.
  useEffect(() => {
    if (!active) {
      captureRef.current?.reset();
      return undefined;
    }

    if (captureRef.current == null) {
      captureRef.current = new UsbQrCapture({
        onScan: (value) => {
          onScanRef.current?.(value);
        },
      });
    }

    let restoreTimer = 0;
    const focusScanInput = () => {
      window.clearTimeout(restoreTimer);
      restoreTimer = window.setTimeout(() => {
        const input = inputRef.current;
        if (input && document.activeElement !== input) {
          input.focus({ preventScroll: true });
        }
      }, 0);
    };

    window.addEventListener('click', focusScanInput);
    window.addEventListener('focus', focusScanInput);
    focusScanInput();

    return () => {
      window.clearTimeout(restoreTimer);
      window.removeEventListener('click', focusScanInput);
      window.removeEventListener('focus', focusScanInput);
      captureRef.current?.reset();
    };
  }, [active]);

  const handleKeyDown = (event) => {
    const consumed = captureRef.current?.handleKey({
      key: event.key,
      repeat: event.repeat,
    });
    if (consumed) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const renderResult = () => {
    if (!result) return null;

    if (!result.ok) {
      return (
        <div className="mt-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-5 flex items-start gap-3">
          <XCircleIcon className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Scan not accepted</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5 break-words">{result.message}</p>
          </div>
        </div>
      );
    }

    const { person, status } = result;
    const isTeacher = result.type === 'teacher';
    const workingHours = getWorkingHours(result.checkInRaw, result.checkOutRaw);
    const actionLabel = result.action === 'checkout' ? 'check-out' : 'check-in';

    return (
      <div className="mt-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-950/20 p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg ring-1 ring-yellow-400/30 overflow-hidden flex-shrink-0">
            {person.image ? (
              <img
                src={person.image}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <span>{person.fullName?.charAt(0) || (isTeacher ? 'T' : 'S')}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white truncate">{person.fullName || '—'}</h4>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                {isTeacher ? 'Teacher' : 'Student'}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeStyle(status)}`}>
                {status}
              </span>
            </div>
            <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5 break-all">{person.id || '—'}</p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {!isTeacher && (
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Class</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{person.className || '—'}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Check In Time</dt>
            <dd className="text-sm font-mono font-medium text-gray-900 dark:text-white mt-0.5">{result.checkIn || '—'}</dd>
          </div>
          {isTeacher && (
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Check Out Time</dt>
              <dd className="text-sm font-mono font-medium text-gray-900 dark:text-white mt-0.5">{result.checkOut || '—'}</dd>
            </div>
          )}
          {isTeacher && workingHours !== '--' && (
            <div>
              <dt className="text-xs text-gray-500 dark:text-gray-400">Working Hours</dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{workingHours}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-gray-500 dark:text-gray-400">Action</dt>
            <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5 capitalize">{actionLabel}</dd>
          </div>
        </dl>
      </div>
    );
  };

  return (
    <div className="relative">
      {active && (
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          aria-label="USB QR scanner capture field"
          className="absolute left-0 top-0 h-px w-px opacity-0 pointer-events-none"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onPaste={(e) => e.preventDefault()}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/10 flex-shrink-0">
            <QrCodeIcon className="h-8 w-8 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">USB Scanner</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Connect a USB QR scanner (HID keyboard). It types the QR value and Enter — no camera is used.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              active
                ? 'border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {active ? 'USB Scanner Active' : 'USB Scanner Ready'}
          </span>
          <button
            type="button"
            onClick={active ? onDeactivate : onActivate}
            disabled={disabled && !active}
            className={
              active
                ? 'px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer'
                : 'px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-2'
            }
          >
            {active ? 'Stop USB Scanner' : 'Start USB Scanner'}
          </button>
        </div>
      </div>

      {active && (
        <div className="mt-3 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
          <BoltIcon className="h-4 w-4 flex-shrink-0" />
          <span>Listening for QR scans — point the scanner at a card. Stays active for consecutive scans.</span>
        </div>
      )}

      {active && !result && (
        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-5 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <CheckCircleIcon className="h-5 w-5 text-indigo-400 flex-shrink-0" />
          <span>Waiting for the first scan. The previous result appears here after each scan.</span>
        </div>
      )}

      {renderResult()}
    </div>
  );
};

export default UsbQrScanner;