import { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon, EyeIcon, PrinterIcon, ArrowDownTrayIcon, ClockIcon, AcademicCapIcon,
} from '@heroicons/react/24/outline';
import SearchInput from '../../common/SearchInput/SearchInput';
import Table from '../../common/Table/Table';
import Modal from '../../common/Modal/Modal';
import SelectInput from '../../common/SelectInput/SelectInput';
import Alert from '../../common/Alert/Alert';
import Spinner from '../../common/Spinner/Spinner';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import examService from '../../../services/exam/exam.service';
import resultService from '../../../services/result/result.service';
import { optionId, buildIdOptions, buildIdOptionValue } from '../../../services/exam/optionUtils';
import { CLASS_NAMES } from '../../../utils/classNames';
import {
  gradeBadgeClass,
  statusBadgeClass,
  buildMarksheetHtml,
  printMarksheet,
  downloadMarksheetPdf,
} from '../shared/marksheet';
import MarksheetPreview from '../shared/MarksheetPreview';

const examLabel = (exam) => `${exam.name} (${exam.type})`;

const STATUS_OPTIONS = ['Passed', 'Failed', 'Pending'];

const ResultHistory = () => {
  const { schoolInfo, academic } = useSchoolConfig();

  const centralYear = academic?.currentYear || '';
  const centralYearOptions = centralYear ? [centralYear] : [];

  const [academicYear, setAcademicYear] = useState(() => centralYear || '');
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [className, setClassName] = useState('');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

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
      setGenerated(false);
      setResults([]);
      setError('');
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

  const handleExamChange = (e) => {
    setExamId(optionId(e.target.value));
    setClassName('');
    setGenerated(false);
    setResults([]);
    setError('');
    setSearch('');
    setFilterStatus('');
  };

  const handleClassChange = (e) => {
    setClassName(e.target.value);
    setGenerated(false);
    setResults([]);
    setError('');
    setSearch('');
    setFilterStatus('');
  };

  const handleGenerate = async () => {
    if (!academicYear || !examId || !className) return;
    setLoading(true);
    setError('');
    setGenerated(false);
    setResults([]);
    setSearch('');
    setFilterStatus('');
    try {
      const res = await resultService.getResults({ academicYear, examId, className });
      const data = res.data || {};
      setResults(data.results || []);
      setGenerated(true);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Failed to load result history';
      if (status === 404) {
        setResults([]);
        setGenerated(true);
      } else {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAcademicYear(centralYear);
    setExamId('');
    setClassName('');
    setSearch('');
    setFilterStatus('');
    setGenerated(false);
    setResults([]);
    setError('');
    setViewRecord(null);
  };

  const filteredResults = useMemo(() => {
    if (results.length === 0) return [];
    const q = search.trim().toLowerCase();
    return results.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (!q) return true;
      return (
        String(r.student?.studentId || '').toLowerCase().includes(q) ||
        String(r.student?.fullName || '').toLowerCase().includes(q)
      );
    });
  }, [results, search, filterStatus]);

  const summary = useMemo(() => {
    if (results.length === 0) return null;
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
  }, [results]);

  const buildMarksheetHtmlCb = useCallback(
    (record) => buildMarksheetHtml(record, schoolInfo),
    [schoolInfo],
  );

  const handlePrint = useCallback(
    (record) => {
      printMarksheet(buildMarksheetHtmlCb(record), setPrinting);
    },
    [buildMarksheetHtmlCb],
  );

  const handleExportPdf = useCallback(
    (record) => {
      const html = buildMarksheetHtmlCb(record);
      if (!html) return;
      const slug = record.student?.studentId || record.student?.fullName?.replace(/\s+/g, '-');
      const filename = `Marksheet-${slug}-${(record.exam?.name || 'Exam').replace(/\s+/g, '-')}-${record.academicYear}.pdf`;
      downloadMarksheetPdf(html, filename, setExporting);
    },
    [buildMarksheetHtmlCb],
  );

  const openView = (record) => {
    setViewRecord(record);
    setShowViewModal(true);
  };

  const tableColumns = [
    { key: 'studentId', label: 'Student ID' },
    { key: 'fullName', label: 'Student Name' },
    { key: 'className', label: 'Class' },
    { key: 'exam', label: 'Exam Term' },
    { key: 'academicYear', label: 'Academic Year' },
    { key: 'totalMarks', label: 'Total Marks' },
    { key: 'obtainedMarks', label: 'Obtained Marks' },
    { key: 'percentage', label: 'Overall %' },
    { key: 'grade', label: 'Grade' },
    { key: 'status', label: 'Result Status' },
    { key: 'actions', label: 'Actions', className: 'text-right' },
  ];

  const displayClassName = (rec) => rec.className || '';

  const renderRow = (record) => (
    <>
      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{record.student.studentId}</td>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900 dark:text-white">{record.student.fullName}</span>
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{displayClassName(record)}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
        {record.exam?.type || record.exam?.name || '-'}
      </td>
      <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{record.academicYear}</td>
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
            onClick={() => openView(record)}
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Result History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Browse past examination results computed from teacher-entered marks, view marksheets and export them as print or PDF.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <ClockIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Filter Result History</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <SelectInput
            label="Academic Year"
            name="academicYear"
            value={academicYear || ''}
            onChange={(e) => {
              setAcademicYear(e.target.value);
              setExamId('');
              setClassName('');
              setGenerated(false);
              setResults([]);
              setError('');
              setSearch('');
              setFilterStatus('');
            }}
            options={yearOptions.length > 0 ? yearOptions : centralYearOptions}
            placeholder="Select year"
            required
          />
          <SelectInput
            label="Exam Term"
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
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={!academicYear || !examId || !className || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
          >
            {loading ? <Spinner size="xs" className="text-white" /> : <EyeIcon className="h-4 w-4" />} View History
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

      {error && !generated && (
        <Alert message={error} type="error" />
      )}

      {generated && summary && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Results</p>
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

      {generated && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Historical Results <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({filteredResults.length})</span>
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-56">
                <SearchInput
                  placeholder="Search student ID or name..."
                  value={search}
                  onChange={(e) => setSearch(e)}
                />
              </div>
              <SelectInput
                name="filterStatus"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={STATUS_OPTIONS}
                placeholder="All Status"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 p-16">
              <Spinner size="md" className="text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading result history...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <Table columns={tableColumns} data={filteredResults} renderRow={renderRow} />
          ) : (
            <div className="py-12 text-center">
              <AcademicCapIcon className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No Result History</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                No result history available for the selected filters.
              </p>
            </div>
          )}
        </div>
      )}

      {!generated && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <AcademicCapIcon className="h-8 w-8 text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Result History</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Select an Academic Year, Exam Term and Class, then click <strong>View History</strong> to browse past examination results calculated from teacher-entered marks.
            </p>
          </div>
        </div>
      )}

      <Modal
        isOpen={showViewModal}
        onClose={() => { setShowViewModal(false); setViewRecord(null); }}
        title="Marksheet"
        maxWidth="max-w-4xl"
      >
        {viewRecord && (
          <div className="space-y-4">
            <MarksheetPreview record={viewRecord} schoolInfo={schoolInfo} />
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { setShowViewModal(false); setViewRecord(null); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handlePrint(viewRecord)}
                disabled={printing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                {printing ? <Spinner size="xs" /> : <PrinterIcon className="h-4 w-4" />} Print
              </button>
              <button
                onClick={() => handleExportPdf(viewRecord)}
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

export default ResultHistory;