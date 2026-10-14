import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  CheckCircleIcon, XCircleIcon, ClockIcon,
  CalendarDaysIcon, UsersIcon,
  EyeIcon, ArrowPathIcon, ChevronDownIcon,
  ArrowLeftIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import SelectInput from '../../common/SelectInput/SelectInput';
import DateInput from '../../common/DateInput/DateInput';
import Modal from '../../common/Modal/Modal';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import { ACADEMIC_YEARS } from '../../../utils/classNames';
import Spinner from '../../common/Spinner/Spinner';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import teacherAttendanceService from '../../../services/teacherAttendance/teacherAttendance.service';
import qrAttendanceService from '../../../services/qrAttendanceService/qrAttendanceService';
import { getImageUrl } from '../../../utils/imageUrl';
import UsbQrScanner from './UsbQrScanner';
import { useAuth } from '../../../contexts/AuthContext';
import { hasReceptionistActionAccess } from '../../../constants/receptionistPermissions';

const STATUS_OPTIONS = ['Present', 'Absent', 'Leave', 'Late'];
const ATTENDANCE_MODES = ['Manual Attendance', 'QR Scanner'];

const STATUS_STYLES = {
  Present: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  Absent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  Leave: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  Late: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  Pending: 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600',
};

const STATUS_COLORS = {
  Present: { dot: 'bg-green-500', hover: 'hover:bg-green-50 dark:hover:bg-green-900/20', text: 'text-green-700 dark:text-green-300' },
  Absent: { dot: 'bg-red-500', hover: 'hover:bg-red-50 dark:hover:bg-red-900/20', text: 'text-red-700 dark:text-red-300' },
  Leave: { dot: 'bg-yellow-400', hover: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300' },
  Late: { dot: 'bg-blue-500', hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300' },
  Pending: { dot: 'bg-gray-400', hover: 'hover:bg-gray-50 dark:hover:bg-gray-900/20', text: 'text-gray-700 dark:text-gray-300' },
};

// Working Hours = exact Check-out − exact Check-in, both from the stored database timestamps.
// No attendance, or check-in without check-out → '--'.
const getWorkingHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return '--';
  const inMs = new Date(checkIn).getTime();
  const outMs = new Date(checkOut).getTime();
  if (Number.isNaN(inMs) || Number.isNaN(outMs) || outMs <= inMs) return '--';
  const totalMinutes = Math.floor((outMs - inMs) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const PAGE_SIZE = 10;

const TeacherAttendance = () => {
  const { localization } = useSchoolConfig();
  const { user } = useAuth();
  // Check-in/check-out, manual status edits and record resets are
  // `teacher-attendance-mark` operations. Viewing only needs
  // `teacher-attendance-view`.
  const canMark = hasReceptionistActionAccess(user, 'attendance-management', 'teacher-attendance-mark');
  const hour12 = (localization?.timeFormat || '12') !== '24';
  // Displays the exact stored check-in/check-out timestamp (to the second),
  // converted to local time per the existing project convention.
  const formatExactTime = useCallback((value) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12,
    });
  }, [hour12]);
  const [academicYear, setAcademicYear] = useState('2026');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceMode, setAttendanceMode] = useState('Manual Attendance');
  const [teachers, setTeachers] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [viewTeacher, setViewTeacher] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [actionBusyTeacherId, setActionBusyTeacherId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [scannerMessageType, setScannerMessageType] = useState('info');
  const qrScannerRef = useRef(null);
  const isProcessingScanRef = useRef(false);
  const lastScannedQrRef = useRef('');
  const scanSourceRef = useRef('camera');
  const [usbActive, setUsbActive] = useState(false);
  const [usbResult, setUsbResult] = useState(null);
  const scannerElementId = 'teacher-attendance-qr-reader';

  const isScannerMode = attendanceMode === 'QR Scanner';

  const teacherOptions = useMemo(
    () => teachers.map((teacher) => ({ value: teacher._id, label: teacher.fullName })),
    [teachers],
  );

  const filteredTeachers = useMemo(
    () => (selectedTeacherId ? teachers.filter((teacher) => teacher._id === selectedTeacherId) : teachers),
    [teachers, selectedTeacherId],
  );

  const totalPages = Math.max(1, Math.ceil(filteredTeachers.length / PAGE_SIZE));

  const paginatedTeachers = useMemo(
    () => filteredTeachers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredTeachers, currentPage],
  );

  const stats = useMemo(() => {
    const records = Object.values(attendanceMap);
    const present = records.filter((record) => record.status === 'Present').length;
    const absent = records.filter((record) => record.status === 'Absent').length;
    const leave = records.filter((record) => record.status === 'Leave').length;
    const late = records.filter((record) => record.status === 'Late').length;
    return { present, absent, leave, late, total: teachers.length };
  }, [attendanceMap, teachers.length]);

  useEffect(() => {
    const close = () => setOpenDropdownId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const loadTeachers = useCallback(async () => {
    if (!academicYear) {
      toast.error('Please select Academic Year');
      return;
    }

    setCurrentPage(1);
    setLoading(true);
    setLoaded(false);
    setTeachers([]);
    setAttendanceMap({});

    try {
      const response = await teacherAttendanceService.getTeachersWithAttendance({ academicYear, date });
      const fetchedTeachers = response?.data?.teachers || [];
      const attendanceData = response?.data?.attendanceMap || {};

      setTeachers(fetchedTeachers);

      const mergedMap = {};
      fetchedTeachers.forEach((teacher) => {
        const record = attendanceData[teacher._id] || {};
        mergedMap[teacher._id] = {
          id: record.id || '',
          status: record.status || 'Pending',
          checkIn: record.checkIn ? formatExactTime(record.checkIn) : '',
          checkOut: record.checkOut ? formatExactTime(record.checkOut) : '',
          checkInRaw: record.checkIn || '',
          checkOutRaw: record.checkOut || '',
          method: record.method || 'Manual',
        };
      });

      setAttendanceMap(mergedMap);
      setLoaded(true);

      if (fetchedTeachers.length === 0) {
        toast.error('No teachers found for the selected academic year.');
      } else {
        toast.success('Teachers loaded successfully.');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, [academicYear, date, formatExactTime]);

  const saveSingleRecord = async (teacherId, status) => {
    if (!academicYear) return;

    try {
      const response = await teacherAttendanceService.saveAttendance({
        academicYear,
        date,
        records: [{
          teacher: teacherId,
          status,
          method: 'Manual',
        }],
      });
      // Reflect the exact record saved by the backend (server-sided status
      // conversions and exact check-in/check-out timestamps).
      const saved = response?.data?.records?.[0];
      if (saved) {
        setAttendanceMap((prev) => {
          const previous = prev[teacherId] || {};
          return {
            ...prev,
            [teacherId]: {
              ...previous,
              id: saved.id || previous.id,
              status: saved.status,
              method: saved.method || 'Manual',
              checkIn: saved.checkIn ? formatExactTime(saved.checkIn) : '',
              checkOut: saved.checkOut ? formatExactTime(saved.checkOut) : '',
              checkInRaw: saved.checkIn || '',
              checkOutRaw: saved.checkOut || '',
            },
          };
        });
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to save teacher attendance';
      toast.error(message);
    }
  };

  const updateAttendance = (teacherId, field, value) => {
    if (field === 'status' && value) {
      saveSingleRecord(teacherId, value);
      return;
    }

    setAttendanceMap((prev) => ({
      ...prev,
      [teacherId]: {
        ...prev[teacherId],
    
      [field]: value,
      },
    }));
  };

  // Check-in / Check-out Actions operate on the real backend attendance record.
  // They reuse the existing QR-scan state machine (first scan = check-in,
  // valid later scan = check-out) via the canonical teacher QR value.
  const runTeacherCheckAction = useCallback(async (teacher) => {
    if (!academicYear) {
      toast.error('Please select Academic Year first.');
      return;
    }
    if (!teacher?.teacherId) {
      toast.error('Teacher ID is missing — cannot process check action.');
      return;
    }
    if (actionBusyTeacherId) {
      toast.error('Another teacher action is already in progress.');
      return;
    }

    setActionBusyTeacherId(teacher._id);
    try {
      const result = await qrAttendanceService.scanAnyAttendance({
        qrValue: `QR-${teacher.teacherId}`,
        academicYear,
        date,
      });

      const action = result?.action === 'checkout' ? 'checkout' : 'checkin';
      const label = `${teacher.fullName} (${teacher.teacherId})`;

      let message = '';
      if (action === 'checkout') {
        const checkOutLabel = result.checkOut ? formatExactTime(result.checkOut) : '';
        message = `Teacher ${label} checked out successfully${checkOutLabel ? ` at ${checkOutLabel}` : ''}.`;
      } else {
        message = `Teacher ${label} checked in successfully as ${result.status}.`;
      }

      setScannerMessage(message);
      setScannerMessageType('success');
      toast.success(message);

      setAttendanceMap((prev) => {
        const previous = prev[teacher._id] || {};
        return {
          ...prev,
          [teacher._id]: {
            ...previous,
            id: result.id || previous.id,
            status: result.status || previous.status || 'Present',
            checkIn: result.checkIn ? formatExactTime(result.checkIn) : previous.checkIn || '',
            checkOut: result.checkOut ? formatExactTime(result.checkOut) : previous.checkOut || '',
            checkInRaw: result.checkIn || previous.checkInRaw || '',
            checkOutRaw: result.checkOut || previous.checkOutRaw || '',
            method: result.method || previous.method || 'Manual',
          },
        };
      });
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Teacher check action failed.';
      setScannerMessage(message);
      setScannerMessageType('error');
      toast.error(message);
    } finally {
      setActionBusyTeacherId('');
    }
  }, [academicYear, date, formatExactTime, actionBusyTeacherId]);

  const handleResetConfirm = async () => {
    if (!resetTarget) return;
    const record = attendanceMap[resetTarget] || {};

    if (!record.id) {
      setResetTarget(null);
      toast.error('No attendance record to reset for this teacher.');
      return;
    }

    setResetting(true);
    try {
      await teacherAttendanceService.deleteAttendance(record.id);
      setAttendanceMap((prev) => ({
        ...prev,
        [resetTarget]: { ...prev[resetTarget], id: '', status: 'Pending', checkIn: '', checkOut: '', checkInRaw: '', checkOutRaw: '', method: 'Manual' },
      }));
      setResetTarget(null);
      toast.success('Attendance record deleted successfully.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to reset attendance';
      toast.error(message);
    } finally {
      setResetting(false);
    }
  };

  const renderStatusBadge = (status) => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.Present;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
        {status}
      </span>
    );
  };

  const renderStatusDropdown = (teacherId, currentStatus) => {
    if (!canMark) {
      return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${STATUS_COLORS[currentStatus]?.text || 'text-gray-700 dark:text-gray-200'}`}>
          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[currentStatus]?.dot || 'bg-gray-400'}`} />
          {currentStatus}
        </span>
      );
    }
    return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpenDropdownId((previous) => (previous === teacherId ? null : teacherId));
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium transition-all hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer ${STATUS_COLORS[currentStatus]?.text || 'text-gray-700 dark:text-gray-200'}`}
      >
        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[currentStatus]?.dot || 'bg-gray-400'}`} />
        {currentStatus}
        <ChevronDownIcon className="h-3 w-3 text-gray-400 ml-0.5" />
      </button>
      {openDropdownId === teacherId && (
        <div className="absolute left-0 mt-1.5 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 py-1 overflow-hidden">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                updateAttendance(teacherId, 'status', option);
                setOpenDropdownId(null);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors ${STATUS_COLORS[option]?.hover || 'hover:bg-gray-100'} ${currentStatus === option ? STATUS_COLORS[option]?.text || 'text-gray-700 dark:text-gray-200' : 'text-gray-700 dark:text-gray-200'}`}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[option]?.dot || 'bg-gray-400'} flex-shrink-0`} />
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
    );
  };

  const renderPagination = () => {
    if (filteredTeachers.length === 0) return null;
    const pages = [];
    if (totalPages <= 7) {
      for (let index = 1; index <= totalPages; index += 1) pages.push(index);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) {
        start = 2;
        end = Math.min(4, totalPages - 1);
      }
      if (currentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - 3);
        end = totalPages - 1;
      }
      if (start > 2) pages.push('...');
      for (let index = start; index <= end; index += 1) pages.push(index);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? 's' : ''} — Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => page - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Previous
          </button>
          {pages.map((page, index) => (page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-1.5 text-xs text-gray-400 dark:text-gray-500">...</span>
          ) : (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`min-w-[28px] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                currentPage === page
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {page}
            </button>
          )))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((page) => page + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
      <UsersIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">No Teachers Loaded</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
        Select Academic Year and click Load Teachers.
      </p>
    </div>
  );

  const renderLoadingState = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
      <Spinner size="md" className="text-blue-600 mb-4" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading teachers...</p>
    </div>
  );

  const stopQrScanner = useCallback(async () => {
    const scanner = qrScannerRef.current;
    if (!scanner) {
      setScannerStarted(false);
      return;
    }

    try {
      if (typeof scanner.clear === 'function') {
        await scanner.clear();
      }
    } catch {
      // ignore cleanup errors when scanner is already inactive
    }

    qrScannerRef.current = null;
    setScannerStarted(false);
    setScannerStarting(false);
  }, []);

  const markUsbResult = useCallback((descriptor) => {
    if (scanSourceRef.current === 'usb') setUsbResult(descriptor);
  }, []);

  const startUsbScanner = useCallback(async () => {
    if (!academicYear) {
      toast.error('Please select Academic Year before starting the USB scanner.');
      return;
    }
    // USB mode never requests camera access — release any active camera first.
    await stopQrScanner();
    setUsbActive(true);
    setUsbResult(null);
  }, [academicYear, stopQrScanner]);

  const stopUsbScanner = useCallback(async () => {
    setUsbActive(false);
    setUsbResult(null);
  }, []);

  const processScannedQr = useCallback(async (qrValue) => {
    const normalizedQrValue = typeof qrValue === 'string' ? qrValue.trim() : '';
    if (!normalizedQrValue || isProcessingScanRef.current) return;
    if (lastScannedQrRef.current && lastScannedQrRef.current === normalizedQrValue) return;

    isProcessingScanRef.current = true;
    lastScannedQrRef.current = normalizedQrValue;
    setScannerMessage('Processing scanned QR code...');
    setScannerMessageType('info');

    try {
      const result = await qrAttendanceService.scanAnyAttendance({
        qrValue: normalizedQrValue,
        academicYear,
        date,
      });

      const recordType = result?.type || 'teacher';

      if (recordType === 'teacher') {
        const teacher = result?.teacher || null;
        const teacherLabel = teacher.fullName ? `${teacher.fullName} (${teacher.teacherId || 'Teacher'})` : (teacher.teacherId || 'Teacher');
        const isCheckout = result?.action === 'checkout';
        const successMessage = isCheckout
          ? `Teacher checked out successfully — ${teacherLabel}${result.checkOut ? ` at ${formatExactTime(result.checkOut)}` : ''}.`
          : `Teacher attendance marked successfully — ${teacherLabel} is ${result.status}.`;
        setScannerMessage(successMessage);
        setScannerMessageType('success');
        toast.success(successMessage);

        const matchedTeacher = teachers.find((item) => item._id === teacher._id || item.teacherId === teacher.teacherId);
        if (matchedTeacher) {
          setAttendanceMap((prev) => ({
            ...prev,
            [matchedTeacher._id]: {
              ...prev[matchedTeacher._id],
              id: result.id || prev[matchedTeacher._id]?.id,
              status: result.status,
              checkIn: result.checkIn ? formatExactTime(result.checkIn) : prev[matchedTeacher._id]?.checkIn || '',
              checkOut: result.checkOut ? formatExactTime(result.checkOut) : prev[matchedTeacher._id]?.checkOut || '',
              checkInRaw: result.checkIn || prev[matchedTeacher._id]?.checkInRaw || '',
              checkOutRaw: result.checkOut || prev[matchedTeacher._id]?.checkOutRaw || '',
            },
          }));
        }
        markUsbResult({
          ok: true,
          type: 'teacher',
          person: {
            fullName: teacher.fullName || '',
            id: teacher.teacherId || '',
            className: '',
            image: matchedTeacher?.teacherImage ? getImageUrl(matchedTeacher.teacherImage) : null,
          },
          status: result?.status || 'Present',
          checkIn: result?.checkIn ? formatExactTime(result.checkIn) : '',
          checkInRaw: result?.checkIn || '',
          checkOut: result?.checkOut ? formatExactTime(result.checkOut) : '',
          checkOutRaw: result?.checkOut || '',
          action: result?.action === 'checkout' ? 'checkout' : 'checkin',
        });
        return;
      }

      const student = result?.student || null;
      if (student && (student.fullName || student.studentId)) {
        const studentLabel = student.fullName ? `${student.fullName} (${student.studentId || 'Student'})` : (student.studentId || 'Student');
        const successMessage = `Student attendance marked successfully — ${studentLabel} is ${result.status}.`;
        setScannerMessage(successMessage);
        setScannerMessageType('success');
        toast.success(successMessage);
        markUsbResult({
          ok: true,
          type: 'student',
          person: {
            fullName: student.fullName || '',
            id: student.studentId || '',
            className: student.class || '',
            image: null,
          },
          status: result?.status || 'Present',
          checkIn: result?.checkIn ? formatExactTime(result.checkIn) : '',
          checkInRaw: result?.checkIn || '',
          checkOut: '',
          checkOutRaw: '',
          action: 'checkin',
        });
      }
    } catch (error) {
      const rawMessage = error?.response?.data?.message || error?.message || 'QR scan failed.';
      const message = /already marked/i.test(rawMessage) ? 'Already marked' : rawMessage;
      setScannerMessage(message);
      setScannerMessageType('error');
      toast.error(message);
      markUsbResult({ ok: false, message });
    } finally {
      isProcessingScanRef.current = false;
      lastScannedQrRef.current = '';
    }
  }, [academicYear, date, formatExactTime, markUsbResult, teachers]);

  const startQrScanner = useCallback(async () => {
    if (!academicYear) {
      toast.error('Please select Academic Year before starting the QR scanner.');
      return;
    }

    // Switching to the camera scanner cleanly ends USB input mode.
    if (usbActive) stopUsbScanner();

    if (qrScannerRef.current) {
      setScannerStarted(true);
      return;
    }

    const scannerContainer = document.getElementById(scannerElementId);
    if (!scannerContainer) {
      const message = 'Scanner container is not mounted yet.';
      setScannerMessage(`Camera initialization failed: ${message}`);
      setScannerMessageType('error');
      return;
    }

    setScannerStarting(true);
    setScannerMessage('Requesting camera access...');
    setScannerMessageType('info');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('This browser does not support camera access.');
      }

      const scanner = new Html5QrcodeScanner(
        scannerElementId,
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.5,
          disableFlip: false,
          rememberLastUsedCamera: true,
        },
        false,
      );

      qrScannerRef.current = scanner;
      scanner.render(
        async (decodedText) => {
          await processScannedQr(decodedText);
        },
        (errorMessage) => {
          const message = typeof errorMessage === 'string' ? errorMessage : 'QR not detected';
          if (!/no qr code|qr code not found|not found/i.test(message)) {
            console.warn('QR scanner frame error:', message);
          }
        },
      );

      setScannerStarted(true);
      setScannerMessage('Camera ready. Scan a student or teacher QR code to mark attendance.');
      setScannerMessageType('info');
    } catch (error) {
      const browserError = error instanceof DOMException ? `${error.name}: ${error.message}` : error?.message || 'Unable to access the camera.';
      const message = `Camera access failed: ${browserError}`;
      setScannerMessage(message);
      setScannerMessageType('error');
      toast.error(message);

      if (qrScannerRef.current) {
        try {
          await qrScannerRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
      }
      qrScannerRef.current = null;
      setScannerStarted(false);
    } finally {
      setScannerStarting(false);
    }
  }, [academicYear, processScannedQr, stopUsbScanner, usbActive]);

  useEffect(() => {
    if (!isScannerMode) {
      stopQrScanner();
      setScannerMessage('');
      setScannerMessageType('info');
      return undefined;
    }

    return () => {
      stopQrScanner();
      stopUsbScanner();
    };
  }, [isScannerMode, stopQrScanner, stopUsbScanner]);

  const renderTable = () => (
    <>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Photo</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Teacher Name</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Teacher ID</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Status</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Check In</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Check Out</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Working Hours</th>
              <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedTeachers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <UsersIcon className="h-12 w-12 mb-3" />
                    <p className="text-sm font-medium">No Teachers Loaded</p>
                    <p className="text-xs mt-1">Select Academic Year and click Load Teachers.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTeachers.map((teacher) => {
                const record = attendanceMap[teacher._id] || { status: 'Pending', checkIn: '', checkOut: '', checkInRaw: '', checkOutRaw: '' };
                const canCheckIn = !record.checkIn && !record.checkOut && (!record.status || record.status === 'Pending');
                const canCheckOut = !record.checkOut && Boolean(record.checkIn);
                return (
                  <tr key={teacher._id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/30">
                        {teacher.fullName?.charAt(0) || 'T'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{teacher.fullName}</td>
                    <td className="px-4 py-3 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{teacher.teacherId}</td>
                    <td className="px-4 py-3">
                      {isScannerMode ? renderStatusBadge(record.status || 'Pending') : renderStatusDropdown(teacher._id, record.status || 'Pending')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/80 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-700 min-w-[72px]">
                        {record.checkIn || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/80 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-700 min-w-[72px]">
                        {record.checkOut || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block text-xs font-mono text-gray-600 dark:text-gray-400 px-2.5 py-1">
                        {getWorkingHours(record.checkInRaw, record.checkOutRaw)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setViewTeacher(teacher)}
                          title="View Attendance"
                          className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {canMark && (canCheckIn ? (
                          <button
                            onClick={() => runTeacherCheckAction(teacher)}
                            disabled={actionBusyTeacherId === teacher._id}
                            title="Check In"
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ArrowLeftIcon className="h-4 w-4" />
                            <span className="text-xs font-medium whitespace-nowrap">Check In</span>
                          </button>
                        ) : canCheckOut ? (
                          <button
                            onClick={() => runTeacherCheckAction(teacher)}
                            disabled={actionBusyTeacherId === teacher._id}
                            title="Check Out"
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ArrowRightIcon className="h-4 w-4" />
                            <span className="text-xs font-medium whitespace-nowrap">Check Out</span>
                          </button>
                        ) : record.checkOut ? (
                          <span className="px-2 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            Checked Out
                          </span>
                        ) : null)}
                        {canMark && (
                          <button
                            onClick={() => setResetTarget(teacher._id)}
                            disabled={!record.id || resetting}
                            title={record.id ? 'Delete / Reset Attendance record' : 'No attendance record to reset'}
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {renderPagination()}
      </div>
    </>
  );

  const renderViewModal = () => {
    if (!viewTeacher) return null;
    const record = attendanceMap[viewTeacher._id] || {};
    return (
      <Modal isOpen={!!viewTeacher} onClose={() => setViewTeacher(null)} title="Attendance Details" maxWidth="max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl ring-2 ring-yellow-400/50 mb-3 overflow-hidden">
            {viewTeacher.fullName?.charAt(0) || 'T'}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{viewTeacher.fullName}</h3>
          {renderStatusBadge(record.status || '—')}
        </div>
        <div className="space-y-0">
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Teacher ID</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{viewTeacher.teacherId}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Attendance Status</span>
            <span className="text-sm font-medium">{renderStatusBadge(record.status || '—')}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Check In Time</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{record.checkIn || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Check Out Time</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{record.checkOut || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Academic Year</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{academicYear || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Attendance Method</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{attendanceMode}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">Date</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{date}</span>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teacher Attendance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage daily teacher attendance records</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={CheckCircleIcon} label="Present Teachers" value={stats.present} color="green" />
        <StatCard icon={XCircleIcon} label="Absent Teachers" value={stats.absent} color="red" />
        <StatCard icon={ClockIcon} label="Leave" value={stats.leave} color="yellow" />
        <StatCard icon={CalendarDaysIcon} label="Late" value={stats.late} color="blue" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectInput
            label="Academic Year"
            name="academicYear"
            value={academicYear}
            onChange={(event) => setAcademicYear(event.target.value)}
            options={ACADEMIC_YEARS}
            placeholder="Select year"
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Teacher</label>
            <div className="relative">
              <select
                value={selectedTeacherId}
                onChange={(event) => {
                  setSelectedTeacherId(event.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="">All Teachers</option>
                {teacherOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <DateInput
            label="Date"
            name="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Attendance Method
            </label>
            <div className="relative">
              <select
                value={attendanceMode}
                onChange={(event) => setAttendanceMode(event.target.value)}
                className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                {ATTENDANCE_MODES.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={loadTeachers}
            disabled={!academicYear || loading}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            <UsersIcon className="h-4 w-4" />
            Load Teachers
          </button>
        </div>
      </div>

      {isScannerMode && canMark && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">QR Scanner</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Scan either a Student or Teacher QR to mark attendance instantly.</p>
            </div>
            <button
              type="button"
              onClick={startQrScanner}
              disabled={scannerStarting || scannerStarted}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {scannerStarting ? 'Starting...' : scannerStarted ? 'Scanner Active' : 'Start Camera Scanner'}
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-black/5 dark:bg-black/20 min-h-[320px]">
            <div id={scannerElementId} className="relative w-full min-h-[320px]" />
          </div>

          {scannerMessage && (
            <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${scannerMessageType === 'success' ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300' : scannerMessageType === 'error' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300' : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'}`}>
              {scannerMessage}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <UsbQrScanner
              active={usbActive}
              disabled={!academicYear}
              onActivate={startUsbScanner}
              onDeactivate={stopUsbScanner}
              onScan={(value) => { scanSourceRef.current = 'usb'; processScannedQr(value); }}
              result={usbResult}
            />
          </div>
        </div>
      )}

      {loading && renderLoadingState()}
      {!loading && !loaded && renderEmptyState()}
      {!loading && loaded && renderTable()}

      {renderViewModal()}

      <ConfirmationModal
        isOpen={!!resetTarget}
        onClose={() => { if (!resetting) setResetTarget(null); }}
        title="Delete Attendance Record"
        message="Are you sure you want to delete this teacher's attendance record for the selected date? The record will be removed from the backend and the teacher will return to Pending."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={resetting}
        onConfirm={handleResetConfirm}
      />
    </div>
  );
};

export default TeacherAttendance;
