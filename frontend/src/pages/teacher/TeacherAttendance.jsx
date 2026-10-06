import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  UserCircleIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  UserGroupIcon,
  ChevronDownIcon,
  PaperAirplaneIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import Spinner from '../../components/common/Spinner/Spinner';
import StatCard from '../../components/common/StatCard/StatCard';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';
import { getImageUrl } from '../../utils/imageUrl';
import attendanceService from '../../services/teacher/attendance.service';

const EMPTY_DASH = '—';

// Local YYYY-MM-DD (avoids the UTC-offset shift when slicing an ISO string).
const toLocalDateStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const TODAY = toLocalDateStr(new Date());

// Same statuses (and colors) the existing Student Attendance module uses.
const BASE_STATUS_OPTIONS = ['Present', 'Absent', 'Late'];

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
};

const LEAVE_STATUS_STYLES = {
  Pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
  Approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
  Rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700',
};

const EMPTY_STUDENT_PROBE = {
  status: 'loading', // 'loading' | 'on' | 'off' | 'error'
  reason: '',
  responsibleClass: null,
  academicYear: '',
};

/**
 * Teacher Attendance.
 *
 *   - Own Attendance (check-in / check-out / working hours) — READ-ONLY,
 *     always available.
 *   - Leave Requests — the existing Leave system, teacher always submits as
 *     Pending and views only their own requests.
 *   - Manual Student Attendance — shown ONLY when the backend confirms the
 *     School Settings flag "Teacher Manual Student Attendance" is ON (the
 *     probe returns 403 when OFF). The responsible class is derived by the
 *     backend from the teacher's FIRST scheduled timetable period; there is
 *     NO class selector anywhere, so another class can never be opened or
 *     marked. Timetable changes automatically change the class on the next
 *     load. Saving delegates to the existing Student Attendance rules.
 */
