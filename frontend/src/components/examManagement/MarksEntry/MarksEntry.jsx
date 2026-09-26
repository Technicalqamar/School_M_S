import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowPathIcon, AcademicCapIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import SearchInput from '../../common/SearchInput/SearchInput';
import Table from '../../common/Table/Table';
import ActionButtons from '../../common/ActionButtons/ActionButtons';
import Modal from '../../common/Modal/Modal';
import SelectInput from '../../common/SelectInput/SelectInput';
import examService from '../../../services/exam/exam.service';
import examSubjectService from '../../../services/examSubject/examSubject.service';
import markService from '../../../services/marks/mark.service';
import studentService from '../../../services/student/student.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { optionId, buildIdOptions, buildIdOptionValue } from '../../../services/exam/optionUtils';

const PAGE_SIZE = 100;

const examLabel = (exam) => `${exam.name} (${exam.type})`;

const MarksEntry = () => {
  const { academic } = useSchoolConfig();

  const centralYear = academic?.currentYear || '';
  const centralYearOptions = centralYear ? [centralYear] : [];

  const [academicYear, setAcademicYear] = useState(() => centralYear || '');
  const [examId, setExamId] = useState('');
  const [className, setClassName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subjectConfigs, setSubjectConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [marks, setMarks] = useState({});
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewItem, setViewItem] = useState(null);
  const [errors, setErrors] = useState({});
  const [existingMarks, setExistingMarks] = useState({});
  const configFetchRef = useRef(0);

  const [exams, setExams] = useState([]);

  useEffect(() => {
    if (!centralYear || academicYear === centralYear) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setAcademicYear(centralYear);
      setExamId('');
      setClassName('');
      setSubjectId('');
      setLoaded(false);
      setMarks({});
      setStudents([]);
      setExistingMarks({});
    }, 0);
    return () => clearTimeout(timer);
  }, [centralYear, academicYear]);

  useEffect(() => {
    let mounted = true;
    examService
      .getAllExams({ limit: 100 })
      .then((res) => {
        if (mounted) setExams((res.data?.exams || []).filter((exam) => exam.type !== 'Monthly Test'));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const filteredExams = useMemo(() => {
    if (!academicYear) return [];
    return exams.filter((e) => e.academicYear === academicYear && e.status === 'Active');
  }, [exams, academicYear]);

  const filteredClasses = useMemo(() => {
    if (!examId) return [];
    const exam = exams.find((e) => String(e._id) === String(examId));
    return exam && Array.isArray(exam.classes) ? exam.classes : [];
  }, [exams, examId]);

  const fetchSubjectConfigs = useCallback(async (exam, cls, year) => {
    configFetchRef.current += 1;
    const requestId = configFetchRef.current;
    setLoadingConfigs(true);
    try {
      const result = await examSubjectService.getAllExamSubjects({
        examId: exam,
        className: cls,
        academicYear: year,
        status: 'Active',
        limit: PAGE_SIZE,
      });
      if (configFetchRef.current === requestId) {
        setSubjectConfigs(result.data?.examSubjects || []);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load subjects';
      toast.error(msg);
      if (configFetchRef.current === requestId) setSubjectConfigs([]);
    } finally {
      if (configFetchRef.current === requestId) setLoadingConfigs(false);
    }
  }, []);

  useEffect(() => {
    if (!(examId && className && academicYear)) return undefined;
    const timer = setTimeout(() => {
      fetchSubjectConfigs(examId, className, academicYear);
    }, 0);
    return () => clearTimeout(timer);
  }, [examId, className, academicYear, fetchSubjectConfigs]);

  const examOptions = useMemo(() => buildIdOptions(filteredExams, examLabel), [filteredExams]);
  const examOptionValue = useMemo(() => buildIdOptionValue(filteredExams, examId, examLabel), [filteredExams, examId]);

  const getSubjectOf = (config) => {
    if (!config) return null;
    return config.subjectId && typeof config.subjectId === 'object' && config.subjectId._id ? config.subjectId : null;
  };

  const subjectOptions = useMemo(
    () =>
      subjectConfigs.map((config) => {
        const subject = getSubjectOf(config);
        return `${subject ? subject._id : String(config.subjectId)}::${subject ? subject.subjectName : 'Subject'}`;
      }),
    [subjectConfigs],
  );

  const subjectOptionValue = useMemo(
    () => {
      if (!subjectId) return '';
      return subjectOptions.find((o) => o.startsWith(`${subjectId}::`)) || '';
    },
    [subjectOptions, subjectId],
  );

  const selectedSubjectConfig = useMemo(() => {
    if (!subjectId) return null;
    return (
      subjectConfigs.find((c) => {
        const subject = getSubjectOf(c);
        return String(subject ? subject._id : c.subjectId) === String(subjectId);
      }) || null
    );
  }, [subjectConfigs, subjectId]);

  const getSubjectDisplayName = (config) => {
    const subject = getSubjectOf(config);
    return subject ? subject.subjectName : '';
  };

  const displayStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        String(s.studentId || '').toLowerCase().includes(q) ||
        String(s.fullName || '').toLowerCase().includes(q) ||
        String(s.admissionNumber || '').toLowerCase().includes(q),
    );
  }, [students, search]);

  const getMarkValue = (studentId) => {
    if (marks[studentId] !== undefined) return marks[studentId];
    if (existingMarks[studentId] !== undefined) return String(existingMarks[studentId].obtainedMarks);
    return '';
  };

  const getMarkStatus = (studentId) => {
    const existing = existingMarks[studentId];
    return existing ? existing.status : 'Not Entered';
  };

  const handleMarkChange = (studentId, value) => {
    if (value === '' || (/^\d*$/.test(value) && Number(value) >= 0)) {
      setMarks((prev) => ({ ...prev, [studentId]: value }));
    }
  };

  const fetchStudents = useCallback(async (cls, year) => {
    const all = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = await studentService.getAllStudents({
        class: cls,
        academicYear: year,
        status: 'Active',
        page,
        limit: PAGE_SIZE,
      });
      const data = result.data?.students || [];
      all.push(...data);
      const totalPages = result.data?.pagination?.totalPages || 1;
      hasMore = page < totalPages;
      page += 1;
    }
    return all;
  }, []);

  const fetchExistingMarks = useCallback(async (exam, subject, cls, year) => {
    const map = {};
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const result = await markService.getAllMarks({
        examId: exam,
        subjectId: subject,
        className: cls,
        academicYear: year,
        page,
        limit: PAGE_SIZE,
      });
      const marksArr = result.data?.marks || [];
      marksArr.forEach((m) => {
        map[String(m.studentId && typeof m.studentId === 'object' ? m.studentId._id : m.studentId)] = {
          obtainedMarks: m.obtainedMarks,
          status: m.status,
        };
      });
      const totalPages = result.data?.pagination?.totalPages || 1;
      hasMore = page < totalPages;
      page += 1;
    }
    return map;
  }, []);

  const handleLoadStudents = async () => {
    const newErrors = {};
    if (!academicYear) newErrors.academicYear = 'Required';
    if (!examId) newErrors.examId = 'Required';
    if (!className) newErrors.className = 'Required';
    if (!subjectId) newErrors.subjectId = 'Required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoadingStudents(true);
    try {
      const [studentList, marksMap] = await Promise.all([
        fetchStudents(className, academicYear),
        fetchExistingMarks(examId, subjectId, className, academicYear),
      ]);
      const preFilled = {};
      studentList.forEach((s) => {
        const existing = marksMap[String(s._id)];
        if (existing) preFilled[s._id] = String(existing.obtainedMarks);
      });
      setStudents(studentList);
      setExistingMarks(marksMap);
      setMarks(preFilled);
      setLoaded(true);
      setSearch('');
      toast.success(`Loaded ${studentList.length} students`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load students';
      toast.error(msg);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSaveMarks = async () => {
    const totalMarks = selectedSubjectConfig?.totalMarks;
    if (!selectedSubjectConfig) {
      toast.error('Subject configuration not found');
      return;
    }

    let invalid = false;
    const entries = [];

    students.forEach((s) => {
      const val = marks[s._id];
      if (val === undefined || val === '') return;
      const num = Number(val);
      if (isNaN(num) || num < 0 || (totalMarks && num > totalMarks)) {
        invalid = true;
        return;
      }
      entries.push({ studentId: s._id, obtainedMarks: num });
    });

    if (invalid) {
      toast.error('Some marks are invalid. Please check all entered values.');
      return;
    }

    if (entries.length === 0) {
      toast.error('No marks entered to save');
      return;
    }

    setSaving(true);
    try {
      const result = await markService.bulkSaveMarks({
        examId,
        subjectId,
        className,
        academicYear,
        entries,
      });
      const savedCount = result.data?.created || 0;
      toast.success(`${entries.length} mark(s) saved successfully${savedCount > 0 ? ` (${savedCount} new, ${(result.data?.modified || 0) + (result.data?.matched || 0) - savedCount} updated)` : ''}`);
      const marksMap = await fetchExistingMarks(examId, subjectId, className, academicYear);
      setExistingMarks(marksMap);
      const preFilled = {};
      students.forEach((s) => {
        const existing = marksMap[String(s._id)];
        if (existing) preFilled[s._id] = String(existing.obtainedMarks);
      });
      setMarks(preFilled);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save marks';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setAcademicYear(centralYear);
    setExamId('');
    setClassName('');
    setSubjectId('');
    setLoaded(false);
    setSearch('');
    setMarks({});
    setErrors({});
    setStudents([]);
    setExistingMarks({});
    setSubjectConfigs([]);
  };

  const openView = (student) => {
    const existing = existingMarks[String(student._id)];
    const val = marks[student._id];
    setViewItem({
      student,
      examName: exams.find((e) => String(e._id) === String(examId))?.name || '-',
      academicYear,
      className,
      subjectName: getSubjectDisplayName(selectedSubjectConfig),
      totalMarks: selectedSubjectConfig?.totalMarks || '-',
      obtainedMarks: val !== undefined && val !== '' ? val : existing ? existing.obtainedMarks : '-',
      entryStatus: existing ? existing.status : 'Not Entered',
    });
    setShowViewModal(true);
  };

  const tableColumns = [
    { key: 'studentId', label: 'Student ID' },
    { key: 'fullName', label: 'Student Name' },
    { key: 'admissionNumber', label: 'Roll No.' },
    { key: 'totalMarks', label: 'Total Marks' },
    { key: 'obtainedMarks', label: 'Obtained Marks' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', className: 'text-right' },
  ];

  const renderRow = (student) => {
    const val = getMarkValue(student._id);
    const status = getMarkStatus(student._id);
    const numVal = val !== '' ? Number(val) : null;
    const overMax = numVal !== null && selectedSubjectConfig && numVal > selectedSubjectConfig.totalMarks;

    return (
      <>
        <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{student.studentId}</td>
        <td className="px-4 py-3">
          <span className="font-medium text-gray-900 dark:text-white">{student.fullName}</span>
        </td>
        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{student.admissionNumber}</td>
        <td className="px-4 py-3 text-center">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedSubjectConfig?.totalMarks || '-'}</span>
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            inputMode="numeric"
            value={val}
            onChange={(e) => handleMarkChange(student._id, e.target.value)}
            placeholder="0"
            className={`w-20 px-3 py-1.5 rounded-lg border text-sm text-center font-medium focus:outline-none focus:ring-2 transition-all ${
              overMax
                ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500/20 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
            }`}
          />
          {overMax && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Max: {selectedSubjectConfig.totalMarks}</p>
          )}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            status === 'Entered'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}>
            {status}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <ActionButtons onView={() => openView(student)} />
        </td>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marks Entry</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enter and manage student marks for examinations.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <AcademicCapIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Select Examination Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <SelectInput
              label="Academic Year"
              name="academicYear"
              value={academicYear}
              onChange={(e) => { setAcademicYear(e.target.value); setExamId(''); setClassName(''); setSubjectId(''); setLoaded(false); setMarks({}); setStudents([]); setExistingMarks({}); }}
              options={centralYearOptions}
              placeholder="Select year"
              required
            />
            {errors.academicYear && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.academicYear}</p>}
          </div>
          <div>
            <SelectInput
              label="Exam"
              name="examId"
              value={examOptionValue}
              onChange={(e) => { setExamId(optionId(e.target.value)); setClassName(''); setSubjectId(''); setLoaded(false); setMarks({}); setStudents([]); setExistingMarks({}); }}
              options={examOptions}
              placeholder={academicYear ? 'Select exam' : 'Select year first'}
              disabled={!academicYear}
              required
            />
            {errors.examId && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.examId}</p>}
          </div>
          <div>
            <SelectInput
              label="Class"
              name="className"
              value={className}
              onChange={(e) => { setClassName(e.target.value); setSubjectId(''); setLoaded(false); setMarks({}); setStudents([]); setExistingMarks({}); }}
              options={filteredClasses}
              placeholder={examId ? 'Select class' : 'Select exam first'}
              disabled={!examId}
              required
            />
            {errors.className && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.className}</p>}
          </div>
          <div>
            <SelectInput
              label="Subject"
              name="subjectId"
              value={subjectOptionValue}
              onChange={(e) => { setSubjectId(optionId(e.target.value)); setLoaded(false); setMarks({}); setStudents([]); setExistingMarks({}); }}
              options={subjectOptions}
              placeholder={className ? (loadingConfigs ? 'Loading subjects...' : 'Select subject') : 'Select class first'}
              disabled={!className || loadingConfigs}
              required
            />
            {errors.subjectId && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.subjectId}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleLoadStudents}
            disabled={loadingStudents}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <AcademicCapIcon className="h-4 w-4" /> {loadingStudents ? 'Loading...' : 'Load Students'}
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowPathIcon className="h-4 w-4" /> Reset
          </button>
          {loaded && selectedSubjectConfig && (
            <div className="ml-auto flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Total Marks: <strong className="text-gray-900 dark:text-white">{selectedSubjectConfig.totalMarks}</strong></span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Passing Marks: <strong className="text-gray-900 dark:text-white">{selectedSubjectConfig.passingMarks}</strong></span>
            </div>
          )}
        </div>
      </div>

      {loaded ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Student Marks — {getSubjectDisplayName(selectedSubjectConfig)}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {exams.find((e) => String(e._id) === String(examId))?.name} • {className} • {academicYear}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-64">
                <SearchInput placeholder="Search student ID, name or roll..." value={search} onChange={setSearch} />
              </div>
              <button
                onClick={handleSaveMarks}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircleIcon className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Marks'}
              </button>
            </div>
          </div>

          <Table columns={tableColumns} data={displayStudents} renderRow={renderRow} />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <AcademicCapIcon className="h-8 w-8 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Marks Entry</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Select Academic Year, Exam, Class and Subject, then click <strong>Load Students</strong> to begin entering marks.
            </p>
          </div>
        </div>
      )}

      <Modal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setViewItem(null); }}
        title="Marks Details"
        maxWidth="max-w-lg"
      >
        {viewItem && viewItem.student && (
          <div className="space-y-5">
            <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono">{viewItem.student.admissionNumber}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{viewItem.student.fullName}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">{viewItem.student.studentId}</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                viewItem.entryStatus === 'Entered'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                {viewItem.entryStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Student ID</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{viewItem.student.studentId}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Roll Number</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.student.admissionNumber}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Exam</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.examName}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Academic Year</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.academicYear}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Class</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.className}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Subject</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.subjectName}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Marks</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.totalMarks}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Obtained Marks</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewItem.obtainedMarks}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MarksEntry;