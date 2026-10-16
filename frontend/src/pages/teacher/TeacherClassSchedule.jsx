import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  CalendarDaysIcon,
  ArrowPathIcon,
  UserCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

import CardSection from '../../components/common/CardSection/CardSection';
import Spinner from '../../components/common/Spinner/Spinner';
import classScheduleService from '../../services/teacher/classSchedule.service';

const EMPTY_DASH = '—';

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-12">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

/**
 * Teacher Class Schedule — READ-ONLY.
 *
 * The logged-in teacher and the Academic Year always come from the
 * authenticated session / central school configuration via the backend.
 *
 * The Admin Timetable is a single reusable daily grid — there is NO
 * Monday–Sunday axis stored anywhere. This page therefore renders ONE simple
 * timetable list: each row is one of the teacher's real saved periods (Time
 * Slot, Start/End Time, Class, Subject), shown exactly once in chronological
 * order. No weekdays are generated or assumed, and the same record is never
 * repeated. The page offers no teacher/class/subject selectors and no
 * create/edit/delete controls.
 */
const TeacherClassSchedule = () => {
  const [data, setData] = useState({
    teacher: { id: '', teacherId: '', fullName: '' },
    academicYear: '',
    rows: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await classScheduleService.getClassSchedule();
      setData(result);
    } catch (err) {
      // Surface the real backend error when available (mirrors the existing
      // teacher My Classes / student Fees conventions) so genuine failures —
      // expired sessions, deactivated profiles, server errors — are visible
      // instead of being hidden behind a generic message.
      const message = err?.response?.data?.message || 'Failed to load your class schedule';
      setError(message);
      toast.error(message);
      if (import.meta.env.DEV) {
        console.error('Class schedule load failed', {
          status: err?.response?.status,
          detail: err?.response?.data,
          error: err,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const teacher = data.teacher || { id: '', teacherId: '', fullName: '' };
  const academicYear = data.academicYear;
  const rows = data.rows || [];
  const hasSchedule = rows.length > 0;

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Class Schedule</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Your weekly timetable with class, subject and break timings.
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
          onClick={loadSchedule}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors disabled:opacity-60 sm:ml-auto"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
          <Spinner size="lg" className="text-blue-600" />
          <p className="text-sm">Loading your class schedule...</p>
        </div>
      )}

      {/* Load error */}
      {!isLoading && error && (
        <CardSection>
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <EmptyState
              icon={ExclamationCircleIcon}
              title="Something went wrong"
              description={error + '. Please try again.'}
            />
            <button
              type="button"
              onClick={loadSchedule}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </CardSection>
      )}

      {/* Empty — no real timetable records for this teacher in the current year */}
      {!isLoading && !error && !hasSchedule && (
        <CardSection>
          <EmptyState
            icon={CalendarDaysIcon}
            title="No schedule available"
            description="You have no timetable periods assigned yet. Once the admin creates timetable entries for you, they will appear here for the current academic year."
          />
        </CardSection>
      )}

      {/* Schedule — one simple timetable list of the teacher's real periods */}
      {!isLoading && !error && hasSchedule && (
        <CardSection title="Your Timetable">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/40">
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-1/4">
                    Period
                  </th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-1/4">
                    Time
                  </th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-1/4">
                    Class
                  </th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-1/4">
                    Subject
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr
                    key={row.id || row.entryId}
                    className={
                      row.isBreak
                        ? 'bg-amber-50/70 dark:bg-amber-900/10'
                        : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }
                  >
                    {/* Period — real Time Slot label, shown once per saved entry */}
                    <td className="px-5 py-3.5">
                      {row.isBreak ? (
                        <span className="inline-flex items-center rounded-full border border-amber-200 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          {row.slotLabel ? `${row.slotLabel} — Break` : 'Break'}
                        </span>
                      ) : (
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{row.slotLabel || EMPTY_DASH}</p>
                      )}
                    </td>

                    {/* Time — start → end from the real Time Slot */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {row.startTime && row.endTime ? `${row.startTime} – ${row.endTime}` : EMPTY_DASH}
                      </p>
                    </td>

                    {/* Class */}
                    <td className="px-5 py-3.5">
                      {row.isScheduled ? (
                        <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                          {row.className || EMPTY_DASH}
                        </span>
                      ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500">{EMPTY_DASH}</p>
                      )}
                    </td>

                    {/* Subject (breaks carry none) */}
                    <td className="px-5 py-3.5">
                      {row.isBreak ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">{EMPTY_DASH}</p>
                      ) : row.isScheduled ? (
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 break-words">
                            {row.subjectName || EMPTY_DASH}
                          </p>
                          {row.subjectCode && (
                            <p className="mt-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                              {row.subjectCode}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500">{EMPTY_DASH}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardSection>
      )}
    </div>
  );
};

export default TeacherClassSchedule;