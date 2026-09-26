import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '../../../hooks/useLocalization';
import CardSection from '../../common/CardSection/CardSection';
import SelectInput from '../../common/SelectInput/SelectInput';
import Input from '../../common/Input/Input';
import SearchInput from '../../common/SearchInput/SearchInput';
import Table from '../../common/Table/Table';
import StatusBadge from '../../common/StatusBadge/StatusBadge';
import ConfirmationModal from '../../common/ConfirmationModal/ConfirmationModal';
import { getImageUrl } from '../../../utils/imageUrl';
import studentService from '../../../services/student/student.service';
import { toast } from 'react-hot-toast';
import { CLASS_NAMES } from '../../../utils/classNames';
import Spinner from '../../common/Spinner/Spinner';

const promotionMap = {
  'Montessori': 'Nursery',
  'Nursery': 'KG 1',
  'KG 1': 'KG 2',
  'KG 2': 'Class 1',
  'Class 1': 'Class 2',
  'Class 2': 'Class 3',
  'Class 3': 'Class 4',
  'Class 4': 'Class 5',
  'Class 5': 'Class 6',
  'Class 6': 'Class 7',
  'Class 7': 'Class 8',
  'Class 8': 'Class 9',
  'Class 9': 'Class 10',
  'Class 10': 'Class 10',
};

const safeName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '??';
  return fullName.split(' ').map(n => n ? n[0] : '').join('').slice(0, 2).toUpperCase() || '??';
};

const safeSplitName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '';
  return fullName;
};

