import { useState, useEffect, useMemo } from 'react';
import {
  AcademicCapIcon,
  EyeIcon,
  UserGroupIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import Button from '../../components/common/Button/Button';
import Spinner from '../../components/common/Spinner/Spinner';
import Modal from '../../components/common/Modal/Modal';
import MarksheetPreview from '../../components/examManagement/shared/MarksheetPreview';
import {
  gradeBadgeClass,
  statusBadgeClass,
  buildMarksheetHtml,
  printMarksheet,
  downloadMarksheetPdf,
} from '../../components/examManagement/shared/marksheet';
import { useSchoolConfig } from '../../contexts/SchoolConfigContext';
import myResultsService from '../../services/teacher/myResults.service';

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-12">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

const subjectStatus = (subject) => {
  if (!subject || !subject.entered) return 'Pending';
  return subject.passed ? 'Passed' : 'Failed';
};

const MyResults = () => {
  const { schoolInfo } = useSchoolConfig();

  const [exams, setExams] = useState([]);
  const [assignedClasses, setAssignedClasses] = useState([]);

  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState(null);

  const [selectedClassName, setSelectedClassName] = useState('');
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState('');

  const [records, setRecords] = useState([]);
  const [loadingScopes, setLoadingScopes] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState('');

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    myResultsService
      .getScopes()
      .then(({ exams: fetched, classes }) => {
        setExams(fetched || []);
        setAssignedClasses(classes || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load results.');
      })
      .finally(() => setLoadingScopes(false));
  }, []);

  const academicYears = useMemo(
    () => Array.from(new Set((exams || []).map((exam) => exam.academicYear))).sort(),
    [exams],
  );

  const handleYearChange = (value) => {
    setSelectedYear(value);
    setSelectedTerm('');
    setSelectedExam(null);
    setSelectedClassName('');
    setSubjectOptions([]);
    setSelectedSubjectId('');
    setSelectedSubjectName('');
    setRecords([]);
    setError('');
  };

  const termOptions = useMemo(() => {
    if (!selectedYear) return [];
    const types = (exams || [])
      .filter((exam) => String(exam.academicYear) === String(selectedYear))
      .map((exam) => exam.type);
    return Array.from(new Set(types));
  }, [exams, selectedYear]);

  const handleTermChange = (value) => {
    setSelectedTerm(value);

    const matched =
      (exams || []).find(
        (exam) =>
          String(exam.academicYear) === String(selectedYear) && String(exam.type) === String(value),
      ) || null;

    setSelectedExam(matched);
    setSelectedClassName('');
    setSubjectOptions([]);
    setSelectedSubjectId('');
    setSelectedSubjectName('');
    setRecords([]);
    setError('');
  };

  const classOptions = useMemo(() => {
    if (!selectedExam) return [];
    const examClassNames = new Set((selectedExam.classes || []).map((c) => String(c)));
    return (assignedClasses || [])
      .map((cls) => String(cls.className))
      .filter((name) => examClassNames.has(name));
  }, [selectedExam, assignedClasses]);

  const handleClassChange = (value) => {
    setSelectedClassName(value);
    setSelectedSubjectId('');
    setSelectedSubjectName('');
    setSubjectOptions([]);
    setRecords([]);
    setError('');

    if (!selectedExam || !value) return;

    setLoadingSubjects(true);

    myResultsService
      .getExamSubjectsConfig({ examId: selectedExam.examId, className: value })
      .then(({ subjects }) => {
        setSubjectOptions(subjects || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load subjects.');
      })
      .finally(() => setLoadingSubjects(false));
  };

  const handleSearch = () => {
    if (!selectedExam || !selectedClassName || !selectedSubjectId) {
      setError('Please select an academic year, exam term, class and subject.');
      return;
    }

    setLoadingResults(true);
    setError('');
    setRecords([]);

    myResultsService
      .searchResults({
        examId: selectedExam.examId,
        className: selectedClassName,
        subjectId: selectedSubjectId,
        academicYear: selectedYear,
      })
      .then((result) => {
        const subject = (subjectOptions || []).find(
          (item) => String(item.subjectId) === String(selectedSubjectId),
        );
        setSelectedSubjectName(subject?.subjectName || '');
        setRecords(result.results || []);
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Failed to load results.';
        setError(msg);
        toast.error(msg);
        setRecords([]);
      })
      .finally(() => setLoadingResults(false));
  };

  const handleReset = () => {
    setSelectedYear('');
    setSelectedTerm('');
    setSelectedExam(null);
    setSelectedClassName('');
    setSubjectOptions([]);
    setSelectedSubjectId('');
    setSelectedSubjectName('');
    setRecords([]);
    setError('');
  };

  const selectCls =
    'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  const canSearch = Boolean(selectedExam && selectedClassName && selectedSubjectId && !loadingSubjects);

  const rows = useMemo(
    () =>
      (records || []).map((record) => {
        const subject =
          (record.subjectResults || []).find(
            (s) => String(s.subjectId) === String(selectedSubjectId),
          ) || null;
        return {
          id: String(record.student?._id || ''),
          studentId: record.student?.studentId || '',
          fullName: record.student?.fullName || '',
          className: record.className || '',
          subjectName: subject?.subjectName || selectedSubjectName || '',
          totalMarks: subject?.totalMarks ?? 0,
          obtainedMarks: subject?.obtainedMarks ?? null,
          percentage: subject?.percentage ?? null,
          grade: subject?.grade || '-',
          status: subjectStatus(subject),
        };
      }),
    [records, selectedSubjectId, selectedSubjectName],
  );

  const buildRecordMarksheet = (record) => buildMarksheetHtml(record, schoolInfo);

  const handlePrint = (record) => {
    if (printing) return;
    printMarksheet(buildRecordMarksheet(record), setPrinting);
  };

  const handleExportPdf = async (record) => {
    if (exporting) return;
    const html = buildRecordMarksheet(record);
    if (!html) return;
    const slug = record.student?.studentId || (record.student?.fullName || 'student').replace(/\s+/g, '-');
    const filename = `Marksheet-${slug}-${(record.exam?.name || 'Exam').replace(/\s+/g, '-')}-${record.academicYear}.pdf`;
    await downloadMarksheetPdf(html, filename, setExporting);
  };

  const openView = (record) => {
    setViewRecord(record);
    setShowViewModal(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Results</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View results for your assigned classes and subjects.
        </p>
        {selectedExam?.name && (
          <p className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400">
            {selectedExam.name}
            {selectedSubjectName ? ` - ${selectedSubjectName}` : ''}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <CardSection title="Select Filters">
        {loadingScopes ? (
          <div className="flex justify-center py-10">
            <Spinner size="lg" />
          </div>
        ) : exams.length === 0 ? (
          <EmptyState
            icon={AcademicCapIcon}
            title="No exams available"
            description="No exams are available for your assigned classes yet."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Academic Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Select year</option>
                  {(academicYears || []).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Exam Term
                </label>
                <select
                  value={selectedTerm}
                  onChange={(e) => handleTermChange(e.target.value)}
                  className={selectCls}
                  disabled={!selectedYear}
                >
                  <option value="">Select term</option>
                  {(termOptions || []).map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Class
                </label>
                <select
                  value={selectedClassName}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className={selectCls}
                  disabled={!selectedExam}
                >
                  <option value="">Select class</option>
                  {(classOptions || []).map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Subject
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    const subject = (subjectOptions || []).find(
                      (item) => String(item.subjectId) === String(e.target.value),
                    );
                    setSelectedSubjectId(e.target.value);
                    setSelectedSubjectName(subject?.subjectName || '');
                    setRecords([]);
                  }}
                  className={selectCls}
                  disabled={!selectedClassName || loadingSubjects}
                >
                  <option value="">Select subject</option>
                  {(subjectOptions || []).map((subject) => (
                    <option key={String(subject.subjectId)} value={String(subject.subjectId)}>
                      {subject.subjectName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleSearch} disabled={!canSearch || loadingResults}>
                {loadingResults ? 'Loading...' : 'View Results'}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
              {loadingSubjects && <Spinner size="xs" />}
              {selectedSubjectName && subjectOptions.length > 0 && (
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {selectedClassName} - {selectedSubjectName}
                </span>
              )}
            </div>
          </div>
        )}
      </CardSection>

      {loadingResults ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : rows.length > 0 ? (
        <CardSection title="Results">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {rows.length} student result(s) for {selectedClassName} - {selectedSubjectName}
            </p>
            <Button variant="outline" onClick={handleSearch} disabled={loadingResults}>
              <ArrowPathIcon className="mr-1.5 h-4 w-4 inline-block" /> Refresh
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Student ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Student Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Class
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Total Marks
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Obtained Marks
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Percentage
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Grade
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {row.studentId}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {row.fullName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {row.className}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {row.subjectName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                      {row.totalMarks}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                      {row.obtainedMarks === null ? '-' : row.obtainedMarks}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                      {row.percentage === null ? '-' : `${row.percentage}%`}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold ${gradeBadgeClass(row.grade)}`}
                      >
                        {row.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => {
                          const record = (records || []).find((r) => String(r.student?._id) === String(row.id));
                          if (record) openView(record);
                        }}
                      >
                        <EyeIcon className="mr-1.5 h-4 w-4 inline-block" /> View Result
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardSection>
      ) : (
        canSearch &&
        !loadingResults && (
          <CardSection>
            <EmptyState
              icon={UserGroupIcon}
              title="No results yet"
              description="Select the filters above and click View Results. Results will appear here once marks have been entered."
            />
          </CardSection>
        )
      )}

      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewRecord(null);
        }}
        title="Marksheet"
        maxWidth="max-w-4xl"
      >
        {viewRecord && (
          <div className="space-y-4">
            <MarksheetPreview record={viewRecord} schoolInfo={schoolInfo} />
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewRecord(null);
                }}
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

export default MyResults;