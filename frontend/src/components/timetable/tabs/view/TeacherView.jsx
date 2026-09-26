import { useState, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { UserIcon } from '@heroicons/react/24/outline';
import { ACADEMIC_YEARS } from '../../../../utils/classNames';
import TimetableFilters from './TimetableFilters';
import TimetableGrid from './TimetableGrid';
import TimetableEmptyState from './TimetableEmptyState';
import teacherService from '../../../../services/teacher/teacher.service';
import timetableService from '../../../../services/timetable/timetable.service';
import { useTimetableYear } from '../../../../contexts/TimetableContext';
import { useTranslation } from '../../../../hooks/useLocalization';

const TeacherView = () => {
  const { t } = useTranslation();
  const { selectedYear, setSelectedYear } = useTimetableYear();
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const teacherMap = useMemo(() => {
    const map = {};
    teachers.forEach((t) => { map[t.fullName] = t; });
    return map;
  }, [teachers]);

  useEffect(() => {
    teacherService.getAllTeachers()
      .then((res) => {
        const list = res?.data?.teachers || [];
        setTeachers(Array.isArray(list) ? list : []);
      })
      .catch(() => console.error('Failed to load teachers'))
      .finally(() => setLoadingTeachers(false));
  }, []);

  useEffect(() => {
    if (!selectedYear || !selectedTeacher) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSchedule(true);
    setSchedule([]);
    const teacherObj = teacherMap[selectedTeacher];
    const teacherId = teacherObj?._id;
    timetableService.getAllTimetables()
      .then((res) => {
        const allTts = res?.data?.timetables || [];
        const filtered = [];
        allTts.forEach((tt) => {
          if (tt.academicYear !== selectedYear) return;
          (tt.periods || []).forEach((p) => {
            const tId = p.teacherId?._id?.toString() || p.teacherId?.toString();
            if (teacherId && tId === teacherId.toString()) {
              filtered.push({
                id: p._id || p.id || `${tt._id}-${p.periodNo}`,
                startTime: p.startTime,
                endTime: p.endTime,
                subject: p.subjectId?.subjectName || p.subjectId || '-',
                className: tt.classId?.className || 'Unknown',
                type: 'Teaching',
              });
            }
          });
        });
        filtered.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        setSchedule(filtered);
      })
      .catch(() => toast.error(t('failedToLoad')))
      .finally(() => setLoadingSchedule(false));
  }, [selectedYear, selectedTeacher, teacherMap]);

  const handleFilterChange = useCallback((name, value) => {
    if (name === 'academicYear') setSelectedYear(value);
    if (name === 'teacher') setSelectedTeacher(value);
  }, [setSelectedYear]);

  const hasData = schedule.length > 0;
  const teacherOptions = teachers.map((t) => t.fullName);

  return (
    <div className="space-y-6">
      <TimetableFilters
        filters={[
          { name: 'academicYear', label: t('academicYearLabel'), value: selectedYear, options: ACADEMIC_YEARS, placeholder: t('selectYear') },
          { name: 'teacher', label: t('teacher'), value: selectedTeacher, options: teacherOptions, placeholder: loadingTeachers ? t('loading') : t('select') },
        ]}
        onFilterChange={handleFilterChange}
      />

      {loadingSchedule && (
        <TimetableEmptyState
          icon={UserIcon}
          title={t('loading')}
          description={t('noData')}
        />
      )}

      {!selectedYear && !loadingSchedule && (
        <TimetableEmptyState
          icon={UserIcon}
          title={t('selectAcademicYear')}
          description={t('selectAcademicYear')}
        />
      )}

      {selectedYear && !selectedTeacher && !loadingSchedule && (
        <TimetableEmptyState
          icon={UserIcon}
          title={t('select')}
          description={t('select')}
        />
      )}

      {selectedYear && selectedTeacher && !loadingSchedule && !hasData && (
        <TimetableEmptyState
          icon={UserIcon}
          title={t('noData')}
          description={`${t('noData')} ${selectedTeacher} (${selectedYear}).`}
        />
      )}

      {hasData && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                <UserIcon className="h-4 w-4 text-blue-500" />
                {selectedTeacher}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">{selectedYear}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{schedule.length} periods</span>
            </div>
          </div>

          <TimetableGrid periods={schedule} mode="teacher" />
        </>
      )}
    </div>
  );
};

export default TeacherView;