const StudentPromotion = () => {
  const { t } = useTranslation();
  const statusOptions = [t('all'), t('active'), t('inactive')];
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [fromClass, setFromClass] = useState('');
  const [toClass, setToClass] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(t('all'));
  const [loaded, setLoaded] = useState(false);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const fromClassIndex = CLASS_NAMES.indexOf(fromClass);
  const toClassOptions = fromClass ? CLASS_NAMES.slice(fromClassIndex + 1) : [];

  const handleFromYearChange = useCallback((e) => {
    const newFromYear = e?.target?.value || '';
    setFromYear(newFromYear);
    setToYear('');
  }, []);

  const handleFromClassChange = useCallback((e) => {
    const newFromClass = e?.target?.value || '';
    setFromClass(newFromClass);
    const idx = CLASS_NAMES.indexOf(newFromClass);
    const remaining = CLASS_NAMES.slice(idx + 1);
    if (remaining.length > 0 && !remaining.includes(toClass)) {
      setToClass(remaining[0]);
    } else if (remaining.length === 0) {
      setToClass('');
    }
  }, [toClass]);

  const filteredStudents = useMemo(() => {
    if (!loaded || !Array.isArray(students)) return [];
    return students.filter((s) => {
      if (!s) return false;
      if (fromClass && s.class !== fromClass) return false;
      if (statusFilter !== t('all') && s.status !== statusFilter) return false;
      if (nameSearch && s.name && !s.name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      return true;
    });
  }, [loaded, students, fromClass, statusFilter, nameSearch]);

  const allSelected = filteredStudents.length > 0 && selectedIds.size === filteredStudents.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((s) => s?.id).filter(Boolean)));
    }
  };

  const toggleSelect = (id) => {
    if (!id) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const mapStudent = (s) => ({
    _id: s._id,
    id: s.studentId,
    name: s.fullName,
    fatherName: s.fatherName,
    class: s.class,
    status: s.status || 'Active',
    studentImage: s.studentImage,
    academicYear: s.academicYear,
  });

  const handleLoad = async () => {
    if (!fromYear) return toast.error(t('selectFromAcademicYear'));
    if (!toYear) return toast.error(t('selectToAcademicYear'));
    if (!/^\d{4}$/.test(fromYear)) return toast.error(t('invalidFromYearFormat'));
    if (!/^\d{4}$/.test(toYear)) return toast.error(t('invalidToYearFormat'));
    if (!fromClass) return toast.error(t('selectCurrentClass'));
    if (!toClass) return toast.error(t('selectTargetClass'));
    if (fromYear === toYear) return toast.error(t('academicYearsMustDiffer'));
    if (fromClass === toClass) return toast.error(t('classesCannotMatch'));

    setLoading(true);
    setError(null);
    try {
      const params = { class: fromClass };
      if (fromYear) params.academicYear = fromYear;

      const data = await studentService.filterStudentsForPromotion(params);
      if (data.success) {
        const mapped = (data.data?.students || []).map(mapStudent);
        setStudents(mapped);
        setLoaded(true);
        setSelectedIds(new Set());
        if (mapped.length === 0) {
          toast.error(t('noStudentsFoundCriteria'));
        } else {
          toast.success(`${mapped.length} ${t('studentsLoadedSuccessfully')}`);
        }
      } else {
        toast.error(data.message || t('failedToLoadStudents'));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || t('networkError'));
      setStudents([]);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = () => {
    setConfirmOpen(true);
  };

  const handleConfirmPromotion = async () => {
    setPromoting(true);
    try {
      const selectedStudents = students.filter((st) => selectedIds.has(st.id));
      const payload = {
        studentIds: selectedStudents.map((st) => st.id),
        fromClass,
        toClass,
        fromAcademicYear: fromYear,
        toAcademicYear: toYear,
      };
      const data = await studentService.promoteStudents(payload);
      if (data.success) {
        toast.success(t('studentsPromotedSuccessfully'));
        setConfirmOpen(false);
        setSelectedIds(new Set());
        setStudents([]);
        setLoaded(false);
        handleLoad();
      } else {
        toast.error(data.message || t('promotionFailed'));
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || t('promotionFailed'));
    } finally {
      setPromoting(false);
    }
  };

  const columns = [
    { key: 'checkbox', label: '' },
    { key: 'student', label: t('student') },
    { key: 'id', label: t('studentIdLabel') },
    { key: 'currentClass', label: t('currentClass') },
    { key: 'promoteTo', label: t('promoteTo') },
    { key: 'status', label: t('status') },
  ];

  const renderRow = (student) => {
    if (!student) {
      return (
        <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
          {t('noData')}
        </td>
      );
    }

    const suggestedClass = toClass || promotionMap[student.class] || student.class || '—';

    return (
      <>
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={selectedIds.has(student.id)}
            onChange={() => toggleSelect(student.id)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/50 flex-shrink-0 overflow-hidden">
              {getImageUrl(student.studentImage) ? (
                <img src={getImageUrl(student.studentImage)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
              ) : null}
              <span className={getImageUrl(student.studentImage) ? 'hidden' : ''}>{safeName(student.name)}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{safeSplitName(student.name) || t('unknown')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {student.fatherName ? `${t('sonOf')}${student.fatherName}` : '—'}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{student.id || '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{student.class || '—'}</td>
        <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{suggestedClass}</td>
        <td className="px-4 py-3">
          <StatusBadge status={student.status || 'Active'} />
        </td>
      </>
    );
  };

  return (
    <div className="space-y-5">
      <CardSection title={t('promotionSettings')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 sm:gap-3">
          <Input
            label={t('fromAcademicYear')}
            name="fromYear"
            value={fromYear}
            onChange={handleFromYearChange}
            placeholder="e.g. 2025"
          />
          <Input
            label={t('toAcademicYear')}
            name="toYear"
            value={toYear}
            onChange={(e) => setToYear(e.target.value)}
            placeholder="e.g. 2026"
          />
          <SelectInput
            label={t('fromClass')}
            name="fromClass"
            value={fromClass}
            onChange={handleFromClassChange}
            options={CLASS_NAMES}
          />
          <SelectInput
            label={t('toClass')}
            name="toClass"
            value={toClass}
            onChange={(e) => setToClass(e.target.value)}
            options={toClassOptions}
          />
        </div>
      </CardSection>

      <CardSection title={t('studentList')}>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
          <div className="w-full sm:w-56">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">
              {t('searchStudentName')}
            </label>
            <SearchInput
              placeholder={t('searchStudentName')}
              value={nameSearch}
              onChange={setNameSearch}
            />
          </div>
          <div className="w-full sm:w-36">
            <SelectInput
              label={t('status')}
              name="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
              className="mb-0"
            />
          </div>
          <div className="sm:ml-auto">
            <button
              onClick={handleLoad}
              disabled={loading || !fromClass || !toYear}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-transparent text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Spinner size="xs" />}
              {t('loadStudents')}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loaded ? (
          <>
            {filteredStudents.length > 0 ? (
              <>
                <div className="mb-3">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    {t('selectAll')} ({filteredStudents.length} {t('students')})
                  </label>
                </div>
                <Table columns={columns} data={filteredStudents} renderRow={renderRow} />
              </>
            ) : (
              <div className="text-center py-10 text-gray-400 dark:text-gray-500">
                <p className="text-sm">{t('noStudentsFoundCriteria')}</p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500">
            <p className="text-sm">{t('selectCriteriaAndLoad')}</p>
          </div>
        )}
      </CardSection>

      {loaded && selectedIds.size > 0 && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {selectedIds.size} {t('studentsSelected')}
          </p>
          <button
            onClick={handlePromote}
            className="px-5 py-2.5 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            {t('promoteSelectedStudents')}
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmOpen}
        onClose={() => { if (!promoting) setConfirmOpen(false); }}
        title={selectedIds.size > 1 ? t('confirmStudentsPromotion') : t('confirmStudentPromotion')}
        confirmLabel={t('confirmPromotion')}
        onConfirm={handleConfirmPromotion}
        variant="primary"
        loading={promoting}
        maxWidth={selectedIds.size > 1 ? 'max-w-lg' : 'max-w-md'}
      >
        {selectedIds.size > 1 ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('selectedStudents')}: <span className="font-semibold text-gray-900 dark:text-white">{selectedIds.size}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-7 px-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                  {fromClass || '—'}
                </span>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m0 0l-7-7m7 7l-7 7" />
                </svg>
                <span className="inline-flex items-center justify-center h-7 px-3 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold">
                  {toClass || '—'}
                </span>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 -mr-1">
              {filteredStudents
                .filter((s) => s && selectedIds.has(s.id))
                .map((s, idx) => {
                  const targetClass = toClass || (s && promotionMap[s.class]) || (s && s.class) || '—';
                  return (
                    <div key={s?.id || `student-${idx}`} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-3 py-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 overflow-hidden">
                        {getImageUrl(s?.studentImage) ? (
                          <img src={getImageUrl(s.studentImage)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : null}
                        <span className={getImageUrl(s?.studentImage) ? 'hidden' : ''}>{safeName(s?.name)}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 min-w-0 truncate">
                        {safeSplitName(s?.name) || t('unknown')}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{s?.class || '—'}</span>
                      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m0 0l-7-7m7 7l-7 7" />
                      </svg>
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">{targetClass}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {filteredStudents
                .filter((s) => s && selectedIds.has(s.id))
                .map((s, idx) => {
                  const targetClass = toClass || (s && promotionMap[s.class]) || (s && s.class) || '—';
                  return (
                    <div key={s?.id || `single-${idx}`} className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                      <div className="flex flex-col items-center gap-2 mb-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                          {getImageUrl(s?.studentImage) ? (
                            <img src={getImageUrl(s.studentImage)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : null}
                          <span className={getImageUrl(s?.studentImage) ? 'hidden' : ''}>{safeName(s?.name)}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {safeSplitName(s?.name) || t('unknown')}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <span className="inline-flex items-center justify-center w-16 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                          {s?.class || '—'}
                        </span>
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m0 0l-7-7m7 7l-7 7" />
                        </svg>
                        <span className="inline-flex items-center justify-center w-16 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold">
                          {targetClass}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
            {filteredStudents.filter((s) => s && selectedIds.has(s.id)).length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {t('confirmPromoteStudent')}
              </p>
            )}
          </>
        )}
      </ConfirmationModal>
    </div>
  );
};

export default StudentPromotion;
