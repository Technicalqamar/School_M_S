import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import CardSection from '../../common/CardSection/CardSection';
import SelectInput from '../../common/SelectInput/SelectInput';
import { ACADEMIC_YEARS } from '../../../utils/classNames';
import classService from '../../../services/class/class.service';
import teacherService from '../../../services/teacher/teacher.service';
import subjectService from '../../../services/subject/subject.service';
import timetableService from '../../../services/timetable/timetable.service';
import { useTimetableYear } from '../../../contexts/TimetableContext';
import { useTranslation } from '../../../hooks/useLocalization';

const GROUPS = {
  1: { name: 'Group 1', classes: ['Montessori', 'Nursery', 'KG 1', 'KG 2'] },
  2: { name: 'Group 2', classes: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'] },
  3: { name: 'Group 3', classes: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'] },
};

const DRAFT_KEY = (year, group) => `timetable-draft-${year}-${group}`;

const buildCells = (classes) => {
  const cells = {};
  classes.forEach((name) => { cells[name] = { teacher: '', subject: '' }; });
  return cells;
};

const timeToMinutes = (t) => {
  if (!t) return -1;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const validatePeriod = (period, ttlStart, ttlEnd, tr) => {
  const errors = {};

  if (period.startTime && period.endTime) {
    const endMins = timeToMinutes(period.endTime);
    const startMins = timeToMinutes(period.startTime);

    if (endMins <= startMins) {
      errors.endTime = tr('endDateAfterStart');
    } else if (ttlEnd && endMins > timeToMinutes(ttlEnd)) {
      errors.endTime = tr('endDateAfterStart');
    }

    if (!errors.endTime && ttlStart && startMins < timeToMinutes(ttlStart)) {
      errors.startTime = tr('endDateAfterStart');
    }
  }

  if (period.type === 'teaching') {
    const teacherMap = {};
    Object.entries(period.cells || {}).forEach(([name, cell]) => {
      if (!cell?.teacher) {
        if (!errors.cellErrors) errors.cellErrors = {};
        if (!errors.cellErrors[name]) errors.cellErrors[name] = {};
        errors.cellErrors[name].teacher = tr('fieldRequired');
      }
      if (!cell?.subject) {
        if (!errors.cellErrors) errors.cellErrors = {};
        if (!errors.cellErrors[name]) errors.cellErrors[name] = {};
        errors.cellErrors[name].subject = tr('fieldRequired');
      }
      if (cell?.teacher) {
        if (!teacherMap[cell.teacher]) teacherMap[cell.teacher] = [];
        teacherMap[cell.teacher].push(name);
      }
    });
    Object.entries(teacherMap).forEach(([, classes]) => {
      if (classes.length > 1) {
        classes.forEach((name) => {
          if (!errors.cellErrors) errors.cellErrors = {};
          if (!errors.cellErrors[name]) errors.cellErrors[name] = {};
          errors.cellErrors[name].teacher = tr('fieldRequired');
        });
      }
    });
  }

  return errors;
};

const CreateTimetable = () => {
  const { t } = useTranslation();
  const { selectedYear, setSelectedYear, refreshKey, triggerTimetableRefresh } = useTimetableYear();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [editingIds, setEditingIds] = useState(new Set());
  const [teachers, setTeachers] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);
  const [classIdMap, setClassIdMap] = useState({});
  const classIdMapRef = useRef({});
  const [classOptions, setClassOptions] = useState({});
  const [savingPeriodId, setSavingPeriodId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [periodErrors, setPeriodErrors] = useState({});
  const [periodStartTime, setPeriodStartTime] = useState('');
  const [periodEndTime, setPeriodEndTime] = useState('');
  const initialLoadDone = useRef(false);
  const draftTimer = useRef(null);
  const draftHandled = useRef(false);
  const loadGenRef = useRef(0);
  const dirtyRef = useRef(false);
  const [periodsFor, setPeriodsFor] = useState({ group: null, year: null });

  const groupClasses = useMemo(() => {
    if (!selectedGroup) return [];
    return GROUPS[selectedGroup]?.classes || [];
  }, [selectedGroup]);

  const canLoad = Boolean(selectedGroup && selectedYear && Object.keys(classIdMap).length > 0);

  // Data loading
  useEffect(() => {
    classService.getAllClasses()
      .then((res) => {
        const list = res?.data?.classes || [];
        const idMap = {};
        list.forEach((c) => {
          if (c.className) {
            idMap[c.className] = c._id;
          }
        });
        setClassIdMap(idMap);
        classIdMapRef.current = idMap;
      })
      .catch(() => toast.error(t('failedToLoad')));
  }, []);

  useEffect(() => {
    teacherService.getAllTeachers({ limit: 100, status: 'Active' })
      .then((res) => {
        const list = res?.data?.teachers || res?.data?.data?.teachers || [];
        setTeachers(Array.isArray(list) ? list : []);
      })
      .catch(() => toast.error(t('failedToLoad')));
  }, []);

  useEffect(() => {
    subjectService.getAllSubjects()
      .then((res) => {
        setAllSubjects(res?.data?.subjects || []);
      })
      .catch(() => {});
  }, []);

  // Class Management is the source of truth for valid Class + Subject + Teacher combos.
  useEffect(() => {
    if (!selectedGroup || !selectedYear || Object.keys(classIdMap).length === 0) return;
    let cancelled = false;
    (async () => {
      const map = {};
      for (const name of groupClasses) {
        const cid = classIdMap[name];
        if (!cid) continue;
        try {
          const res = await classService.getClassTeacherAssignments(cid);
          const d = res?.data?.data || {};
          const teacherToSubjects = {};
          const teacherNames = {};
          (d.teacherAssignments || []).forEach(({ teacher, subjects }) => {
            const tid = String(teacher?._id);
            if (!tid) return;
            teacherNames[tid] = teacher?.fullName || tid;
            teacherToSubjects[tid] = (subjects || []).map((s) => String(s._id));
          });
          map[cid] = {
            subjects: (d.classSubjects || []).map((s) => ({ id: String(s._id), name: s.subjectName || String(s._id) })),
            teacherToSubjects,
            teacherNames,
          };
        } catch { /* keep empty for this class */ }
      }
      if (!cancelled && Object.keys(map).length > 0) setClassOptions(map);
    })();
    return () => { cancelled = true; };
  }, [selectedGroup, selectedYear, classIdMap, groupClasses]);

  // Load from server
  const loadFromServer = useCallback(async () => {
    const idMap = classIdMapRef.current;
    if (!selectedGroup || !selectedYear || Object.keys(idMap).length === 0) {
      setLoading(false);
      return;
    }
    const gen = ++loadGenRef.current;
    setLoading(true);
    dirtyRef.current = false;
    try {
      const classTts = {};
      for (const name of groupClasses) {
        const cid = idMap[name];
        if (!cid) continue;
        try {
          const res = await timetableService.getTimetableByClass(cid);
          const tts = res?.data?.timetables || [];
          const match = tts.find((t) => t.academicYear === selectedYear);
          if (match) classTts[name] = match;
        } catch { /* empty */ }
      }

      if (gen !== loadGenRef.current) return;
      if (Object.keys(classTts).length === 0) {
        setPeriods([]);
        setEditingIds(new Set());
        setPeriodsFor({ group: selectedGroup, year: selectedYear });
        return;
      }

      const firstTt = Object.values(classTts)[0];
      setPeriodStartTime(firstTt.periodStartTime || '');
      setPeriodEndTime(firstTt.periodEndTime || '');

      const slotMap = {};
      Object.values(classTts).forEach((tt) => {
        (tt.periods || []).forEach((p) => {
          const key = `${p.startTime}-${p.endTime}`;
          if (!slotMap[key]) {
            slotMap[key] = {
              startTime: p.startTime,
              endTime: p.endTime,
              type: p.type || 'teaching',
              idx: Object.keys(slotMap).length,
            };
          }
        });
      });

      const sortedSlots = Object.values(slotMap).sort((a, b) => a.startTime.localeCompare(b.startTime));
      const loaded = sortedSlots.map((slot, idx) => {
        const cells = {};
        groupClasses.forEach((name) => {
          const tt = classTts[name];
          if (!tt) { cells[name] = { teacher: '', subject: '' }; return; }
          const match = (tt.periods || []).find(
            (p) => p.startTime === slot.startTime && p.endTime === slot.endTime
          );
          cells[name] = {
            teacher: match?.teacherId?._id || match?.teacherId || '',
            subject: match?.subjectId?._id || match?.subjectId || '',
          };
        });
        return {
          id: Date.now() + Math.random() + idx,
          periodNo: idx + 1,
          type: slot.type === 'break' ? 'break' : 'teaching',
          startTime: slot.startTime,
          endTime: slot.endTime,
          cells,
          saved: true,
        };
      });
      if (gen !== loadGenRef.current) return;
      setPeriods(loaded);
      setEditingIds(new Set());
      setPeriodsFor({ group: selectedGroup, year: selectedYear });
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [selectedGroup, selectedYear, groupClasses]);

  // Draft check
  const checkDraft = useCallback(() => {
    if (!selectedYear || !selectedGroup) return null;
    const raw = localStorage.getItem(DRAFT_KEY(selectedYear, selectedGroup));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }, [selectedYear, selectedGroup]);

  const checkDraftRef = useRef(checkDraft);
  const loadFromServerRef = useRef(loadFromServer);
  useEffect(() => {
    checkDraftRef.current = checkDraft;
    loadFromServerRef.current = loadFromServer;
  });

  useEffect(() => {
    if (!selectedGroup || !selectedYear || Object.keys(classIdMapRef.current).length === 0) return;
    if (initialLoadDone.current) {
      loadFromServerRef.current();
      return;
    }
    const draft = checkDraftRef.current();
    if (draft && draft.periods?.length > 0 && !draftHandled.current) {
      setPendingDraft(draft);
      setShowDraftDialog(true);
      setLoading(false);
    } else {
      loadFromServerRef.current();
    }
    initialLoadDone.current = true;
  }, [selectedGroup, selectedYear, refreshKey]);

  const handleContinueDraft = () => {
    if (pendingDraft) {
      setPeriods(pendingDraft.periods || []);
      setPeriodStartTime(pendingDraft.periodStartTime || '');
      setPeriodEndTime(pendingDraft.periodEndTime || '');
      setEditingIds(new Set());
      dirtyRef.current = true;
      setPeriodsFor({ group: selectedGroup, year: selectedYear });
    }
    setShowDraftDialog(false);
    setPendingDraft(null);
    setLoading(false);
    draftHandled.current = true;
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_KEY(selectedYear, selectedGroup));
    setShowDraftDialog(false);
    setPendingDraft(null);
    draftHandled.current = true;
    loadFromServer();
  };

  // Auto-save draft
  useEffect(() => {
    if (!selectedYear || !selectedGroup) return;
    if (periodsFor.group !== selectedGroup || periodsFor.year !== selectedYear) return;
    if (!dirtyRef.current || periods.length === 0) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY(selectedYear, selectedGroup), JSON.stringify({ periods, periodStartTime, periodEndTime }));
    }, 400);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [periods, periodStartTime, periodEndTime, selectedYear, selectedGroup, periodsFor]);

  // Derived data helpers (Class Management is the source of truth)
  const getClassSubjectOptions = useCallback((className) => {
    const opts = classOptions[classIdMap[className]];
    return opts?.subjects || [];
  }, [classOptions, classIdMap]);

  const getAvailableTeachers = useCallback((className, subjectId) => {
    if (!subjectId) return [];
    const opts = classOptions[classIdMap[className]];
    if (!opts) return [];
    const sid = String(subjectId);
    const list = [];
    for (const [tid, sids] of Object.entries(opts.teacherToSubjects)) {
      if (sids.includes(sid)) list.push({ id: tid, name: opts.teacherNames[tid] || tid });
    }
    return list;
  }, [classOptions, classIdMap]);

  const getTeacherName = useCallback((id) => {
    if (!id) return '';
    const t = teachers.find((t) => t._id === id);
    return t?.fullName || id;
  }, [teachers]);

  const getSubjectName = useCallback((id) => {
    if (!id) return '';
    const s = allSubjects.find((s) => s._id === id);
    return s?.subjectName || s?.name || id;
  }, [allSubjects]);

  // Validate a single period (used by handleSavePeriod)
  const getPeriodErrors = useCallback((period) => {
    const errors = validatePeriod(period, periodStartTime, periodEndTime, t);

    if (period.type === 'teaching' && period.cells) {
      Object.entries(period.cells).forEach(([className, cell]) => {
        if (cell?.subject && cell?.teacher) {
          const availTeachers = getAvailableTeachers(className, cell.subject);
          if (!availTeachers.some((x) => String(x.id) === String(cell.teacher))) {
            if (!errors.cellErrors) errors.cellErrors = {};
            if (!errors.cellErrors[className]) errors.cellErrors[className] = {};
            errors.cellErrors[className].teacher = `${getTeacherName(cell.teacher)} is not assigned to teach ${getSubjectName(cell.subject)} in ${className}`;
          }
        }
      });
    }

    return errors;
  }, [periodStartTime, periodEndTime, t, getAvailableTeachers, getTeacherName, getSubjectName]);

  // Save one period card independently
  const handleSavePeriod = useCallback(async (periodId) => {
    const period = periods.find((p) => p.id === periodId);
    if (!period || !selectedYear || !selectedGroup) return;

    const errors = getPeriodErrors(period);
    if (Object.keys(errors).length > 0) {
      setPeriodErrors((prev) => ({ ...prev, [periodId]: errors }));
      return;
    }

    setSavingPeriodId(periodId);
    const periodsToSave = periods.filter((p) => p.saved || p.id === periodId);
    let successCount = 0;
    let failCount = 0;

    for (const className of groupClasses) {
      const classId = classIdMap[className];
      if (!classId) { failCount++; continue; }

      const classPeriods = periodsToSave.map((p, i) => ({
        periodNo: i + 1,
        type: p.type === 'break' ? 'break' : 'teaching',
        startTime: p.startTime,
        endTime: p.endTime,
        teacherId: p.type === 'teaching' ? (p.cells[className]?.teacher || null) : null,
        subjectId: p.type === 'teaching' ? (p.cells[className]?.subject || null) : null,
      }));

      const payload = { academicYear: selectedYear, classId, periods: classPeriods, periodStartTime, periodEndTime };

      try {
        let existingId = null;
        try {
          const res = await timetableService.getTimetableByClass(classId);
          const tts = res?.data?.timetables || [];
          const match = tts.find((t) => t.academicYear === selectedYear);
          if (match) existingId = match._id;
        } catch { /* empty */ }

        if (existingId) {
          await timetableService.updateTimetable(existingId, payload);
        } else {
          await timetableService.createTimetable(payload);
        }
        successCount++;
      } catch (err) {
        failCount++;
        toast.error(`${className}: ${err?.response?.data?.message || t('failedToSave')}`);
      }
    }

    if (successCount > 0) {
      setPeriods((prev) => prev.map((p) => (p.id === periodId ? { ...p, saved: true } : p)));
      setEditingIds((prev) => { const next = new Set(prev); next.delete(periodId); return next; });
      setPeriodErrors((prev) => { const next = { ...prev }; delete next[periodId]; return next; });
      localStorage.removeItem(DRAFT_KEY(selectedYear, selectedGroup));
      toast.success(`${t('period')} ${period.periodNo} ${t('savedSuccessfully')}`);
      triggerTimetableRefresh();
    }
    if (failCount > 0) toast.error(t('failedToSave'));
    setSavingPeriodId(null);
  }, [periods, selectedYear, selectedGroup, groupClasses, classIdMap, periodStartTime, periodEndTime, getPeriodErrors, triggerTimetableRefresh]);

  // Handlers
  const addPeriod = useCallback(() => {
    dirtyRef.current = true;
    const newPeriod = {
      id: Date.now() + Math.random(),
      periodNo: periods.length + 1,
      type: 'teaching',
      startTime: '',
      endTime: '',
      cells: buildCells(groupClasses),
      saved: false,
    };
    setPeriods((prev) => [...prev, newPeriod]);
    setEditingIds((prev) => new Set([...prev, newPeriod.id]));
  }, [periods.length, groupClasses]);

  const removePeriod = useCallback((id) => {
    dirtyRef.current = true;
    setPeriods((prev) => prev.filter((p) => p.id !== id).map((p, i) => ({ ...p, periodNo: i + 1 })));
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPeriodErrors((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setConfirmDeleteId(null);
  }, []);

  const requestDelete = useCallback((period) => {
    if (period.saved) {
      setConfirmDeleteId(period.id);
    } else {
      removePeriod(period.id);
    }
  }, [removePeriod]);

  const updatePeriod = useCallback((periodId, field, value) => {
    dirtyRef.current = true;
    setPeriodErrors((prev) => { const next = { ...prev }; delete next[periodId]; return next; });
    setPeriods((prev) => prev.map((p) => {
      if (p.id !== periodId) return p;
      if (field === 'type') {
        if (value === 'break') {
          return { ...p, type: 'break', cells: {} };
        }
        return { ...p, type: 'teaching', cells: buildCells(groupClasses) };
      }
      if (field === 'startTime' || field === 'endTime') {
        return { ...p, [field]: value };
      }
      return p;
    }));
  }, [groupClasses]);

  const updateCell = useCallback((periodId, className, field, value) => {
    dirtyRef.current = true;
    setPeriodErrors((prev) => { const next = { ...prev }; delete next[periodId]; return next; });
    setPeriods((prev) => prev.map((p) => {
      if (p.id !== periodId) return p;
      const cells = { ...p.cells };
      if (field === 'subject') {
        cells[className] = { subject: value, teacher: '' };
      } else {
        cells[className] = { ...cells[className], teacher: value };
      }
      return { ...p, cells };
    }));
  }, []);

  const toggleEdit = useCallback((periodId) => {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(periodId)) {
        next.delete(periodId);
      } else {
        next.add(periodId);
      }
      return next;
    });
  }, []);

  // Group/year change
  const handleGroupChange = useCallback((g) => {
    if (selectedGroup === g) return;
    loadGenRef.current += 1;
    setSelectedGroup(g);
    setEditingIds(new Set());
    setConfirmDeleteId(null);
    setPeriodErrors({});
    initialLoadDone.current = false;
    draftHandled.current = false;
    setPendingDraft(null);
    setLoading(true);
  }, [selectedGroup]);

  const handleYearChange = useCallback((value) => {
    if (selectedYear === value) return;
    loadGenRef.current += 1;
    setSelectedYear(value);
    setEditingIds(new Set());
    setConfirmDeleteId(null);
    setPeriodErrors({});
    initialLoadDone.current = false;
    draftHandled.current = false;
    setPendingDraft(null);
    setLoading(true);
  }, [setSelectedYear, selectedYear]);

  // Styles
  const selectCls = 'appearance-none w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer';
  const inputCls = 'w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all [color-scheme:light] dark:[color-scheme:dark]';
  const labelCls = 'block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-0.5';

  const isSavingThis = (id) => savingPeriodId === id;

  const renderPeriodHeader = (period, err, isEditable) => (
    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{t('period')} {period.periodNo}</span>

        {isEditable ? (
          <>
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              <button onClick={() => updatePeriod(period.id, 'type', 'teaching')} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${period.type === 'teaching' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>{t('type')}</button>
              <button onClick={() => updatePeriod(period.id, 'type', 'break')} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer ${period.type === 'break' ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>{t('other')}</button>
            </div>

            <div className="flex items-center gap-2">
              <div>
                <label className={labelCls}>{t('startTime')}</label>
                <input type="time" value={period.startTime} onChange={(e) => updatePeriod(period.id, 'startTime', e.target.value)} className={`${err?.startTime ? inputCls.replace('border-gray-300 dark:border-gray-600', 'border-red-400 dark:border-red-500') : inputCls} w-28`} />
                {err?.startTime && <p className="text-[9px] text-red-500 dark:text-red-400 mt-0.5">{err.startTime}</p>}
              </div>
              <span className="text-gray-400 mt-4">&ndash;</span>
              <div>
                <label className={labelCls}>{t('endTime')}</label>
                <input type="time" value={period.endTime} onChange={(e) => updatePeriod(period.id, 'endTime', e.target.value)} className={`${err?.endTime ? inputCls.replace('border-gray-300 dark:border-gray-600', 'border-red-400 dark:border-red-500') : inputCls} w-28`} />
                {err?.endTime && !err?.timeOverlap && <p className="text-[9px] text-red-500 dark:text-red-400 mt-0.5">{err.endTime}</p>}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${period.type === 'break' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
              {period.type === 'break' ? t('other') : t('type')}
            </span>
            <span>{period.startTime} &ndash; {period.endTime}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isEditable ? (
          <button
            onClick={() => handleSavePeriod(period.id)}
            disabled={isSavingThis(period.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isSavingThis(period.id)
                ? 'bg-gray-400'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800'
            }`}
          >
            {isSavingThis(period.id) ? t('saving') : t('save')}
          </button>
        ) : (
          <button
            onClick={() => toggleEdit(period.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all cursor-pointer"
          >
            {t('edit')}
          </button>
        )}
        <button
          onClick={() => requestDelete(period)}
          disabled={periods.length <= 1 || isSavingThis(period.id)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('delete')}
        </button>
      </div>
    </div>
  );

  const renderTeachingBody = (period, err) => (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-700/20 border-b border-gray-100 dark:border-gray-700">
          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">{t('classLabel')}</th>
          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('teacher')}</th>
          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('subject')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {groupClasses.map((name) => {
          const cell = period.cells[name] || { teacher: '', subject: '' };
          const isEditable = !period.saved || editingIds.has(period.id);
          const cellErr = err?.cellErrors?.[name];

          if (isEditable) {
            const classSubjects = getClassSubjectOptions(name);
            const availTeachers = getAvailableTeachers(name, cell.subject);
            const subjectNotChosen = !cell.subject;
            const noTeacherForSubject = cell.subject && availTeachers.length === 0;

            return (
              <tr key={name} className={`transition-colors ${noTeacherForSubject ? 'bg-amber-50/40 dark:bg-amber-900/5' : ''}`}>
                <td className="px-3 py-2 align-middle"><span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">{name}</span></td>
                <td className="px-3 py-2 align-middle">
                  <select
                    value={cell.teacher}
                    onChange={(e) => updateCell(period.id, name, 'teacher', e.target.value)}
                    disabled={subjectNotChosen || noTeacherForSubject}
                    className={`${selectCls} max-w-[200px]`}
                  >
                    <option value="" disabled>
                      {subjectNotChosen ? t('select') : noTeacherForSubject ? t('noData') : t('select')}
                    </option>
                    {availTeachers.map((tm) => (
                      <option key={tm.id} value={tm.id}>{tm.name}</option>
                    ))}
                  </select>
                  {cellErr?.teacher && <p className="text-[9px] text-red-500 dark:text-red-400 mt-0.5">{cellErr.teacher}</p>}
                </td>
                <td className="px-3 py-2 align-middle">
                  <select value={cell.subject} onChange={(e) => updateCell(period.id, name, 'subject', e.target.value)} className={`${selectCls} max-w-[200px]`}>
                    <option value="" disabled>{t('select')}</option>
                    {classSubjects.map((cs) => (
                      <option key={cs.id} value={cs.id}>{cs.name}</option>
                    ))}
                  </select>
                  {noTeacherForSubject && <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">No teacher is assigned for this subject in {name} (Class Management).</p>}
                  {cellErr?.subject && !noTeacherForSubject && <p className="text-[9px] text-red-500 dark:text-red-400 mt-0.5">{cellErr.subject}</p>}
                </td>
              </tr>
            );
          }

          return (
            <tr key={name}>
              <td className="px-3 py-2 align-middle"><span className="text-[11px] font-medium text-gray-700 dark:text-gray-200">{name}</span></td>
              <td className="px-3 py-2 align-middle"><span className="text-[11px] text-gray-600 dark:text-gray-400">{getTeacherName(cell.teacher) || '-'}</span></td>
              <td className="px-3 py-2 align-middle"><span className="text-[11px] text-gray-600 dark:text-gray-400">{getSubjectName(cell.subject) || '-'}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderBreakBody = () => (
    <div className="px-4 py-6 flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm font-medium">{t('other')}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {showDraftDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('warning')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('confirmAction')}</p>
            <div className="flex items-center gap-3 justify-end">
              <button onClick={handleDiscardDraft} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer">{t('reset')}</button>
              <button onClick={handleContinueDraft} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all cursor-pointer">{t('edit')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('delete')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('confirmDelete')}</p>
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer">{t('cancel')}</button>
              <button onClick={() => removePeriod(confirmDeleteId)} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-sm transition-all cursor-pointer">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}

      <CardSection title={t('timetable')}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="w-full sm:w-48">
            <SelectInput
              label={t('academicYearLabel')}
              name="academicYear"
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              options={ACADEMIC_YEARS}
              placeholder={t('selectYear')}
            />
          </div>
          <div className="flex items-center gap-2">
            {[
              { g: 1, a: 'bg-blue-600 text-white shadow-md shadow-blue-300/30 dark:shadow-blue-900/40 scale-105', i: 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400' },
              { g: 2, a: 'bg-emerald-600 text-white shadow-md shadow-emerald-300/30 dark:shadow-emerald-900/40 scale-105', i: 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400' },
              { g: 3, a: 'bg-violet-600 text-white shadow-md shadow-violet-300/30 dark:shadow-violet-900/40 scale-105', i: 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400' },
            ].map(({ g, a, i }) => (
              <button key={g} onClick={() => handleGroupChange(g)} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap ${selectedGroup === g ? a : i}`}>
                {GROUPS[g].name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className={labelCls}>{t('startTime')}</label>
              <input type="time" value={periodStartTime} onChange={(e) => setPeriodStartTime(e.target.value)} className={`${inputCls} w-28`} />
            </div>
            <div>
              <label className={labelCls}>{t('endTime')}</label>
              <input type="time" value={periodEndTime} onChange={(e) => setPeriodEndTime(e.target.value)} className={`${inputCls} w-28`} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addPeriod}
              disabled={!selectedYear || !selectedGroup || !periodStartTime || !periodEndTime}
              className="px-5 py-2 rounded-lg text-[13px] font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              {t('add')}
            </button>
          </div>
        </div>
        {loading && canLoad && periods.length === 0 && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">{t('loading')}</p>
        )}
        {!loading && selectedGroup && selectedYear && periods.length > 0 && (
          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-3">{GROUPS[selectedGroup]?.name} &middot; {periods.length} period(s)</p>
        )}
        {!loading && selectedGroup && selectedYear && periods.length === 0 && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">{t('noData')}</p>
        )}
      </CardSection>

      {periods.length > 0 && (
        <div className="space-y-3">
          {periods.map((period) => {
            const err = periodErrors[period.id];
            const isEditable = !period.saved || editingIds.has(period.id);

            return (
              <div key={period.id}>
                <div className={`bg-white dark:bg-gray-800 rounded-xl border ${err?.startTime || err?.endTime || err?.timeOverlap ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} shadow-sm overflow-hidden`}>
                  {renderPeriodHeader(period, err, isEditable)}

                  <div className="overflow-x-auto">
                    {period.type === 'break' ? renderBreakBody() : renderTeachingBody(period, err)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {periods.length === 0 && (
        <CardSection title={t('timetable')}>
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <svg className="h-14 w-14 text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('noData')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              {!selectedYear || !selectedGroup
                ? t('selectAcademicYear')
                : t('selectAcademicYear')}
            </p>
          </div>
        </CardSection>
      )}
    </div>
  );
};

export default CreateTimetable;
