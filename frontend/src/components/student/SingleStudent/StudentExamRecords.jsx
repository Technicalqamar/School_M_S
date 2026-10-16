import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AcademicCapIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import Alert from '../../common/Alert/Alert';
import Spinner from '../../common/Spinner/Spinner';
import examService from '../../../services/exam/exam.service';
import resultService from '../../../services/result/result.service';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import MarksheetPreview from '../../examManagement/shared/MarksheetPreview';
import {
  buildMarksheetHtml,
  printMarksheet,
  downloadMarksheetPdf,
  gradeBadgeClass,
  statusBadgeClass,
} from '../../examManagement/shared/marksheet';
import { EmptyState } from '../StudentProfile/shared';

// Single Student Management → "Exam Results".
//
// This is the selected student's own result, reusing the existing Results
// engine end to end: the SAME `GET /api/v1/results` individual mode
// (`result.service.js` → `GRADE_SYSTEM`, subject/total/percentage/pass-fail
// calculation) and the SAME marksheet generator/preview/print helpers used by
// the admin Examination → Results page. Nothing is recalculated in the browser
// and no exam/mark data is invented: the exam is always one that actually
// belongs to the student's class and academic year, and the server decides
// whether a result exists at all.
const StudentExamRecords = () => {
  const { student } = useOutletContext();
  const { schoolInfo, academic } = useSchoolConfig();

  const className = student?.class || '';
  const academicYear = student?.academicYear || academic?.currentYear || '';

  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [examId, setExamId] = useState('');
  const [result, setResult] = useState(null);
  const [loadingResult, setLoadingResult] = useState(true);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Exams of the student's own class and academic year. `GET /exams` filters by
  // academic year server-side; the class filter is applied on the returned list
  // (the endpoint has no class filter). State is only touched from the promise
  // callbacks, never synchronously inside the effect.
  useEffect(() => {
    if (!academicYear || !className) return undefined;
    let cancelled = false;
    examService
      .getAllExams({ academicYear, limit: 100 })
      .then((response) => {
        if (cancelled) return;
        const list = response?.data?.exams || [];
        const forClass = list.filter((exam) => (exam.classes || []).includes(className));
        setExams(forClass);
        setExamId((current) =>
          current && forClass.some((e) => e._id === current) ? current : forClass[0]?._id || '',
        );
      })
      .catch(() => {
        if (!cancelled) setExams([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingExams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [academicYear, className]);

  // The selected student's result for the selected exam, from the existing
  // individual-mode Results endpoint. Loading is reset from the exam picker
  // (an event handler); the effect only applies the response.
  useEffect(() => {
    if (!examId || !className || !academicYear || !student?.studentId) return undefined;
    let cancelled = false;
    resultService
      .getResults({
        studentId: student._id || student.studentId,
        className,
        examId,
        academicYear,
      })
      .then((response) => {
        if (cancelled) return;
        const data = response?.data || {};
        setResult(data.mode === 'individual' ? data.result : null);
        setError('');
      })
      .catch((err) => {
        if (cancelled) return;
        setResult(null);
        setError(err?.response?.data?.message || 'Could not load this student’s result.');
      })
      .finally(() => {
        if (!cancelled) setLoadingResult(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examId, className, academicYear, student]);

  const marksheetHtml = useMemo(
    () => (result ? buildMarksheetHtml(result, schoolInfo) : ''),
    [result, schoolInfo],
  );

  const handlePrint = () => printMarksheet(marksheetHtml, setPrinting);

  const handleExportPdf = () => {
    if (!marksheetHtml) return;
    const slug = result.student?.studentId || result.student?.fullName?.replace(/\s+/g, '-') || 'student';
    const filename = `Marksheet-${slug}-${(result.exam?.name || 'Exam').replace(/\s+/g, '-')}-${result.academicYear}.pdf`;
    downloadMarksheetPdf(marksheetHtml, filename, setExporting);
  };

  if (!student) return null;

  if (!className || !academicYear) {
    return (
      <EmptyState
        icon={AcademicCapIcon}
        title="Exam results are not available"
        message="This student has no class/academic year recorded, so no exam result can be looked up."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <AcademicCapIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Exam Results
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {student.fullName} ({student.studentId}) — Class {className} · {academicYear}
          </p>
        </div>
        {exams.length > 0 ? (
          <div className="relative">
            <select
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setLoadingResult(true);
                setResult(null);
                setError('');
              }}
              className="appearance-none w-full sm:w-64 px-4 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {exams.map((exam) => (
                <option key={exam._id} value={exam._id}>
                  {exam.name} ({exam.type})
                </option>
              ))}
            </select>
            <ChevronDownIcon className="h-4 w-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        ) : null}
      </div>

      {loadingExams ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          icon={AcademicCapIcon}
          title="No exams for this class"
          message={`No exam has been set up for Class ${className} in ${academicYear} yet.`}
        />
      ) : loadingResult ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <Alert type="info" message={error} />
      ) : !result ? (
        <Alert type="info" message="No result is available for the selected exam." />
      ) : (
        <>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    <th className="px-4 py-2.5">Subject</th>
                    <th className="px-4 py-2.5 text-center">Total</th>
                    <th className="px-4 py-2.5 text-center">Obtained</th>
                    <th className="px-4 py-2.5 text-center">%</th>
                    <th className="px-4 py-2.5 text-center">Grade</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.subjectResults || []).map((subject) => (
                    <tr
                      key={subject.subjectCode || subject.subjectName}
                      className="border-b border-gray-50 dark:border-gray-800"
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-gray-900 dark:text-white">{subject.subjectName}</span>
                        {subject.subjectCode ? (
                          <span className="text-xs text-gray-400 ml-1">({subject.subjectCode})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-300">
                        {subject.totalMarks}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-gray-900 dark:text-white">
                        {subject.entered ? subject.obtainedMarks : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600 dark:text-gray-300">
                        {subject.entered ? `${subject.percentage}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${gradeBadgeClass(subject.grade)}`}
                        >
                          {subject.grade}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {subject.entered ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              subject.passed
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}
                          >
                            {subject.passed ? 'Pass' : 'Fail'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Not entered</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-900/40 font-semibold">
                    <td className="px-4 py-2.5 text-gray-900 dark:text-white">Total</td>
                    <td className="px-4 py-2.5 text-center text-gray-900 dark:text-white">{result.totalMarks}</td>
                    <td className="px-4 py-2.5 text-center text-gray-900 dark:text-white">
                      {result.obtainedMarks !== null ? result.obtainedMarks : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-900 dark:text-white">
                      {result.percentage !== null ? `${result.percentage}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${gradeBadgeClass(result.grade)}`}
                      >
                        {result.grade}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(result.status)}`}
                      >
                        {result.status}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {!result.allEntered ? (
            <Alert
              type="warning"
              message="Some subjects have no marks entered yet, so the total, percentage and overall result are not final."
            />
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing || !marksheetHtml}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <PrinterIcon className="h-4 w-4" />
              Print Marksheet
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting || !marksheetHtml}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {exporting ? 'Preparing…' : 'Download PDF'}
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/40 overflow-x-auto">
            <MarksheetPreview record={result} schoolInfo={schoolInfo} />
          </div>
        </>
      )}
    </div>
  );
};

export default StudentExamRecords;