const TeacherAttendance = () => {
  const { attendanceRules } = useSchoolConfig();
  const allowLeave = attendanceRules?.allowLeaveMarking ?? true;
  const STATUS_OPTIONS = allowLeave ? [...BASE_STATUS_OPTIONS, 'Leave'] : BASE_STATUS_OPTIONS;

  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceData, setAttendanceData] = useState({ teacher: {}, academicYear: '', summary: {}, today: null, records: [] });

  const [leaveLoading, setLeaveLoading] = useState(true);
  const [leaveError, setLeaveError] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [leaveForm, setLeaveForm] = useState({ fromDate: TODAY, toDate: TODAY, reason: '' });
  const [submittingLeave, setSubmittingLeave] = useState(false);

  const [studentProbe, setStudentProbe] = useState(EMPTY_STUDENT_PROBE);
  const [studentClass, setStudentClass] = useState({ className: '', period: null });
  const [stampDate, setStampDate] = useState(TODAY);
  const [students, setStudents] = useState([]);
  const [studentSelections, setStudentSelections] = useState({});
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentLoaded, setStudentLoaded] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [saving, setSaving] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadOwnAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const res = await attendanceService.getMyAttendance();
      setAttendanceData(res.data || { teacher: {}, academicYear: '', summary: {}, today: null, records: [] });
    } catch (err) {
      setAttendanceError(err?.response?.data?.message || 'Failed to load your attendance');
      if (import.meta.env.DEV) {
        console.error('Teacher attendance load failed', {
          status: err?.response?.status,
          detail: err?.response?.data,
        });
      }
    } finally {
      setAttendanceLoading(false);
    }
  }, []);

  const loadLeaveRequests = useCallback(async () => {
    setLeaveLoading(true);
    setLeaveError('');
    try {
      const res = await attendanceService.getMyLeaveRequests();
      setLeaves(res.data?.leaves || []);
    } catch (err) {
      setLeaveError(err?.response?.data?.message || 'Failed to load your leave requests');
    } finally {
      setLeaveLoading(false);
    }
  }, []);

  const loadStudents = useCallback(async (date) => {
    setStudentLoading(true);
    setStudentError('');
    try {
      const res = await attendanceService.getClassStudents({ date });
      const data = res.data || {};
      setStudentClass({
        className: data.class?.className || '',
        period: data.class?.period || null,
      });
      const fetched = data.students || [];
      setStudents(fetched);
      const merged = {};
      fetched.forEach((s) => {
        const existing = data.attendanceMap?.[s._id];
        merged[s._id] = {
          status: existing?.status || 'Present',
          checkIn: existing?.checkIn || null,
          method: existing?.method || 'Manual',
          leaveReason: existing?.leaveReason || '',
        };
      });
      setStudentSelections(merged);
      setStudentLoaded(true);
    } catch (err) {
      // Setting was switched OFF between the probe and this call — hide the section.
      if (err?.response?.status === 403) {
        setStudentProbe(EMPTY_STUDENT_PROBE);
        setStudentProbe((prev) => ({ ...prev, status: 'off' }));
        setStudents([]);
        setStudentSelections({});
        setStudentLoaded(false);
        return;
      }
      const msg = err?.response?.data?.message || 'Failed to load students';
      setStudentError(msg);
      setStudents([]);
      setStudentSelections({});
      setStudentLoaded(false);
      if (import.meta.env.DEV) {
        console.error('Teacher student list load failed', { status: err?.response?.status, detail: err?.response?.data });
      }
    } finally {
      setStudentLoading(false);
    }
  }, []);

  const probeStudentAttendance = useCallback(async () => {
    setStudentProbe({ ...EMPTY_STUDENT_PROBE, status: 'loading' });
    try {
      const res = await attendanceService.getResponsibleClass();
      const data = res.data || {};
      if (data.responsibleClass) {
        setStudentProbe({
          status: 'on',
          responsibleClass: data.responsibleClass,
          academicYear: data.academicYear || '',
        });
        loadStudents(toLocalDateStr(new Date()));
      } else {
        // Setting ON but the teacher has no scheduled period yet.
        setStudentProbe({
          status: 'on',
          responsibleClass: null,
          academicYear: data.academicYear || '',
        });
      }
    } catch (err) {
      if (err?.response?.status === 403) {
        setStudentProbe({ ...EMPTY_STUDENT_PROBE, status: 'off' });
      } else {
        setStudentProbe({
          ...EMPTY_STUDENT_PROBE,
          status: 'error',
          reason: err?.response?.data?.message || 'Failed to check student attendance access',
        });
        if (import.meta.env.DEV) {
          console.error('Teacher student attendance probe failed', { status: err?.response?.status, detail: err?.response?.data });
        }
      }
    }
  }, [loadStudents]);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadOwnAttendance(), loadLeaveRequests(), probeStudentAttendance()]);
    setRefreshing(false);
  }, [loadOwnAttendance, loadLeaveRequests, probeStudentAttendance]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Close the per-student status dropdown when clicking elsewhere.
  useEffect(() => {
    const close = () => setOpenDropdownId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const teacher = attendanceData.teacher || {};
  const summary = attendanceData.summary || {};
  const todayInfo = attendanceData.today || null;
  const records = attendanceData.records || [];
  const academicYear = attendanceData.academicYear || '';

  const studentStats = useMemo(() => {
    const values = Object.values(studentSelections);
    const present = values.filter((v) => v.status === 'Present').length;
    const absent = values.filter((v) => v.status === 'Absent').length;
    const late = values.filter((v) => v.status === 'Late').length;
    const leave = values.filter((v) => v.status === 'Leave').length;
    return { present, absent, late, leave, total: students.length };
  }, [studentSelections, students.length]);

  const renderStatusBadge = (status) => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.Pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
        {status}
      </span>
    );
  };

  const updateStatus = (studentId, status) => {
    setStudentSelections((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const markAllPresent = () => {
    if (students.length === 0) return;
    setStudentSelections((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s._id] = { ...next[s._id], status: 'Present' };
      });
      return next;
    });
  };

  const changeClassDate = (e) => {
    const value = e.target.value;
    setStampDate(value);
    setStudents([]);
    setStudentSelections({});
    setStudentLoaded(false);
    setStudentError('');
    if (value) loadStudents(value);
  };

  const saveStudentAttendance = async () => {
    if (students.length === 0) return;
    setSaving(true);
    // Same statuses the existing Student Attendance module accepts. When Leave
    // marking is disabled in School Settings, Leave selections are skipped so
    // their existing records stay untouched and the rest of the class still saves.
    const records = students
      .filter((s) => !(studentSelections[s._id]?.status === 'Leave' && !allowLeave))
      .map((s) => ({
        student: s._id,
        status: studentSelections[s._id]?.status || 'Present',
        method: 'Manual',
      }));
    try {
      await attendanceService.saveStudentAttendance({ date: stampDate, records });
      toast.success('Student attendance saved successfully');
      await loadStudents(stampDate);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to save student attendance';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const submitLeave = async () => {
    const from = leaveForm.fromDate;
    const to = leaveForm.toDate;
    const reason = (leaveForm.reason || '').trim();
    if (!from || !to) {
      toast.error('Please provide both from and to dates');
      return;
    }
    if (to < from) {
      toast.error('To date cannot be before the from date');
      return;
    }
    if (reason.length < 3) {
      toast.error('Leave reason must be at least 3 characters');
      return;
    }
    setSubmittingLeave(true);
    try {
      await attendanceService.requestLeave({ fromDate: from, toDate: to, reason });
      toast.success('Leave request submitted successfully');
      setLeaveForm({ fromDate: TODAY, toDate: TODAY, reason: '' });
      await loadLeaveRequests();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to submit leave request');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const renderStudentStatusDropdown = (studentId, currentStatus) => (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpenDropdownId(openDropdownId === studentId ? null : studentId);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium transition-all hover:border-gray-300 dark:hover:border-gray-500 cursor-pointer ${STATUS_COLORS[currentStatus].text}`}
      >
        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[currentStatus].dot}`} />
        {currentStatus}
        <ChevronDownIcon className="h-3 w-3 text-gray-400 ml-0.5" />
      </button>
      {openDropdownId === studentId && (
        <div className="absolute right-0 mt-1.5 w-36 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 py-1 overflow-hidden">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateStatus(studentId, opt);
                setOpenDropdownId(null);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors ${STATUS_COLORS[opt].hover} ${
                currentStatus === opt ? STATUS_COLORS[opt].text : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[opt].dot} flex-shrink-0`} />
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const periodLabel = studentClass.period
    ? `${studentClass.period.slotLabel || 'Period'}${
        studentClass.period.startTime && studentClass.period.endTime
          ? ` · ${studentClass.period.startTime} – ${studentClass.period.endTime}`
          : ''
      }`
    : '';

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Attendance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Your attendance, leave requests and class attendance (when enabled by the administration).
        </p>
      </div>

      {/* Teacher + Academic Year + Refresh */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 max-w-full">
            <UserCircleIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate min-w-0">
              {teacher.fullName || EMPTY_DASH}
              {teacher.teacherId ? ` · ${teacher.teacherId}` : ''}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 max-w-full">
            <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate min-w-0">Academic Year: {academicYear || EMPTY_DASH}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={loadAll}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors disabled:opacity-60 sm:ml-auto cursor-pointer"
        >
          <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ───────────────────────── Own Attendance ───────────────────────── */}
      <CardSection title="My Attendance">
        {attendanceLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500 dark:text-gray-400">
            <Spinner size="lg" className="text-blue-600" />
            <p className="text-sm">Loading your attendance...</p>
          </div>
        ) : attendanceError ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <EmptyState icon={ExclamationCircleIcon} title="Something went wrong" description={attendanceError} />
            <button
              type="button"
              onClick={loadOwnAttendance}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard icon={CheckCircleIcon} label="Present" value={summary.present ?? 0} color="green" />
              <StatCard icon={XCircleIcon} label="Absent" value={summary.absent ?? 0} color="red" />
              <StatCard icon={ClockIcon} label="Late" value={summary.late ?? 0} color="blue" />
              <StatCard icon={CalendarDaysIcon} label="Leave" value={summary.leave ?? 0} color="yellow" />
              <StatCard icon={ClockIcon} label="Working Hours" value={summary.totalWorkingHours || '00:00'} color="blue" />
            </div>

            {/* Today — real current-day record or approved leave */}
            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-900/10 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
                    <CalendarDaysIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Today</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                      {todayInfo ? todayInfo.date : toLocalDateStr(new Date())}
                    </p>
                  </div>
                </div>
                {todayInfo ? (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                      <ClockIcon className="h-3.5 w-3.5" /> Check In: <strong>{todayInfo.checkIn || EMPTY_DASH}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                      <ClockIcon className="h-3.5 w-3.5" /> Check Out: <strong>{todayInfo.checkOut || EMPTY_DASH}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                      Working Hours: <strong>{todayInfo.workingHours || '00:00'}</strong>
                    </span>
                    {renderStatusBadge(todayInfo.status)}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">No attendance record yet today.</p>
                )}
              </div>
            </div>

            {/* Records — real attendance + approved-leave days */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Attendance Records</h4>
              {records.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-10 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <CalendarDaysIcon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No attendance records yet</p>
                </div>
              ) : (
                <div>
                  {/* Below `sm` the 7-column record log becomes one card per row so
                      it fits a 320px screen without a sideways scroll. From `sm`
                      up the original table is shown unchanged. */}
                  <ul className="space-y-3 sm:hidden">
                    {records.map((record, idx) => {
                      const remark =
                        record.status === 'Leave' && record.leaveReason
                          ? record.leaveReason
                          : record.remarks;
                      return (
                        <li
                          key={record.id || `leave-m-${idx}`}
                          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{record.date}</span>
                            {renderStatusBadge(record.status)}
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <div className="min-w-0">
                              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Check In</dt>
                              <dd className="mt-0.5 font-mono text-gray-700 dark:text-gray-300 break-words">{record.checkIn || EMPTY_DASH}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Check Out</dt>
                              <dd className="mt-0.5 font-mono text-gray-700 dark:text-gray-300 break-words">{record.checkOut || EMPTY_DASH}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Working Hours</dt>
                              <dd className="mt-0.5 font-mono text-gray-700 dark:text-gray-300 break-words">{record.workingHours || '00:00'}</dd>
                            </div>
                            <div className="min-w-0">
                              <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Method</dt>
                              <dd className="mt-0.5 text-gray-700 dark:text-gray-300 break-words">{record.method || EMPTY_DASH}</dd>
                            </div>
                            {remark && (
                              <div className="col-span-2 min-w-0">
                                <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Remarks</dt>
                                <dd className="mt-0.5 text-gray-500 dark:text-gray-400 break-words">{remark}</dd>
                              </div>
                            )}
                          </dl>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Method</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Check In</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Check Out</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Working Hours</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {records.map((record, idx) => (
                        <tr key={record.id || `leave-${idx}`} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">{record.date}</td>
                          <td className="px-4 py-3">{renderStatusBadge(record.status)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{record.method || EMPTY_DASH}</td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">{record.checkIn || EMPTY_DASH}</td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">{record.checkOut || EMPTY_DASH}</td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">{record.workingHours || '00:00'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-[220px]">
                            {record.status === 'Leave' && record.leaveReason ? (
                              <span className="truncate block" title={record.leaveReason}>{record.leaveReason}</span>
                            ) : record.remarks ? (
                              <span className="truncate block" title={record.remarks}>{record.remarks}</span>
                            ) : EMPTY_DASH}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardSection>

      {/* ───────────────────────── Leave Requests ───────────────────────── */}
      <CardSection title="Leave Requests">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New request form */}
          <div className="lg:col-span-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">New Request</h4>
            <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 p-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">From Date</label>
                <input
                  type="date"
                  value={leaveForm.fromDate}
                  max={TODAY}
                  onChange={(e) => setLeaveForm((prev) => ({ ...prev, fromDate: e.target.value }))}
                  disabled={submittingLeave}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">To Date</label>
                <input
                  type="date"
                  value={leaveForm.toDate}
                  max={TODAY}
                  onChange={(e) => setLeaveForm((prev) => ({ ...prev, toDate: e.target.value }))}
                  disabled={submittingLeave}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason</label>
                <textarea
                  rows={3}
                  value={leaveForm.reason}
                  maxLength={500}
                  onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
                  disabled={submittingLeave}
                  placeholder="Why are you applying for leave?"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={submitLeave}
                disabled={submittingLeave}
                className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {submittingLeave ? 'Submitting...' : 'Submit Leave Request'}
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Requests are submitted as Pending and approved/rejected by the administration.
              </p>
            </div>
          </div>

          {/* Request list */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">My Requests</h4>
            {leaveLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="md" className="text-blue-600" />
              </div>
            ) : leaveError ? (
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-700 dark:text-red-300">
                {leaveError}
              </div>
            ) : leaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-10 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                <ClipboardDocumentListIcon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No leave requests yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Use the form to submit your first request.</p>
              </div>
            ) : (
              <div>
                {/* Below `sm` each request is a card so dates, reason and status
                    never need a sideways scroll. From `sm` up the table is kept
                    exactly as before. */}
                <ul className="space-y-3 sm:hidden">
                  {leaves.map((leave) => {
                    const statusStyle = LEAVE_STATUS_STYLES[leave.status] || LEAVE_STATUS_STYLES.Pending;
                    return (
                      <li
                        key={`${leave.id}-m`}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                            {leave.fromDate} → {leave.toDate}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                            {leave.status}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 break-words">{leave.reason}</p>
                        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                          Requested {leave.createdAt ? new Date(leave.createdAt).toLocaleDateString() : EMPTY_DASH}
                        </p>
                      </li>
                    );
                  })}
                </ul>

                <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Dates</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Reason</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Requested</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {leaves.map((leave) => {
                      const statusStyle = LEAVE_STATUS_STYLES[leave.status] || LEAVE_STATUS_STYLES.Pending;
                      return (
                        <tr key={leave.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                          <td className="px-4 py-3 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {leave.fromDate} → {leave.toDate}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 max-w-[260px]">
                            <span className="truncate block" title={leave.reason}>{leave.reason}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle}`}>
                              {leave.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {leave.createdAt ? new Date(leave.createdAt).toLocaleDateString() : EMPTY_DASH}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardSection>

      {/* ─────────────────── Manual Student Attendance ─────────────────── */}
      {studentProbe.status === 'on' && (
        <CardSection title="Student Attendance">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            You can mark attendance only for the class of your first scheduled timetable period. The class is assigned
            automatically by the administration — you cannot select another class.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <UserGroupIcon className="h-3.5 w-3.5 shrink-0" />
                {studentClass.className || studentProbe.responsibleClass?.className || EMPTY_DASH}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
                {periodLabel || 'First period (derived from your timetable)'}
              </span>
              {studentProbe.responsibleClass?.subjectName && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                  {studentProbe.responsibleClass.subjectName}
                </span>
              )}
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Date</label>
              <input
                type="date"
                value={stampDate}
                max={TODAY}
                disabled={studentLoading}
                onChange={changeClassDate}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {studentProbe.responsibleClass === null ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-12">
              <CalendarDaysIcon className="h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No timetable period assigned yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">
                No scheduled period was found for you in this academic year. Once the administration creates your timetable
                entry, your attendance class will appear here automatically.
              </p>
            </div>
          ) : studentLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500 dark:text-gray-400">
              <Spinner size="lg" className="text-blue-600" />
              <p className="text-sm">Loading students...</p>
            </div>
          ) : studentError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <ExclamationCircleIcon className="h-6 w-6 text-gray-400" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{studentError}</p>
              <button
                type="button"
                onClick={() => loadStudents(stampDate)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Try Again
              </button>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-12">
              <UserGroupIcon className="h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No active students in this class</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">No active students were found for {studentClass.className || 'your timetable class'} in the current academic year.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selection summary + actions */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Present <strong className="text-green-600 dark:text-green-400">{studentStats.present}</strong> · Absent{' '}
                  <strong className="text-red-600 dark:text-red-400">{studentStats.absent}</strong> · Late{' '}
                  <strong className="text-blue-600 dark:text-blue-400">{studentStats.late}</strong> · Leave{' '}
                  <strong className="text-yellow-600 dark:text-yellow-400">{studentStats.leave}</strong>
                </span>
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <button
                    type="button"
                    onClick={markAllPresent}
                    disabled={studentLoading || saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3.5 py-2 text-xs font-semibold text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Mark All Present
                  </button>
                  <button
                    type="button"
                    onClick={saveStudentAttendance}
                    disabled={studentLoading || saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <PaperAirplaneIcon className="h-3.5 w-3.5" />
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </div>

              {/* Students table */}
              <div>
                {/* Below `sm` each student is a card: name and ID wrap/truncate
                    cleanly and the status control is no longer inside the
                    horizontal-scroll box (which used to clip its menu). From
                    `sm` up the original table is kept. */}
                <ul className="space-y-3 sm:hidden">
                  {students.map((student) => {
                    const record = studentSelections[student._id] || { status: 'Present' };
                    return (
                      <li
                        key={`${student._id}-m`}
                        className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/30 overflow-hidden flex-shrink-0">
                          {getImageUrl(student.studentImage) ? (
                            <img
                              src={getImageUrl(student.studentImage)}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span>{student.fullName?.charAt(0) || 'S'}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{student.fullName}</p>
                          <p className="mt-0.5 truncate font-mono text-xs text-gray-500 dark:text-gray-400">{student.studentId}</p>
                        </div>
                        {renderStudentStatusDropdown(student._id, record.status)}
                      </li>
                    );
                  })}
                </ul>

                <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-14">Photo</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Student Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Student ID</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {students.map((student) => {
                      const record = studentSelections[student._id] || { status: 'Present' };
                      return (
                        <tr key={student._id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/30 overflow-hidden">
                              {getImageUrl(student.studentImage) ? (
                                <img
                                  src={getImageUrl(student.studentImage)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span>{student.fullName?.charAt(0) || 'S'}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{student.fullName}</td>
                          <td className="px-4 py-3 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{student.studentId}</td>
                          <td className="px-4 py-3">{renderStudentStatusDropdown(student._id, record.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}
        </CardSection>
      )}

      {studentProbe.status === 'error' && (
        <CardSection title="Student Attendance">
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <ExclamationCircleIcon className="h-6 w-6 text-gray-400" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{studentProbe.reason}</p>
            <button
              type="button"
              onClick={probeStudentAttendance}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <ArrowPathIcon className="h-3.5 w-3.5" />
              Try Again
            </button>
          </div>
        </CardSection>
      )}
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

export default TeacherAttendance;