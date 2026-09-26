import { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  EyeIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  DocumentCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import Table from '../../common/Table/Table';
import Modal from '../../common/Modal/Modal';
import SelectInput from '../../common/SelectInput/SelectInput';
import Alert from '../../common/Alert/Alert';
import Spinner from '../../common/Spinner/Spinner';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import examService from '../../../services/exam/exam.service';
import resultService from '../../../services/result/result.service';
import studentService from '../../../services/student/student.service';
import { optionId, buildIdOptions, buildIdOptionValue } from '../../../services/exam/optionUtils';
import { CLASS_NAMES } from '../../../utils/classNames';
import {
  getInitials,
  gradeBadgeClass,
  statusBadgeClass,
  buildMarksheetHtml as buildMarksheetHtmlShared,
  printMarksheet,
  downloadMarksheetPdf,
} from '../shared/marksheet';
import MarksheetPreview from '../shared/MarksheetPreview';

const examLabel = (exam) => `${exam.name} (${exam.type})`;

const Results = () => {
  const { schoolInfo, academic } = useSchoolConfig();

  const centralYear = academic?.currentYear || '';
  const centralYearOptions = centralYear ? [centralYear] : [];

  const [academicYear, setAcademicYear] = useState(() => centralYear || '');
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [className, setClassName] = useState('');

  const [studentQuery, setStudentQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('');
  const [results, setResults] = useState([]);
  const [result, setResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewResult, setViewResult] = useState(null);

  useEffect(() => {
    let mounted = true;
    examService
      .getAllExams({ limit: 100 })
      .then((res) => {
        if (mounted) setExams((res.data?.exams || []).filter((exam) => exam.type !== 'Monthly Test'));
      })
      .catch(() => {
        if (mounted) setExams([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!centralYear || academicYear === centralYear) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setAcademicYear(centralYear);
      setExamId('');
      setClassName('');
      setSelectedStudent(null);
      setGenerated(false);
      setResult(null);
      setResults([]);
    }, 0);
    return () => clearTimeout(timer);
  }, [centralYear, academicYear]);

  const yearOptions = useMemo(() => {
    const years = new Set(exams.map((e) => String(e.academicYear)).filter(Boolean));
    if (centralYear) years.add(centralYear);
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [exams, centralYear]);

  const yearExams = useMemo(
    () => exams.filter((e) => String(e.academicYear) === String(academicYear)),
    [exams, academicYear],
  );

  const examOptions = useMemo(() => buildIdOptions(yearExams, examLabel), [yearExams]);
  const examOptionValue = useMemo(() => buildIdOptionValue(yearExams, examId, examLabel), [yearExams, examId]);

  const selectedExam = useMemo(
    () => exams.find((e) => String(e._id) === String(examId)) || null,
    [exams, examId],
  );

  const availableClassNames = useMemo(() => {
    if (selectedExam && Array.isArray(selectedExam.classes) && selectedExam.classes.length > 0) {
      return selectedExam.classes;
    }
    return CLASS_NAMES;
  }, [selectedExam]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const q = studentQuery.trim().toLowerCase();
      if (!q) {
        if (!cancelled) {
          setSearchResults([]);
          setSearching(false);
          setHasSearched(false);
        }
        return undefined;
      }
      setSearching(true);
      const params = { search: q, limit: 50 };
      if (className) params.class = className;
      if (academicYear) params.academicYear = academicYear;
      studentService
        .getAllStudents(params)
        .then((res) => {
          if (!cancelled) {
            setSearchResults(res.data?.students || []);
            setSearching(false);
            setHasSearched(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearchResults([]);
            setSearching(false);
            setHasSearched(true);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [studentQuery, className, academicYear]);

  const selectStudent = (student) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setStudentQuery('');
    setInputFocused(false);
    setGenerated(false);
    setResult(null);
    setResults([]);
    setMode('');
    setError('');
  };

  const showSuggestions = !!studentQuery.trim() && searchResults.length > 0 && (inputFocused || hasSearched);

  const handleExamChange = (e) => {
    setExamId(optionId(e.target.value));
    setClassName('');
    setSelectedStudent(null);
    setGenerated(false);
    setResult(null);
    setResults([]);
    setMode('');
    setError('');
  };

  const handleClassChange = (e) => {
    setClassName(e.target.value);
    setSelectedStudent(null);
    setGenerated(false);
    setResult(null);
    setResults([]);
    setMode('');
    setError('');
  };

  const handleGenerate = async () => {
    if (!academicYear || !examId || !className) return;
    setLoading(true);
    setError('');
    setGenerated(false);
    setResult(null);
    setResults([]);
    setMode('');
    try {
      const params = { academicYear, examId, className };
      if (selectedStudent) {
        params.studentId = selectedStudent._id;
      }
      const res = await resultService.getResults(params);
      const data = res.data || {};
      if (data.mode === 'individual') {
        setResult(data.result || null);
        setMode('individual');
      } else {
        setResults(data.results || []);
        setMode('class');
      }
      setGenerated(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate the result';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAcademicYear(centralYear);
    setExamId('');
    setClassName('');
    setStudentQuery('');
    setSearchResults([]);
    setSelectedStudent(null);
    setGenerated(false);
    setResult(null);
    setResults([]);
    setMode('');
    setError('');
  };

  const buildMarksheetHtml = useCallback(
    (record) => buildMarksheetHtmlShared(record, schoolInfo),
    [schoolInfo],
  );

  const handlePrint = useCallback(
    (record) => {
      printMarksheet(buildMarksheetHtml(record), setPrinting);
    },
    [buildMarksheetHtml],
  );

  const handleExportPdf = useCallback(
    (record) => {
      const html = buildMarksheetHtml(record);
      if (!html) return;
      const slug = record.student.studentId || record.student.fullName.replace(/\s+/g, '-');
      const filename = `Marksheet-${slug}-${(record.exam?.name || 'Exam').replace(/\s+/g, '-')}-${record.academicYear}.pdf`;
      downloadMarksheetPdf(html, filename, setExporting);
    },
    [buildMarksheetHtml],
  );

  const renderMarksheet = (record) => <MarksheetPreview record={record} schoolInfo={schoolInfo} />;

  const summary = useMemo(() => {
    if (!generated || mode !== 'class' || results.length === 0) return null;
    const totalStudents = results.length;
    const withMarks = results.filter((r) => r.allEntered).length;
    const passed = results.filter((r) => r.status === 'Passed').length;
    const failed = results.filter((r) => r.status === 'Failed').length;
    const pending = results.filter((r) => r.status === 'Pending').length;
    const avgPct = results.filter((r) => r.percentage !== null);
    const avg = avgPct.length > 0
      ? Number((avgPct.reduce((sum, r) => sum + r.percentage, 0) / avgPct.length).toFixed(1))
      : null;
    return { totalStudents, withMarks, passed, failed, pending, avg };
  }, [generated, mode, results]);

  const tableColumns = [
    { key: 'studentId', label: 'Student ID' },
    { key: 'fullName', label: 'Student Name' },
    { key: 'className', label: 'Class' },
    { key: 'totalMarks', label: 'Total' },
    { key: 'obtainedMarks', label: 'Obtained' },
    { key: 'percentage', label: 'Percentage' },
    { key: 'grade', label: 'Grade' },
    { key: 'status', label: 'Result' },
    { key: 'actions', label: 'Actions', className: 'text-right' },
  ];

  const renderRow = (record) => (
    <>
      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{record.student.studentId}</td>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900 dark:text-white">{record.student.fullName}</span>
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{record.className}</td>
      <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-white">{record.totalMarks}</td>
      <td className="px-4 py-3 text-center">
        {record.obtainedMarks !== null ? (
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{record.obtainedMarks}</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {record.percentage !== null ? (
          <span className="text-sm font-medium text-gray-900 dark:text-white">{record.percentage}%</span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold ${gradeBadgeClass(record.grade)}`}>
          {record.grade}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(record.status)}`}>
          {record.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => { setViewResult(record); setShowViewModal(true); }}
            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
            title="View Marksheet"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handlePrint(record)}
            disabled={printing}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-50"
            title="Print Marksheet"
          >
            <PrinterIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleExportPdf(record)}
            disabled={exporting}
            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
            title="Download PDF"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
          </button>
        </div>
      </td>
    </>
  );

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16">
          <div className="flex flex-col items-center justify-center gap-4">
            <Spinner size="md" className="text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Calculating results from entered marks...</p>
          </div>
        </div>
      );
    }

    if (error && !generated) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
          <Alert message={error} type="error" className="mb-4" />
          <div className="flex justify-center">
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer"
            >
              <ArrowPathIcon className="h-4 w-4" /> Try Again
            </button>
          </div>
        </div>
      );
    }

    if (generated && mode === 'individual' && result) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Marksheet Preview</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {result.student.fullName} • {result.student.studentId} • {result.className}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePrint(result)}
                disabled={printing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {printing ? <Spinner size="xs" /> : <PrinterIcon className="h-4 w-4" />} Print Marksheet
              </button>
              <button
                onClick={() => handleExportPdf(result)}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {exporting ? <Spinner size="xs" className="text-white" /> : <ArrowDownTrayIcon className="h-4 w-4" />} Download PDF
              </button>
            </div>
          </div>
          {renderMarksheet(result)}
        </div>
      );
    }

    if (generated && mode === 'class' && results.length > 0) {
      return (
        <div className="space-y-6">
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Students</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalStudents}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">With Marks</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.withMarks}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Passed</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.passed}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Failed</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.failed}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Avg. Percentage</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.avg !== null ? `${summary.avg}%` : '—'}</p>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Student Results <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({results.length})</span>
              </h2>
            </div>
            <Table columns={tableColumns} data={results} renderRow={renderRow} />
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <DocumentCheckIcon className="h-8 w-8 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Result / Marksheet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Select Academic Year, Exam and Class, then click <strong>Generate Result</strong> to view results calculated from teacher-entered marks — or search and select a specific student to generate their marksheet.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Results</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate and view student results and marksheets based on teacher-entered marks.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <DocumentCheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Select Examination Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectInput
            label="Academic Year"
            name="academicYear"
            value={academicYear || ''}
            onChange={(e) => {
              setAcademicYear(e.target.value);
              setExamId('');
              setClassName('');
              setSelectedStudent(null);
              setGenerated(false);
              setResult(null);
              setResults([]);
              setMode('');
              setError('');
            }}
            options={yearOptions.length > 0 ? yearOptions : centralYearOptions}
            placeholder="Select year"
            required
          />
          <SelectInput
            label="Exam"
            name="examId"
            value={examOptionValue}
            onChange={handleExamChange}
            options={examOptions}
            placeholder={academicYear ? 'Select exam' : 'Select year first'}
            disabled={!academicYear}
            required
          />
          <SelectInput
            label="Class"
            name="className"
            value={className}
            onChange={handleClassChange}
            options={availableClassNames}
            placeholder={examId ? 'Select class' : 'Select exam first'}
            disabled={!examId}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Student <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(optional)</span>
            </label>
            <div className="relative">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by Student ID or Name..."
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Spinner size="xs" className="text-blue-500" />
                  </span>
                )}
              </div>
              {showSuggestions && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                  {searchResults.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => selectStudent(s)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {getInitials(s.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{s.fullName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {s.studentId} • {s.class || className}
                        </p>
                      </div>
                    </button>
                  ))}
                  {!searching && searchResults.length === 0 && (
                    <p className="px-3 py-2.5 text-sm text-gray-400">No students found</p>
                  )}
                </div>
              )}
              {selectedStudent && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentQuery('');
                    setSearchResults([]);
                    setGenerated(false);
                    setResult(null);
                    setResults([]);
                    setMode('');
                    setError('');
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <XMarkIcon className="h-3.5 w-3.5" /> {selectedStudent.fullName} ({selectedStudent.studentId})
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={!academicYear || !examId || !className || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
          >
            {loading ? <Spinner size="xs" className="text-white" /> : <DocumentCheckIcon className="h-4 w-4" />} Generate Result
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowPathIcon className="h-4 w-4" /> Reset
          </button>
          {generated && (
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {selectedExam?.name || 'Exam'}{selectedExam?.type ? ` (${selectedExam.type})` : ''} • {className} • {academicYear}
            </span>
          )}
        </div>
      </div>

      {renderPreview()}

      <Modal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setViewResult(null); }}
        title="Marksheet"
        maxWidth="max-w-4xl"
      >
        {viewResult && (
          <div className="space-y-4">
            {renderMarksheet(viewResult)}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { setShowViewModal(false); setViewResult(null); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handlePrint(viewResult)}
                disabled={printing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                {printing ? <Spinner size="xs" /> : <PrinterIcon className="h-4 w-4" />} Print
              </button>
              <button
                onClick={() => handleExportPdf(viewResult)}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {exporting ? <Spinner size="xs" className="text-white" /> : <ArrowDownTrayIcon className="h-4 w-4" />} Download PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Results;