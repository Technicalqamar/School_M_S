import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  CheckCircleIcon, XCircleIcon, ClockIcon,
  CalendarDaysIcon, UserGroupIcon,
  EyeIcon, ArrowPathIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import SelectInput from '../../common/SelectInput/SelectInput';
import DateInput from '../../common/DateInput/DateInput';
import Modal from '../../common/Modal/Modal';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import { CLASS_NAMES, ACADEMIC_YEARS } from '../../../utils/classNames';
import { getImageUrl } from '../../../utils/imageUrl';
import Spinner from '../../common/Spinner/Spinner';
import Button from '../../common/Button/Button';
import { useFormatTime } from '../../../hooks/useLocalization';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import studentAttendanceService from '../../../services/studentAttendance/studentAttendance.service';
import qrAttendanceService from '../../../services/qrAttendanceService/qrAttendanceService';

const BASE_STATUS_OPTIONS = ['Select Status', 'Present', 'Absent', 'Late'];
const ATTENDANCE_METHODS = ['Manual Attendance', 'QR Scanner'];

const STATUS_STYLES = {
  Present: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  Absent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
  Leave: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  Late: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
  Pending: 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600',
  'Select Status': 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600',
};

const STATUS_COLORS = {
  Present: { dot: 'bg-green-500', hover: 'hover:bg-green-50 dark:hover:bg-green-900/20', text: 'text-green-700 dark:text-green-300' },
  Absent: { dot: 'bg-red-500', hover: 'hover:bg-red-50 dark:hover:bg-red-900/20', text: 'text-red-700 dark:text-red-300' },
  Leave: { dot: 'bg-yellow-400', hover: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-300' },
  Late: { dot: 'bg-blue-500', hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300' },
  'Select Status': { dot: 'bg-gray-400', hover: 'hover:bg-gray-50 dark:hover:bg-gray-900/20', text: 'text-gray-500 dark:text-gray-400' },
};

const PAGE_SIZE = 10;

const StudentAttendance = () => {
  const formatTime = useFormatTime();
  const { academic, attendanceRules, weekendSettings } = useSchoolConfig();
  const STATUS_OPTIONS = attendanceRules?.allowLeaveMarking
    ? [...BASE_STATUS_OPTIONS, 'Leave']
    : BASE_STATUS_OPTIONS;
  const [academicYear, setAcademicYear] = useState(academic?.currentYear || '');
  const [className, setClassName] = useState('All Classes');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceMethod, setAttendanceMethod] = useState('Manual Attendance');
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [viewStudent, setViewStudent] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetCheckInTime, setResetCheckInTime] = useState('');
  const [resetting, setResetting] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannerMessage, setScannerMessage] = useState('');
  const [scannerMessageType, setScannerMessageType] = useState('info');
  const qrScannerRef = useRef(null);
  const scannerElementId = 'student-attendance-qr-reader';
  const isProcessingScanRef = useRef(false);
  const lastScannedQrRef = useRef('');
  const isWeekend = weekendSettings?.enabled && weekendSettings?.days?.includes(new Date().toLocaleDateString('en-US', { weekday: 'long' }));
  const [currentPage, setCurrentPage] = useState(1);

  const academicYearOptions = useMemo(() => {
    const values = new Set([academic?.currentYear, ...ACADEMIC_YEARS].filter(Boolean));
    return Array.from(values);
  }, [academic?.currentYear]);

  const isScannerMode = attendanceMethod === 'QR Scanner';

  const totalPages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));

  const paginatedStudents = useMemo(
    () => students.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [students, currentPage]
  );

  const stats = useMemo(() => {
    const records = Object.values(attendanceMap);
    const present = records.filter(r => r.status === 'Present').length;
    const absent = records.filter(r => r.status === 'Absent').length;
    const leave = records.filter(r => r.status === 'Leave').length;
    const late = records.filter(r => r.status === 'Late').length;
    return { present, absent, leave, late, total: students.length };
  }, [attendanceMap, students.length]);

  useEffect(() => {
    const close = () => setOpenDropdownId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (academic?.currentYear && (!academicYear || academicYear === '')) {
      setAcademicYear(academic.currentYear);
    }
  }, [academic?.currentYear, academicYear]);

  const loadStudents = useCallback(async () => {
    if (isWeekend) return;
    if (!academicYear || !className) {
      toast.error('Please select Academic Year and Class');
      return;
    }
    setCurrentPage(1);
    setLoading(true);
    setLoaded(false);
    setHasSearched(true);
    setStudents([]);
    setAttendanceMap({});
    try {
      const response = await studentAttendanceService.getStudentsWithAttendance({
        academicYear,
        class: className === 'All Classes' ? '' : className,
        date,
      });
      const { students: fetchedStudents = [], attendanceMap: existing = {} } = response.data || {};
      setStudents(fetchedStudents);
      if (fetchedStudents.length === 0) {
        toast.error('No students found for the selected filters.');
        setLoaded(false);
        return;
      }
      const isScanner = attendanceMethod === 'QR Scanner';
      const defaultStatus = isScanner ? 'Pending' : 'Select Status';
      const mergedMap = {};
      fetchedStudents.forEach((s) => {
        const existingRecord = existing[s._id];
        if (existingRecord) {
           mergedMap[s._id] = {
             status: existingRecord.status,
             checkIn: existingRecord.checkIn
               ? formatTime(new Date(existingRecord.checkIn))
               : '',
           };
        } else {
          mergedMap[s._id] = { status: defaultStatus, checkIn: '' };
        }
      });
      setAttendanceMap(mergedMap);
      setLoaded(true);
      toast.success('Students loaded successfully.');
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [academicYear, className, date, attendanceMethod]);

  const saveSingleRecord = async (studentId, status) => {
    if (!academicYear || !className || !loaded) return;
    try {
      const response = await studentAttendanceService.saveAttendance({
        academicYear,
        class: className === 'All Classes' ? '' : className,
        date,
        records: [{
          student: studentId,
          status,
          method: isScannerMode ? 'QR' : 'Manual',
        }],
      });
      // The backend may reassign the status (e.g. Present recorded after the
      // Attendance End Time becomes Late); reflect it so the UI stays accurate.
      const returnedMap = response?.data?.attendanceMap;
      if (returnedMap && returnedMap[studentId]) {
        setAttendanceMap((prev) => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            status: returnedMap[studentId].status,
          },
        }));
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save attendance';
      toast.error(msg);
    }
  };

  const handleMarkAllPresent = async () => {
    if (!loaded || students.length === 0) return;
    setAttendanceMap((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s._id] = { status: 'Present', checkIn: '' };
      });
      return next;
    });
    const records = students.map((s) => ({
      student: s._id,
      status: 'Present',
      method: isScannerMode ? 'QR' : 'Manual',
    }));
    try {
      const response = await studentAttendanceService.saveAttendance({
        academicYear,
        class: className === 'All Classes' ? '' : className,
        date,
        records,
      });
      const returnedMap = response?.data?.attendanceMap;
      if (returnedMap) {
        setAttendanceMap((prev) => {
          const next = { ...prev };
          Object.keys(returnedMap).forEach((id) => {
            if (next[id]) {
              next[id] = { ...next[id], status: returnedMap[id].status };
            }
          });
          return next;
        });
      }
      toast.success('All students marked present');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save attendance';
      toast.error(msg);
    }
  };

  const handleAttendanceMethodChange = (e) => {
    const method = e.target.value;
    setAttendanceMethod(method);
    if (!loaded) return;
    const isScanner = method === 'QR Scanner';
    const defaultStatus = isScanner ? 'Pending' : 'Select Status';
    setAttendanceMap(prev => {
      const next = {};
      Object.keys(prev).forEach(id => {
        next[id] = { ...prev[id], status: defaultStatus, checkIn: '' };
      });
      return next;
    });
  };

  const handleAcademicYearChange = (e) => {
    const value = e.target.value;
    setAcademicYear(value);
    setLoaded(false);
    setHasSearched(false);
    setStudents([]);
    setAttendanceMap({});
  };

  const handleClassNameChange = (e) => {
    const value = e.target.value;
    setClassName(value);
    setLoaded(false);
    setHasSearched(false);
    setStudents([]);
    setAttendanceMap({});
  };

  const updateAttendance = (studentId, field, value) => {
    setAttendanceMap(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
        ...(field === 'status' && value === 'Select Status' ? { checkIn: '' } : {}),
      },
    }));
    if (field === 'status' && value !== 'Select Status') {
      saveSingleRecord(studentId, value);
    }
  };

  const handleResetConfirm = async () => {
    if (!resetTarget) return;
    setResetting(true);
    const studentId = resetTarget._id;
    const prevRecord = attendanceMap[studentId] || {};
    const hasExistingRecord = prevRecord.status && prevRecord.status !== 'Select Status' && prevRecord.status !== 'Pending';
    try {
      if (hasExistingRecord) {
        const checkInDateTime = resetCheckInTime ? `${date}T${resetCheckInTime}` : undefined;
        await studentAttendanceService.resetCheckIn({
          studentId,
          date,
          academicYear,
          checkIn: checkInDateTime,
        });
      }
      setAttendanceMap(prev => ({
        ...prev,
        [studentId]: hasExistingRecord
          ? { ...prev[studentId], checkIn: resetCheckInTime ? formatTime(new Date(`${date}T${resetCheckInTime}`)) : '' }
          : prev[studentId],
      }));
      if (hasExistingRecord) {
        toast.success(resetCheckInTime ? 'Attendance check-in time has been updated successfully.' : 'Attendance check-in time has been cleared successfully.');
      } else {
        toast.error('No attendance record found to reset.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to reset attendance';
      toast.error(msg);
    } finally {
      setResetting(false);
      setResetCheckInTime('');
      setResetTarget(null);
    }
  };

  const handleResetClick = (student) => {
    setResetTarget(student);
    setResetCheckInTime('');
  };

  const renderStatusBadge = (status) => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.Pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
        {status}
      </span>
    );
  };

  const renderEmptyState = () => {
    if (isWeekend) {
      const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <CalendarDaysIcon className="h-16 w-16 text-yellow-400 dark:text-yellow-500 mb-4" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Weekend Detected
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Today is <strong>{weekday}</strong>, which is configured as a Weekend in School Settings.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
            Student attendance is unavailable today. Please continue on the next working day or update the Weekend configuration from School Settings if necessary.
          </p>
        </div>
      );
    }
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <UserGroupIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">
          {hasSearched ? 'No Students Found' : 'No Students Loaded'}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          {hasSearched
            ? 'No students match the selected filters. Try a different class or date.'
            : 'Select Academic Year and Class to load students.'}
        </p>
      </div>
    );
  };

  const renderLoadingState = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
      <Spinner size="md" className="text-blue-600 mb-4" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading students...</p>
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
        className,
        date,
      });

      const recordType = result?.type || 'student';
      if (recordType === 'student') {
        const student = result?.student || {};
        const studentLabel = student.fullName
          ? `${student.fullName}${student.studentId ? ` (${student.studentId})` : ''}`
          : 'Student';
        const status = result?.status || 'Present';
        const successMessage = `Student attendance marked successfully — ${studentLabel} is ${status}.`;

        setScannerMessage(successMessage);
        setScannerMessageType('success');
        toast.success(successMessage);

        const matchedStudent = students.find((item) => item.studentId === student.studentId);
        if (matchedStudent && result?.status) {
          setAttendanceMap((prev) => ({
            ...prev,
            [matchedStudent._id]: {
              ...prev[matchedStudent._id],
              status: result.status,
              checkIn: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
            },
          }));
        }
        return;
      }

      const teacher = result?.teacher || {};
      const teacherLabel = teacher.fullName
        ? `${teacher.fullName}${teacher.teacherId ? ` (${teacher.teacherId})` : ''}`
        : 'Teacher';
      const status = result?.status || 'Present';
      const successMessage = `Teacher attendance marked successfully — ${teacherLabel} is ${status}.`;

      setScannerMessage(successMessage);
      setScannerMessageType('success');
      toast.success(successMessage);
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'QR scan failed.';
      setScannerMessage(message);
      setScannerMessageType('error');
      toast.error(message);
    } finally {
      isProcessingScanRef.current = false;
      lastScannedQrRef.current = '';
    }
  }, [academicYear, className, date, students]);

  const startQrScanner = useCallback(async () => {
    if (!academicYear || !className || className === 'Select Class') {
      toast.error('Please select Academic Year and Class before starting the QR scanner.');
      return;
    }

    if (qrScannerRef.current) {
      setScannerStarted(true);
      return;
    }

    const scannerContainer = document.getElementById(scannerElementId);
    if (!scannerContainer) {
      const message = 'Scanner container is not mounted yet.';
      setScannerMessage(`Camera initialization failed: ${message}`);
      setScannerMessageType('error');
      console.error('QR scanner startup failed:', message);
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
      setScannerMessage('Camera ready. Scan a student QR code to mark attendance.');
      setScannerMessageType('info');
    } catch (error) {
      const browserError = error instanceof DOMException
        ? `${error.name}: ${error.message}`
        : error?.message || 'Unable to access the camera.';

      const message = `Camera access failed: ${browserError}`;
      setScannerMessage(message);
      setScannerMessageType('error');
      console.error('QR scanner startup failed:', error);
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
  }, [academicYear, className, processScannedQr, scannerElementId]);

  useEffect(() => {
    if (!isScannerMode) {
      stopQrScanner();
      setScannerMessage('');
      setScannerMessageType('info');
      return undefined;
    }

    return () => {
      stopQrScanner();
    };
  }, [isScannerMode, stopQrScanner]);

  useEffect(() => {
    if (!scannerStarted) return undefined;

    const container = document.getElementById(scannerElementId);
    if (!container) return undefined;

    const video = container.querySelector('video');
    if (!video) return undefined;

    video.style.width = '100%';
    video.style.height = '100%';
    video.style.display = 'block';
    video.style.objectFit = 'cover';
    video.style.background = '#000';
    video.style.position = 'absolute';
    video.style.inset = '0';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.minHeight = '320px';
    container.style.background = '#000';
    return undefined;
  }, [scannerStarted, scannerElementId]);

  const renderScannerPanel = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 flex-shrink-0">
            <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9.75A2.75 2.75 0 015.75 7h12.5A2.75 2.75 0 0121 9.75v4.5A2.75 2.75 0 0118.25 17H5.75A2.75 2.75 0 013 14.25v-4.5zm3-2.25h.01M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7m-6 7.5h6" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">QR Scanner</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Scan a student QR code to mark attendance.</p>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={scannerStarted ? stopQrScanner : startQrScanner}
          loading={scannerStarting}
          disabled={isWeekend || !academicYear || !className || scannerStarting}
          className="!w-auto !inline-flex items-center gap-2"
        >
          {scannerStarted ? 'Stop Scanner' : 'Start Scanner'}
        </Button>
      </div>

      <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
        <div className={scannerStarted ? 'relative block w-full min-h-[320px] max-h-[420px]' : 'hidden'}>
          <div id={scannerElementId} className="absolute inset-0 w-full h-full overflow-hidden" />
          <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] font-medium text-white">
            Place student QR card inside the frame
          </div>
        </div>

        {!scannerStarted && (
          <div className="flex min-h-[320px] items-center justify-center text-center px-6">
            <div>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9.75A2.75 2.75 0 015.75 7h12.5A2.75 2.75 0 0121 9.75v4.5A2.75 2.75 0 0118.25 17H5.75A2.75 2.75 0 013 14.25v-4.5zm3-2.25h.01M9 7V5.5A1.5 1.5 0 0110.5 4h3A1.5 1.5 0 0115 5.5V7m-6 7.5h6" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Camera preview is offline</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Start the scanner to grant camera access and begin marking attendance.</p>
            </div>
          </div>
        )}
      </div>

      {scannerMessage && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          scannerMessageType === 'success'
            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300'
            : scannerMessageType === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300'
              : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300'
        }`}>
          {scannerMessage}
        </div>
      )}
    </div>
  );

  const renderStatusDropdown = (studentId, currentStatus) => (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === studentId ? null : studentId); }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium transition-all hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer ${STATUS_COLORS[currentStatus].text}`}
      >
        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[currentStatus].dot}`} />
        {currentStatus}
        <ChevronDownIcon className="h-3 w-3 text-gray-400 ml-0.5" />
      </button>
      {openDropdownId === studentId && (
        <div className="absolute left-0 mt-1.5 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 py-1 overflow-hidden">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={(e) => { e.stopPropagation(); updateAttendance(studentId, 'status', opt); setOpenDropdownId(null); }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors ${STATUS_COLORS[opt].hover} ${currentStatus === opt ? STATUS_COLORS[opt].text : 'text-gray-700 dark:text-gray-200'}`}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[opt].dot} flex-shrink-0`} />
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderPagination = () => {
    if (students.length === 0) return null;
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) { start = 2; end = Math.min(4, totalPages - 1); }
      if (currentPage >= totalPages - 2) { start = Math.max(2, totalPages - 3); end = totalPages - 1; }
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {students.length} student{students.length !== 1 ? 's' : ''} — Page {currentPage} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Previous
          </button>
          {pages.map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-gray-400 dark:text-gray-500">...</span>
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
            )
          )}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const renderTable = () => (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Photo</th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Student Name</th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Student ID</th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Class</th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Status</th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Check In</th>
            <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {students.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                  <UserGroupIcon className="h-12 w-12 mb-3" />
                  <p className="text-sm font-medium">{hasSearched ? 'No Students Found' : 'No Students Loaded'}</p>
                  <p className="text-xs mt-1">{hasSearched ? 'Try different filters.' : 'Select Academic Year and Class to load students.'}</p>
                </div>
              </td>
            </tr>
          ) : (
            paginatedStudents.map((student) => {
              const record = attendanceMap[student._id] || { status: isScannerMode ? 'Pending' : 'Present', checkIn: '' };
              return (
                <tr key={student._id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/30 overflow-hidden">
                      {getImageUrl(student.studentImage) ? (
                        <img src={getImageUrl(student.studentImage)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <span>{student.fullName?.charAt(0) || 'S'}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{student.fullName}</td>
                  <td className="px-4 py-3 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{student.studentId}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{student.class}</td>
                  <td className="px-4 py-3">
                    {isScannerMode ? (
                      renderStatusBadge(record.status)
                    ) : (
                      renderStatusDropdown(student._id, record.status)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/80 px-2.5 py-1 rounded-md border border-gray-100 dark:border-gray-700 min-w-[72px]">
                      {record.checkIn || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setViewStudent(student)}
                        title="View Attendance"
                        className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleResetClick(student)}
                        title="Reset Attendance"
                        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                      </button>
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
  );

  const renderViewModal = () => {
    if (!viewStudent) return null;
    const record = attendanceMap[viewStudent._id] || {};
    return (
      <Modal isOpen={!!viewStudent} onClose={() => setViewStudent(null)} title="Attendance Details" maxWidth="max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl ring-2 ring-yellow-400/50 mb-3 overflow-hidden">
            {getImageUrl(viewStudent.studentImage) ? (
              <img src={getImageUrl(viewStudent.studentImage)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <span>{viewStudent.fullName?.charAt(0) || 'S'}</span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{viewStudent.fullName}</h3>
          {renderStatusBadge(record.status || '—')}
        </div>
        <div className="space-y-0">
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Student ID</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{viewStudent.studentId}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Class</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{viewStudent.class}</span>
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
            <span className="text-sm text-gray-500 dark:text-gray-400">Academic Year</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{viewStudent.academicYear || academicYear}</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Attendance Mode</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{attendanceMethod}</span>
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Attendance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage daily student attendance records</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={CheckCircleIcon} label="Present" value={stats.present} color="green" />
        <StatCard icon={XCircleIcon} label="Absent" value={stats.absent} color="red" />
        <StatCard icon={ClockIcon} label="Leave" value={stats.leave} color="yellow" />
        <StatCard icon={CalendarDaysIcon} label="Late" value={stats.late} color="blue" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <SelectInput
             label="Academic Year"
             name="academicYear"
             value={academicYear}
             onChange={handleAcademicYearChange}
             options={academicYearOptions}
             placeholder="Select year"
             disabled={isWeekend}
           />
           <SelectInput
             label="Class"
             name="className"
             value={className}
             onChange={handleClassNameChange}
             options={['All Classes', ...CLASS_NAMES]}
             placeholder="Select class"
             disabled={isWeekend}
           />
           <DateInput
             label="Date"
             name="date"
             value={date}
             onChange={(e) => setDate(e.target.value)}
             disabled={isWeekend}
           />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Attendance Method
            </label>
            <div className="relative">
              <select
                value={attendanceMethod}
                onChange={handleAttendanceMethodChange}
                className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                {ATTENDANCE_METHODS.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
           <Button
             variant="primary"
             onClick={loadStudents}
             loading={loading}
             disabled={isWeekend || !academicYear || !className}
             className="!w-auto !inline-flex items-center gap-2"
           >
            <UserGroupIcon className="h-4 w-4" />
            Load Students
          </Button>
          {loaded && !isWeekend && (
            <button
              onClick={handleMarkAllPresent}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Mark All Present
            </button>
          )}
        </div>
      </div>

      {isScannerMode && renderScannerPanel()}

      {loading && renderLoadingState()}
      {!loading && !loaded && renderEmptyState()}
      {!loading && loaded && renderTable()}

      {renderViewModal()}

      <ConfirmationModal
        isOpen={!!resetTarget}
        onClose={() => { if (!resetting) { setResetTarget(null); setResetCheckInTime(''); } }}
        title="Reset Attendance"
        confirmLabel="Reset"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={handleResetConfirm}
        loading={resetting}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
          Are you sure you want to reset attendance for <strong>{resetTarget?.fullName || 'this student'}</strong>?
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Check-in Time <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="time"
            value={resetCheckInTime}
            onChange={(e) => setResetCheckInTime(e.target.value)}
            disabled={resetting}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            Leave blank to clear the existing check-in time. Enter a time to update it.
          </p>
        </div>
      </ConfirmationModal>
    </div>
  );
};

export default StudentAttendance;
