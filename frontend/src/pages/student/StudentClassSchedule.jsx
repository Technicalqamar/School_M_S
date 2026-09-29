import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDaysIcon,
  AcademicCapIcon,
  UserIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import Spinner from '../../components/common/Spinner/Spinner';
import studentClassScheduleService from '../../services/student/studentClassSchedule.service';
import { useTranslation } from '../../hooks/useLocalization';

const EMPTY_DASH = '—';

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-14">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <CalendarDaysIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

/**
 * Student Class Schedule — READ-ONLY.
 *
 * The logged-in student's class and academic year always come from the
 * authenticated session. The page only displays the real timetable returned by
 * the protected Class Schedule API (Step 2); it offers no class/subject/teacher
 * selectors and no create/edit/delete controls.
 */
const StudentClassSchedule = () => {
  const { t } = useTranslation();

  const [data, setData] = useState({ student: null, classInfo: null, academicYear: '', timetable: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSchedule = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await studentClassScheduleService.getClassSchedule();
      setData(result);
    } catch (err) {
      // Surface the real backend error when available (mirrors the existing
      // student Fees module convention) so genuine failures — expired sessions,
      // deactivated profiles, server errors, missing routes — are visible
      // instead of being hidden behind a generic message.
      const message = err?.response?.data?.message || t('scheduleLoadError');
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
  }, [t]);

  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    loadSchedule();
  };

  const className = data.classInfo?.className || data.student?.className || EMPTY_DASH;
  const academicYear = data.academicYear || data.classInfo?.academicYear || data.student?.academicYear || EMPTY_DASH;
  const rows = data.timetable;

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{t('classSchedule')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('classScheduleSubtitle')}</p>
      </div>

      {/* Class + Academic Year + Refresh */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 max-w-full">
            <AcademicCapIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate min-w-0">
              {t('class')}: {className}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 border border-gray-200 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 max-w-full">
            <CalendarDaysIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate min-w-0">
              {t('academicYear')}: {academicYear}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={retry}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors disabled:opacity-60 sm:ml-auto"
        >
          <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
          <Spinner size="lg" className="text-blue-600" />
          <p className="text-sm">{t('loadingData')}</p>
        </div>
      )}

      {/* Load error */}
      {!isLoading && error && (
        <CardSection>
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <EmptyState title={t('somethingWentWrong')} description={error} />
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              {t('tryAgain')}
            </button>
          </div>
        </CardSection>
      )}

      {/* Empty — no real timetable records for this class */}
      {!isLoading && !error && rows.length === 0 && (
        <CardSection>
          <EmptyState title={t('noClassScheduleTitle')} description={t('noClassScheduleDescription')} />
        </CardSection>
      )}

      {/* Schedule table */}
      {!isLoading && !error && rows.length > 0 && (
        <CardSection>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/40">
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('time')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('subject')}
                  </th>
                  <th scope="col" className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t('teacher')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.isBreak
                        ? 'bg-amber-50/70 dark:bg-amber-900/10'
                        : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }
                  >
                    {/* Time */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                        {row.startTime} – {row.endTime}
                      </p>
                      {row.slotLabel && (
                        <p className="mt-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">{row.slotLabel}</p>
                      )}
                    </td>

                    {/* Subject (Break rows show the break clearly) */}
                    <td className="px-5 py-3.5">
                      {row.isBreak ? (
                        <span className="inline-flex items-center rounded-full border border-amber-200 dark:border-amber-800 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          {t('break')}
                        </span>
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

                    {/* Teacher */}
                    <td className="px-5 py-3.5">
                      {row.isScheduled && !row.isBreak ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <UserIcon className="h-4 w-4 text-gray-400 shrink-0" />
                          <p className="text-sm text-gray-700 dark:text-gray-200 break-words">
                            {row.teacherFullName || EMPTY_DASH}
                          </p>
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

export default StudentClassSchedule;