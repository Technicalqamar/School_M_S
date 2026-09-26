import { useState, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { CalendarDaysIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { CLASS_NAMES, ACADEMIC_YEARS } from '../../../../utils/classNames';
import TimetableFilters from './TimetableFilters';
import TimetableGrid from './TimetableGrid';
import TimetableEmptyState from './TimetableEmptyState';
import TimetableEditorModal from './TimetableEditorModal';
import ConfirmationModal from '../../../common/ConfirmationModal/ConfirmationModal';
import classService from '../../../../services/class/class.service';
import timetableService from '../../../../services/timetable/timetable.service';
import { useTimetableYear } from '../../../../contexts/TimetableContext';
import { useTranslation } from '../../../../hooks/useLocalization';

const ClassView = () => {
  const { t } = useTranslation();
  const { selectedYear, setSelectedYear, refreshKey, triggerTimetableRefresh } = useTimetableYear();
  const [className, setClassName] = useState('');
  const [timetableData, setTimetableData] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [classes, setClasses] = useState([]);
  const [subjectNames, setSubjectNames] = useState({});
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const classMap = useMemo(() => {
    const map = {};
    classes.forEach((c) => { map[c.className] = c._id; });
    return map;
  }, [classes]);

  useEffect(() => {
    classService.getAllClasses()
      .then((res) => {
        if (res?.data?.classes) setClasses(res.data.classes);
      })
      .catch(() => console.error('Failed to load classes'));
  }, []);

  const loadSubjectNames = useCallback(async (classId) => {
    try {
      const res = await timetableService.getClassSubjects(classId);
      if (res?.data?.subjects) {
        const map = {};
        res.data.subjects.forEach((s) => { map[s.id] = s.name; });
        setSubjectNames(map);
      }
    } catch { console.error('Failed to load subject names'); }
  }, []);

  useEffect(() => {
    if (!selectedYear || !className) return;
    const classId = classMap[className];
    if (!classId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setTimetableData(null);
    timetableService.getTimetableByClass(classId)
      .then((res) => {
        const timetables = res?.data?.timetables || [];
        const match = timetables.find((t) => t.academicYear === selectedYear);
        if (match) {
          setTimetableData(match);
          loadSubjectNames(classId);
        } else {
          setTimetableData(null);
        }
      })
      .catch(() => {
        toast.error(t('failedToLoad'));
        setTimetableData(null);
      })
      .finally(() => setLoading(false));
  }, [selectedYear, className, classMap, loadSubjectNames, refreshKey]);

  const handleFilterChange = useCallback((name, value) => {
    if (name === 'academicYear') setSelectedYear(value);
    if (name === 'className') setClassName(value);
  }, [setSelectedYear]);

  const handleEditSave = useCallback(async (updatedPeriods) => {
    if (!timetableData?._id) return;
    try {
      toast.dismiss();
      const payload = {
        periods: updatedPeriods.map((p) => ({
          periodNo: p.periodNum,
          type: p.type === 'Break' ? 'break' : 'teaching',
          startTime: p.startTime,
          endTime: p.endTime,
          teacherId: p.type === 'Teaching' ? p.teacher : null,
          subjectId: p.type === 'Teaching' ? p.subject : null,
        })),
        periodStartTime: timetableData.periodStartTime || '',
        periodEndTime: timetableData.periodEndTime || '',
      };
      const res = await timetableService.updateTimetable(timetableData._id, payload);
      const updated = res?.data?.timetable;
      const serverWarnings = res?.warnings || [];
      if (updated) {
        setTimetableData(updated);
        const classId = classMap[className];
        if (classId) loadSubjectNames(classId);
      }
      setShowEditor(false);
      triggerTimetableRefresh();
      toast.success(t('updatedSuccessfully'));
      if (serverWarnings.length > 0) {
        toast(
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ {t('warning')}</div>
            {serverWarnings.map((w, i) => (
              <div key={i} style={{ marginLeft: 8 }}>• {w}</div>
            ))}
          </div>
        );
      }
    } catch (err) {
      const serverMsg = err?.response?.data?.message;
      const serverErrors = err?.response?.data?.errors;
      if (serverErrors && Array.isArray(serverErrors) && serverErrors.length > 0) {
        serverErrors.forEach((e) => toast.error(e.message || e));
      } else if (serverMsg) {
        toast.error(serverMsg);
      } else {
        toast.error(t('failedToSave'));
      }
    }
  }, [timetableData, className, classMap, loadSubjectNames, triggerTimetableRefresh]);

  const handleDelete = useCallback(async () => {
    if (!timetableData?._id) return;
    setDeleting(true);
    try {
      await timetableService.deleteTimetable(timetableData._id);
      setTimetableData(null);
      setShowDelete(false);
      triggerTimetableRefresh();
      toast.success(t('deletedSuccessfully'));
    } catch (err) {
      toast.error(err?.response?.data?.message || t('failedToDelete'));
    } finally {
      setDeleting(false);
    }
  }, [timetableData, triggerTimetableRefresh]);

  const resolveSubjectName = (subjectId) => {
    if (!subjectId) return '-';
    if (typeof subjectId === 'object' && subjectId.subjectName) return subjectId.subjectName;
    return subjectNames[subjectId] || subjectId || '-';
  };
  const resolveTeacherName = (teacherId) => (teacherId?.fullName) || (typeof teacherId === 'string' ? teacherId : '-');

  const hasTimetable = timetableData && timetableData.periods?.length > 0;

  const displayPeriods = timetableData?.periods?.map((p) => ({
    ...p,
    subject: resolveSubjectName(p.subjectId),
    teacher: resolveTeacherName(p.teacherId),
    type: p.type === 'teaching' ? 'Teaching' : 'Break',
  })) || [];

  return (
    <div className="space-y-6">
      <TimetableFilters
        filters={[
          { name: 'academicYear', label: t('academicYearLabel'), value: selectedYear, options: ACADEMIC_YEARS, placeholder: t('selectYear') },
          { name: 'className', label: t('classLabel'), value: className, options: CLASS_NAMES, placeholder: t('selectClass') },
        ]}
        onFilterChange={handleFilterChange}
      />

      {loading && (
        <TimetableEmptyState
          icon={CalendarDaysIcon}
          title={t('loading')}
          description={t('noData')}
        />
      )}

      {!selectedYear && !loading && (
        <TimetableEmptyState
          icon={CalendarDaysIcon}
          title={t('selectAcademicYear')}
          description={t('selectAcademicYearAndClass')}
        />
      )}

      {selectedYear && !className && !loading && (
        <TimetableEmptyState
          icon={CalendarDaysIcon}
          title={t('selectClass')}
          description={t('selectClass')}
        />
      )}

      {selectedYear && className && !loading && !hasTimetable && (
        <TimetableEmptyState
          icon={CalendarDaysIcon}
          title={t('noData')}
          description={`${t('noData')} ${className} (${selectedYear}).`}
        />
      )}

      {hasTimetable && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                <BookOpenIcon className="h-4 w-4 text-blue-500" />
                {className}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">{selectedYear}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{timetableData.periods?.length || 0} periods</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEditor(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                {t('edit')}
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                {t('delete')}
              </button>
            </div>
          </div>

          <TimetableGrid periods={displayPeriods} mode="class" />
        </>
      )}

      {showEditor && timetableData && (
        <TimetableEditorModal
          timetableData={{ ...timetableData, className, academicYear: selectedYear }}
          onSave={handleEditSave}
          onClose={() => setShowEditor(false)}
          onRefresh={triggerTimetableRefresh}
        />
      )}

      <ConfirmationModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        title={t('delete')}
        message={t('confirmDelete')}
        confirmLabel={deleting ? t('saving') : t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
};

export default ClassView;
