import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { CLASS_NAMES, ACADEMIC_YEARS } from '../../../utils/classNames';
import timetableService from '../../../services/timetable/timetable.service';
import { useTimetableYear } from '../../../contexts/TimetableContext';
import { useTranslation } from '../../../hooks/useLocalization';

const CLASS_GROUPS = [
  { page: 1, classes: CLASS_NAMES.slice(0, 4) },
  { page: 2, classes: CLASS_NAMES.slice(4, 9) },
  { page: 3, classes: CLASS_NAMES.slice(9) },
];

const resolveTeacherName = (t) => {
  if (!t) return '-';
  if (typeof t === 'object' && t.fullName) return t.fullName;
  if (typeof t === 'string') return t;
  return '-';
};

const AllClassesTimetable = () => {
  const { t } = useTranslation();
  const { selectedYear, setSelectedYear, refreshKey } = useTimetableYear();
  const [currentPage, setCurrentPage] = useState(0);
  const [allTimetables, setAllTimetables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState({});

  const totalPages = CLASS_GROUPS.length;
  const currentGroup = CLASS_GROUPS[currentPage];
  const classes = currentGroup?.classes || [];

  useEffect(() => {
    if (!selectedYear) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    timetableService.getAllTimetables()
      .then((res) => {
        const timetables = res?.data?.timetables || [];
        setAllTimetables(timetables);
      })
      .catch(() => toast.error(t('failedToLoad')))
      .finally(() => setLoading(false));
  }, [selectedYear, refreshKey]);

  useEffect(() => {
    if (allTimetables.length === 0) return;
    const map = {};
    allTimetables.forEach((tt) => {
      (tt.periods || []).forEach((p) => {
        if (p.subjectId && typeof p.subjectId === 'object') {
          map[p.subjectId._id?.toString()] = p.subjectId.subjectName;
        } else if (p.subjectId) {
          map[p.subjectId.toString()] = p.subjectId.toString();
        }
      });
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubjects(map);
  }, [allTimetables]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const getGroupTimetableMap = (groupIdx) => {
    const group = CLASS_GROUPS[groupIdx];
    const map = {};
    group.classes.forEach((cls) => { map[cls] = null; });

    const yearTts = allTimetables.filter((tt) => {
      const clsName = tt.classId?.className || '';
      return tt.academicYear === selectedYear && group.classes.includes(clsName);
    });

    yearTts.forEach((tt) => {
      const clsName = tt.classId?.className || '';
      map[clsName] = tt.periods || [];
    });

    return map;
  };

  const currentGroupMap = getGroupTimetableMap(currentPage);
  const hasData = Object.values(currentGroupMap).some((p) => p && p.length > 0);
  const maxPeriodRows = hasData
    ? Math.max(...Object.values(currentGroupMap).map((p) => (p ? p.length : 0)), 0)
    : 0;

  const getPeriodData = (className, idx) => {
    const periods = currentGroupMap[className];
    return periods?.[idx] || null;
  };

  const getTime = (idx) => {
    for (const cls of classes) {
      const p = getPeriodData(cls, idx);
      if (p?.startTime) return `${p.startTime} - ${p.endTime}`;
    }
    return `Period ${idx + 1}`;
  };

  const isBreak = (idx) => {
    for (const cls of classes) {
      const p = getPeriodData(cls, idx);
      if (p?.type === 'break') return true;
    }
    return false;
  };

  const renderTimetableGrid = () => {
    if (loading) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <CalendarDaysIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('loading')}</h3>
        </div>
      );
    }

    if (!hasData) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <CalendarDaysIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('noData')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {t('selectAcademicYear')}
          </p>
        </div>
      );
    }

    const rows = Array.from({ length: maxPeriodRows }, (_, i) => i);

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('academicYearLabel')}: <span className="font-semibold text-gray-700 dark:text-gray-200">{selectedYear}</span>
          </p>
          <div className="flex items-center gap-2">
            {CLASS_GROUPS.map((group, idx) => (
              <button
                key={group.page}
                onClick={() => handlePageChange(idx)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  currentPage === idx
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Group {group.page}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th
                  className="sticky top-0 z-30 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold px-4 py-3.5 text-left whitespace-nowrap min-w-[140px]"
                  style={{ left: 0 }}
                >
                  {t('startTime')}
                </th>
                {classes.map((cls) => (
                  <th
                    key={cls}
                    className="sticky top-0 z-20 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold px-4 py-3.5 text-center whitespace-nowrap min-w-[150px]"
                  >
                    {cls}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((rowIdx) => {
                const breakRow = isBreak(rowIdx);
                const trClass = breakRow
                  ? 'bg-amber-50 dark:bg-amber-900/10'
                  : 'bg-white dark:bg-gray-800/50 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors';

                if (breakRow) {
                  return (
                    <tr key={rowIdx} className={trClass}>
                      <td
                        className="sticky z-10 bg-amber-50 dark:bg-amber-900/10 px-4 py-3.5 text-xs font-semibold text-amber-700 dark:text-amber-300 whitespace-nowrap"
                        style={{ left: 0 }}
                      >
                        {getTime(rowIdx)}
                      </td>
                      <td
                        colSpan={classes.length}
                        className="px-4 py-3.5 text-center text-sm font-semibold text-amber-700 dark:text-amber-300"
                      >
                        {t('other')}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={rowIdx} className={trClass}>
                    <td
                      className="sticky z-10 bg-white dark:bg-gray-800 px-4 py-3.5 text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap"
                      style={{ left: 0 }}
                    >
                      {getTime(rowIdx)}
                    </td>
                    {classes.map((cls) => {
                      const p = getPeriodData(cls, rowIdx);
                      return (
                        <td key={cls} className="px-4 py-3 text-center">
                          {p && p.type === 'teaching' ? (
                            <>
                              <span className="block text-sm font-medium text-gray-900 dark:text-white">
                                {resolveTeacherName(p.teacherId) || '-'}
                              </span>
                              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {subjects[p.subjectId?._id?.toString()] || p.subjectId?.subjectName || '-'}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          {t('period')} — {currentPage + 1} / {totalPages}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="w-full sm:w-48">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
          {t('academicYearLabel')}
        </label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
        >
          <option value="">{t('selectYear')}</option>
          {ACADEMIC_YEARS.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {selectedYear ? renderTimetableGrid() : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <CalendarDaysIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('selectAcademicYear')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {t('selectAcademicYear')}
          </p>
        </div>
      )}
    </div>
  );
};

export default AllClassesTimetable;
