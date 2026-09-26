import { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { TrashIcon } from '@heroicons/react/24/outline';
import Modal from '../../../common/Modal/Modal';
import ConfirmationModal from '../../../common/ConfirmationModal/ConfirmationModal';
import { TYPE_OPTIONS, validatePeriods, isTimetableFormValid, getFirstError, hasOverlapError } from '../../../../utils/timetableValidation';
import { useTranslation } from '../../../../hooks/useLocalization';
import classService from '../../../../services/class/class.service';
import timetableService from '../../../../services/timetable/timetable.service';

const labelCls = 'block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5';
const fieldBase = 'w-full px-2 py-1.5 rounded-md border text-xs transition-all bg-white dark:bg-gray-800 focus:outline-none focus:ring-2';
const fieldNormal = `${fieldBase} border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:ring-blue-500/20 focus:border-blue-500`;
const fieldError = `${fieldBase} border-red-400 dark:border-red-500 text-gray-700 dark:text-gray-200 focus:ring-red-500/20 focus:border-red-500`;
const fieldReadonly = `${fieldBase} border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed`;
const selectBase = 'appearance-none w-full px-2 py-1.5 rounded-md border text-xs transition-all bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 cursor-pointer';
const selectNormal = `${selectBase} border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:ring-blue-500/20 focus:border-blue-500`;
const selectError = `${selectBase} border-red-400 dark:border-red-500 text-gray-700 dark:text-gray-200 focus:ring-red-500/20 focus:border-red-500`;
const selectDisabled = `${selectBase} border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-900 cursor-not-allowed`;
const errTextCls = 'text-[9px] text-red-500 dark:text-red-400 mt-0.5';

const getFieldCls = (errs, field) => {
  if (!errs) return fieldNormal;
  if (errs[field]) return fieldError;
  return fieldNormal;
};

const getSelectCls = (errs, field, disabled) => {
  if (disabled) return selectDisabled;
  if (errs && errs[field]) return selectError;
  return selectNormal;
};

const mapPeriodToPayload = (p) => ({
  periodNo: p.periodNum,
  type: p.type === 'Break' ? 'break' : 'teaching',
  startTime: p.startTime,
  endTime: p.endTime,
  teacherId: p.type === 'Teaching' ? p.teacher : null,
  subjectId: p.type === 'Teaching' ? p.subject : null,
});

const TimetableEditorModal = ({ timetableData, onSave, onClose, onRefresh }) => {
  const { t } = useTranslation();
  const timetableId = timetableData._id;
  const classId = timetableData.classId?._id || timetableData.classId;

  const [periods, setPeriods] = useState(() =>
    (timetableData.periods || []).map((p, i) => ({
      id: p._id || (Date.now() + i),
      periodNum: p.periodNo || (i + 1),
      type: p.type === 'break' ? 'Break' : 'Teaching',
      startTime: p.startTime || '',
      endTime: p.endTime || '',
      teacher: p.teacherId?._id || p.teacherId || '',
      subject: p.subjectId?._id || p.subjectId || '',
    }))
  );

  const [assignmentData, setAssignmentData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // Class Management is the source of truth for valid Class + Subject + Teacher combos.
  useEffect(() => {
    if (!classId) return;
    classService.getClassTeacherAssignments(classId)
      .then((res) => {
        if (res?.data?.data) setAssignmentData(res.data.data);
      })
      .catch(() => toast.error(t('failedToLoad')));
  }, [classId]);

  const subjectOptions = useMemo(() =>
    (assignmentData?.classSubjects || []).map((s) => ({ id: String(s._id), name: s.subjectName || String(s._id) })),
  [assignmentData]);

  const availableTeachers = useMemo(() => {
    const map = {};
    (assignmentData?.teacherAssignments || []).forEach(({ teacher, subjects }) => {
      const tid = String(teacher?._id);
      if (!tid) return;
      const tname = teacher?.fullName || tid;
      (subjects || []).forEach((s) => {
        const sid = String(s._id);
        if (!map[sid]) map[sid] = [];
        if (!map[sid].some((x) => x.id === tid)) map[sid].push({ id: tid, name: tname });
      });
    });
    return map;
  }, [assignmentData]);

  const updatePeriod = useCallback((id, field, value) => {
    setPeriods((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (field === 'type' && value === 'Break') return { ...p, type: 'Break', teacher: '', subject: '' };
        if (field === 'type' && value === 'Teaching') return { ...p, type: 'Teaching' };
        if (field === 'subject' && value !== p.subject) {
          return { ...p, subject: value, teacher: '' };
        }
        return { ...p, [field]: value };
      })
    );
  }, []);

  const handleDeleteClick = useCallback((id, periodNum) => {
    setDeleteConfirmTarget({ id, periodNum });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirmTarget || !timetableId) return;
    const { id } = deleteConfirmTarget;
    const filtered = periods.filter((p) => p.id !== id);
    filtered.forEach((p, i) => { p.periodNum = i + 1; });
    setSaving(true);
    try {
      await timetableService.updateTimetable(timetableId, {
        periods: filtered.map(mapPeriodToPayload),
        periodStartTime: timetableData.periodStartTime || '',
        periodEndTime: timetableData.periodEndTime || '',
      });
      setPeriods(filtered);
      setDeleteConfirmTarget(null);
      if (onRefresh) onRefresh();
      toast.success(t('deletedSuccessfully'));
    } catch (err) {
      const serverMsg = err?.response?.data?.message || t('failedToDelete');
      toast.error(serverMsg);
    } finally {
      setSaving(false);
    }
  }, [deleteConfirmTarget, periods, timetableId, timetableData.periodStartTime, timetableData.periodEndTime]);

  const fieldErrors = useMemo(() => validatePeriods(periods, timetableData.periodStartTime, timetableData.periodEndTime), [periods, timetableData.periodStartTime, timetableData.periodEndTime]);
  const isFormValid = useMemo(() => isTimetableFormValid('x', 'x', periods, fieldErrors), [periods, fieldErrors]);
  const overlap = useMemo(() => hasOverlapError(fieldErrors), [fieldErrors]);

  const handleSave = useCallback(async () => {
    if (periods.length === 0) {
      toast.error(t('noData'));
      return;
    }
    if (Object.keys(fieldErrors).length > 0) {
      const msg = getFirstError(fieldErrors);
      if (msg) toast.error(msg);
      return;
    }
    const invalidCombo = periods.some((p) => {
      if (p.type !== 'Teaching' || !p.subject || !p.teacher) return false;
      return !(availableTeachers[p.subject] || []).some((x) => String(x.id) === String(p.teacher));
    });
    if (invalidCombo) {
      toast.error('Selected teacher is not assigned to teach this subject in this class.');
      return;
    }
    setSaving(true);
    try {
      await onSave(periods);
    } finally {
      setSaving(false);
    }
  }, [periods, fieldErrors, availableTeachers, onSave]);

  const displayName = timetableData.className || (timetableData.classId?.className) || '';

  return (
    <Modal isOpen={true} onClose={onClose} title={`${t('edit')} — ${displayName}`} maxWidth="max-w-5xl">
      <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
        {periods.map((period) => {
          const isBreak = period.type === 'Break';
          const errs = fieldErrors[period.id];
          const hasTimeErr = errs && (errs.startTime || errs.endTime || errs.timeOverlap);
          const periodTeachers = availableTeachers[period.subject] || [];
          const teacherDisabled = isBreak || !period.subject || periodTeachers.length === 0;

          return (
            <div
              key={period.id}
              className={`flex flex-wrap items-start gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                isBreak
                  ? 'border-l-4 border-l-amber-400 border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
                  : 'border-l-4 border-l-blue-400 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60'
              } ${hasTimeErr ? 'border-l-red-400' : ''}`}
            >
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 w-5 flex-shrink-0 pt-3.5">{period.periodNum}.</span>

              <div className="min-w-[70px] flex-1">
                <label className={labelCls}>{t('period')}</label>
                <input type="text" value={`${t('period')} ${period.periodNum}`} readOnly className={fieldReadonly} />
              </div>

              <div className="min-w-[70px] flex-1">
                <label className={labelCls}>{t('type')}</label>
                <select value={period.type} onChange={(e) => updatePeriod(period.id, 'type', e.target.value)} className={selectNormal}>
                  {TYPE_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>

              <div className="min-w-[80px] flex-1">
                <label className={labelCls}>{t('startTime')}</label>
                <input type="time" value={period.startTime} onChange={(e) => updatePeriod(period.id, 'startTime', e.target.value)} className={`${getFieldCls(errs, 'startTime')} [color-scheme:light] dark:[color-scheme:dark]`} />
                {errs?.startTime && <p className={errTextCls}>{errs.startTime}</p>}
              </div>

              <div className="min-w-[80px] flex-1">
                <label className={labelCls}>{t('endTime')}</label>
                <input type="time" value={period.endTime} onChange={(e) => updatePeriod(period.id, 'endTime', e.target.value)} className={`${getFieldCls(errs, 'endTime')} [color-scheme:light] dark:[color-scheme:dark]`} />
                {errs?.timeOverlap && <p className={errTextCls}>{errs.timeOverlap}</p>}
                {errs?.endTime && !errs?.timeOverlap && <p className={errTextCls}>{errs.endTime}</p>}
              </div>

              {isBreak ? (
                <div className="min-w-[100px] flex-1">
                  <label className={labelCls}>{t('category')}</label>
                  <input type="text" value={period.breakName || ''} onChange={(e) => updatePeriod(period.id, 'breakName', e.target.value)} placeholder="e.g. Lunch Break" className={fieldNormal} />
                </div>
              ) : (
                <>
                  <div className="min-w-[90px] flex-1">
                    <label className={labelCls}>{t('teacher')}</label>
                    <select
                      value={period.teacher}
                      onChange={(e) => updatePeriod(period.id, 'teacher', e.target.value)}
                      disabled={teacherDisabled}
                      className={getSelectCls(errs, 'teacher', teacherDisabled)}
                    >
                      <option value="" disabled>
                        {!period.subject ? t('select') : periodTeachers.length === 0 ? t('noData') : t('select')}
                      </option>
                      {periodTeachers.map((tm) => (
                        <option key={tm.id} value={tm.id}>{tm.name}</option>
                      ))}
                    </select>
                    {errs?.teacher && <p className={errTextCls}>{errs.teacher}</p>}
                  </div>
                  <div className="min-w-[90px] flex-1">
                    <label className={labelCls}>{t('subject')}</label>
                    <select
                      value={period.subject}
                      onChange={(e) => updatePeriod(period.id, 'subject', e.target.value)}
                      disabled={isBreak}
                      className={getSelectCls(errs, 'subject', isBreak)}
                    >
                      <option value="" disabled>{t('select')}</option>
                      {subjectOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {period.subject && periodTeachers.length === 0 && (
                      <p className={errTextCls}>No teacher is assigned for this subject in this class.</p>
                    )}
                    {errs?.subject && <p className={errTextCls}>{errs.subject}</p>}
                  </div>
                </>
              )}

              <button
                onClick={() => handleDeleteClick(period.id, period.periodNum)}
                disabled={saving}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors self-start mt-3.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                title={t('delete')}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {periods.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">{t('noData')}</p>
        )}

        {overlap && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800/50">
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{t('error')}</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
        >
          {t('cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!isFormValid || periods.length === 0 || saving}
          className="px-4 py-2 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>

      <ConfirmationModal
        isOpen={deleteConfirmTarget !== null}
        onClose={() => setDeleteConfirmTarget(null)}
        title={t('delete')}
        message={t('confirmDelete')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        variant="danger"
        onConfirm={confirmDelete}
      />
    </Modal>
  );
};

export default TimetableEditorModal;
