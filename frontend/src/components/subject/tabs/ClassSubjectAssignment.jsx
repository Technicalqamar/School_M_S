import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from '../../../hooks/useLocalization';
import subjectService from '../../../services/subject/subject.service';
import { CLASS_NAMES } from '../../../utils/classNames';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';

const ClassSubjectAssignment = () => {
  const { t } = useTranslation();
  const { academic } = useSchoolConfig();
  const [selectedClass, setSelectedClass] = useState('');
  const [academicYear, setAcademicYear] = useState(() => academic?.currentYear || '');
  const [allSubjects, setAllSubjects] = useState([]);
  const [assignedIds, setAssignedIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [existingYears, setExistingYears] = useState([]);
  const defaultYearApplied = useRef(!!academic?.currentYear);

  const fetchSubjects = useCallback(async () => {
    setFetching(true);
    try {
      const result = await subjectService.getAllSubjects();
      setAllSubjects(result.data?.subjects || []);
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToLoad');
      toast.error(msg);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchSubjects());
  }, [fetchSubjects]);

  useEffect(() => {
    if (!defaultYearApplied.current && academic?.currentYear) {
      defaultYearApplied.current = true;
      setAcademicYear(academic.currentYear);
    }
  }, [academic?.currentYear]);

  useEffect(() => {
    Promise.resolve().then(() => {
      subjectService.getClassAssignmentYears()
        .then((res) => setExistingYears(res.data?.years || []))
        .catch(() => {});
    });
  }, []);

  const fetchAssignments = useCallback(async () => {
    if (selectedClass && /^\d{4}$/.test(academicYear || '')) {
      setLoading(true);
      try {
        const result = await subjectService.getClassAssignments(selectedClass, academicYear);
        const assigned = result.data?.assignedSubjects || [];
        const ids = assigned.map((s) => s._id);
        setAssignedIds(ids);
        setSelectedIds([...ids]);
      } catch (err) {
        const msg = err.response?.data?.message || t('failedToLoad');
        toast.error(msg);
        setAssignedIds([]);
        setSelectedIds([]);
      } finally {
        setLoading(false);
      }
    } else {
      setAssignedIds([]);
      setSelectedIds([]);
    }
  }, [selectedClass, academicYear]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchAssignments();
    });
  }, [fetchAssignments]);

  const handleToggle = (subjectId) => {
    setSelectedIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId],
    );
  };

  const handleUpdate = async () => {
    if (!selectedClass || !academicYear) return;

    setAssigning(true);
    try {
      await subjectService.assignSubjectsToClass(selectedClass, academicYear, selectedIds);
      toast.success(t('updatedSuccessfully'));
      await Promise.all([fetchSubjects(), fetchAssignments()]);
    } catch (err) {
      const msg = err.response?.data?.message || t('failedToSave');
      toast.error(msg);
    } finally {
      setAssigning(false);
    }
  };

  const handleReset = () => {
    setSelectedIds([...assignedIds]);
  };

  const hasChanges = (() => {
    if (selectedIds.length !== assignedIds.length) return true;
    const assignedSet = new Set(assignedIds);
    return selectedIds.some((id) => !assignedSet.has(id));
  })();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('classSubjectAssignment')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('selectClass')}
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="">{t('selectClass')}</option>
              {CLASS_NAMES.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('academicYearLabel')}
            </label>
            <input
              type="text"
              list="classSubjectAssignmentYears"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder={t('enterAcademicYear')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <datalist id="classSubjectAssignmentYears">
              {existingYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </datalist>
          </div>

          {selectedClass && academicYear && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('classLabel')}: <span className="font-medium text-gray-700 dark:text-gray-200">{selectedClass}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('academicYearLabel')}: <span className="font-medium text-gray-700 dark:text-gray-200">{academicYear}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {`${t('subject')}s ${t('assigned').toLowerCase()}`}: <span className="font-medium text-gray-700 dark:text-gray-200">{selectedIds.length}</span>
              </p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {!selectedClass || !academicYear ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 flex flex-col items-center justify-center text-center">
              <svg className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('selectClass')}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('noData')}</p>
            </div>
          ) : fetching || loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('loadingSubjects')}</p>
            </div>
          ) : allSubjects.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-10 text-center">
              <svg className="h-10 w-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('noSubjects')}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                {`${t('subject')}s ${t('of')} ${selectedClass} (${academicYear})`}
              </h3>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {allSubjects.map((subject) => {
                  const isAssigned = assignedIds.includes(subject._id);
                  const isSelected = selectedIds.includes(subject._id);

                  return (
                    <div
                      key={subject._id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-green-50 dark:bg-green-900/10'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(subject._id)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className={`text-sm ${isSelected ? 'text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                        {subject.subjectName}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{subject.subjectCode}</span>
                      {isAssigned ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          {t('assigned')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          {t('unassigned')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pt-5 mt-5 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={handleUpdate}
                  disabled={assigning || !hasChanges}
                  className="px-6 py-2.5 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigning ? t('saving') : t('update')}
                </button>
                <button
                  onClick={handleReset}
                  disabled={assigning || !hasChanges}
                  className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('reset')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassSubjectAssignment;
