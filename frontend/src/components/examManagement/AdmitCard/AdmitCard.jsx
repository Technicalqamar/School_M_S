import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  CalendarDaysIcon,
  ClockIcon,
  IdentificationIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import SelectInput from '../../common/SelectInput/SelectInput';
import Alert from '../../common/Alert/Alert';
import Spinner from '../../common/Spinner/Spinner';
import examService from '../../../services/exam/exam.service';
import admitCardService from '../../../services/admitCard/admitCard.service';
import studentService from '../../../services/student/student.service';
import { optionId, buildIdOptions, buildIdOptionValue } from '../../../services/exam/optionUtils';
import { CLASS_NAMES } from '../../../utils/classNames';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { getImageUrl } from '../../../utils/imageUrl';
import {
  formatTime,
  formatDate,
  formatDay,
  getInitials,
  getSubjectName,
  buildAdmitCardPrintableHtml,
  buildAdmitCardsPrintableHtml,
  printHtml,
  downloadAdmitCardPdf,
} from '../shared/admitCardHtml';

const examLabel = (exam) => `${exam.name} (${exam.type})`;

const AdmitCard = () => {
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
  const [admit, setAdmit] = useState(null);
  const [bulkCards, setBulkCards] = useState([]);
  const [generatedMode, setGeneratedMode] = useState('');
  const generatedKeysRef = useRef(new Set());
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);

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
      setAdmit(null);
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
    setAdmit(null);
    setBulkCards([]);
    setGeneratedMode('');
    setError('');
  };

  const showSuggestions =
    !!studentQuery.trim() && searchResults.length > 0 && (inputFocused || hasSearched);

  const handleExamChange = (e) => {
    setExamId(optionId(e.target.value));
    setClassName('');
    setSelectedStudent(null);
    setGenerated(false);
    setAdmit(null);
    setBulkCards([]);
    setGeneratedMode('');
    setError('');
  };

  const handleClassChange = (e) => {
    setClassName(e.target.value);
    setSelectedStudent(null);
    setGenerated(false);
    setAdmit(null);
    setBulkCards([]);
    setGeneratedMode('');
    setError('');
  };

  const handleGenerate = async () => {
    if (!academicYear || !examId || !className) return;
    setLoading(true);
    setError('');
    setGenerated(false);
    setAdmit(null);
    setBulkCards([]);
    setGeneratedMode('');
    try {
      const params = { academicYear, examId, className };
      if (selectedStudent) {
        params.studentId = selectedStudent.studentId;
      }
      const res = await admitCardService.getAdmitCard(params);
      const data = res.data || {};
      if (data.mode === 'class') {
        const cards = data.admitCards || [];
        const key = `${academicYear}::${examId}::${className}`;
        const existingKeys = generatedKeysRef.current;
        const processed = cards.map((card) => {
          const cardKey = `${key}::${card.student.studentId}`;
          const already = existingKeys.has(cardKey);
          existingKeys.add(cardKey);
          return { ...card, generationStatus: already ? 'Already Generated' : 'Generated' };
        });
        setBulkCards(processed);
        setGeneratedMode('class');
        setGenerated(true);
      } else {
        const admitCard = data.admitCard || null;
        if (admitCard) {
          const cardKey = `${academicYear}::${examId}::${className}::${admitCard.student.studentId}`;
          generatedKeysRef.current.add(cardKey);
        }
        setAdmit(admitCard);
        setGeneratedMode('individual');
        setGenerated(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate the admit card';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setExamId('');
    setClassName('');
    setStudentQuery('');
    setSearchResults([]);
    setSelectedStudent(null);
    setGenerated(false);
    setAdmit(null);
    setBulkCards([]);
    setGeneratedMode('');
    setError('');
  };

  const handlePrint = useCallback(async () => {
    if (!admit) return;
    setPrinting(true);
    try {
      printHtml(buildAdmitCardPrintableHtml(admit, schoolInfo));
    } finally {
      setPrinting(false);
    }
  }, [admit, schoolInfo]);

  const handlePrintCard = useCallback(
    async (admitCard) => {
      if (!admitCard) return;
      setPrinting(true);
      try {
        printHtml(buildAdmitCardPrintableHtml(admitCard, schoolInfo));
      } finally {
        setPrinting(false);
      }
    },
    [schoolInfo],
  );

  const handlePrintAll = useCallback(async () => {
    if (!bulkCards.length) return;
    setPrinting(true);
    try {
      printHtml(buildAdmitCardsPrintableHtml(bulkCards, schoolInfo));
    } finally {
      setPrinting(false);
    }
  }, [bulkCards, schoolInfo]);

  const handleDownloadPdf = useCallback(async () => {
    if (!admit) return;
    setExporting(true);
    try {
      const html = buildAdmitCardPrintableHtml(admit, schoolInfo);
      const filename = `AdmitCard-${admit.student.studentId || 'student'}-${(admit.exam?.name || 'exam').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
      await downloadAdmitCardPdf(html, filename);
      toast.success('Admit card PDF downloaded');
    } catch {
      toast.error('PDF download failed. Try the Print option instead.');
    } finally {
      setExporting(false);
    }
  }, [admit, schoolInfo]);

  const isGenerateDisabled = !academicYear || !examId || !className;

  const renderAdmitCard = () => {
    if (!admit) return null;
    const { student, schedules, exam, academicYear: year, className: cls } = admit;
    const addressParts = [schoolInfo.address, schoolInfo.city, schoolInfo.province]
      .filter(Boolean)
      .join(', ');
    const schoolAddress = [addressParts, schoolInfo.country].filter(Boolean).join(', ');
    const contactLine = [schoolInfo.contact, schoolInfo.email, schoolInfo.website]
      .filter(Boolean)
      .join('  •  ');
    const photoUrl = getImageUrl(student.studentImage);

    return (
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-5 text-white text-center">
          {schoolInfo.logo && (
            <img src={getImageUrl(schoolInfo.logo)} alt="School logo" className="h-14 w-14 object-contain mx-auto mb-2" />
          )}
          <h2 className="text-xl font-bold">{schoolInfo.name || 'School Name'}</h2>
          <p className="text-xs text-blue-100 mt-1">
            {[schoolAddress, schoolInfo.registrationNumber ? `Reg. No: ${schoolInfo.registrationNumber}` : ''].filter(Boolean).join('  •  ')}
          </p>
          {contactLine && <p className="text-xs text-blue-100 mt-0.5">{contactLine}</p>}
          {schoolInfo.principalName && <p className="text-xs text-blue-100 mt-0.5">Principal: {schoolInfo.principalName}</p>}
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 px-4 py-2.5 mb-6">
            <span className="text-sm sm:text-base font-bold tracking-widest text-blue-700 dark:text-blue-400 uppercase">
              Admit Card
            </span>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 text-right">
              <strong>{exam?.name || 'Exam'}</strong> • Year: {year}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-5 mb-6">
            <div className="shrink-0 mx-auto sm:mx-0 w-28 h-32 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="Student photo"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                  {getInitials(student.fullName || 'S')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Student Name</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{student.fullName || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Father's Name</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{student.fatherName || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Student ID</p>
                <p className="text-sm font-semibold font-mono text-gray-900 dark:text-white">{student.studentId || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Class</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{cls}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Academic Year</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{year}</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">Exam</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{exam?.name || '-'}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
              <CalendarDaysIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Exam Schedule
            </h3>
            {schedules.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Day</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Exam / Subject</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Start Time</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">End Time</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Teacher Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((s, idx) => (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{formatDate(s.examDate)}</td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{formatDay(s.examDate)}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{getSubjectName(s)}</td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{formatTime(s.startTime)}</td>
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{formatTime(s.endTime)}</td>
                        <td className="px-4 py-2.5">
                          <div className="h-9 w-full rounded border border-dashed border-gray-300 dark:border-gray-600"></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                No exam schedule has been published for this exam and class yet.
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
            <div className="border-t border-gray-300 dark:border-gray-600 pt-2">Student Signature</div>
            <div className="border-t border-gray-300 dark:border-gray-600 pt-2">Class Teacher</div>
            <div className="border-t border-gray-300 dark:border-gray-600 pt-2">Exam Controller</div>
          </div>
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-16">
          <div className="flex flex-col items-center justify-center gap-4">
            <Spinner size="md" className="text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Generating admit card...</p>
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <ArrowPathIcon className="h-4 w-4" /> Retry
            </button>
          </div>
        </div>
      );
    }

    if (generated && generatedMode === 'class' && bulkCards.length > 0) {
      const generatedCount = bulkCards.filter((c) => c.generationStatus === 'Generated').length;
      const existingCount = bulkCards.filter((c) => c.generationStatus === 'Already Generated').length;
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Generated Admit Cards — {className} <span className="text-gray-400 font-normal">•</span> {selectedExam?.name} <span className="text-gray-400 font-normal">•</span> {academicYear}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {generatedCount} generated{existingCount > 0 ? ` • ${existingCount} already generated` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <XMarkIcon className="h-4 w-4" /> Close
              </button>
              <button
                onClick={handlePrintAll}
                disabled={printing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {printing ? <Spinner size="xs" className="text-white" /> : <PrinterIcon className="h-4 w-4" />} Print All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student ID</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Student Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Class</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Generation Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Print</th>
                </tr>
              </thead>
              <tbody>
                {bulkCards.map((card, idx) => (
                  <tr key={`${card.student.studentId}-${idx}`} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-gray-900 dark:text-white">{card.student.studentId}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{card.student.fullName}</td>
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{card.className}</td>
                    <td className="px-4 py-2.5">
                      {card.generationStatus === 'Already Generated' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                          Already Generated
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          Generated
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handlePrintCard(card)}
                        disabled={printing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {printing ? <Spinner size="xs" /> : <PrinterIcon className="h-3.5 w-3.5" />} Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (generated && generatedMode === 'individual' && admit) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <XMarkIcon className="h-4 w-4" /> Close
            </button>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {printing ? <Spinner size="xs" /> : <PrinterIcon className="h-4 w-4" />} Print Admit Card
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {exporting ? <Spinner size="xs" className="text-white" /> : <ArrowDownTrayIcon className="h-4 w-4" />} Download PDF
            </button>
          </div>
          {renderAdmitCard()}
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <IdentificationIcon className="h-8 w-8 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Admit Card Preview</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Select Academic Year, Exam and Class, then click <strong>Generate Admit Card</strong> to generate admit cards for all active students of the class — or search and select a specific student to generate a single admit card.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admit Card</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate admission cards for students with their examination date sheet.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <CheckBadgeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
              setAdmit(null);
              setBulkCards([]);
              setGeneratedMode('');
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
              Student <span className="text-red-500">*</span>
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
                          {s.studentId} • Class {s.class || className}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setGenerated(false);
                    setAdmit(null);
                    setError('');
                  }}
                  className="w-full flex items-center gap-2 mt-1.5 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 text-left hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                    {getInitials(selectedStudent.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">{selectedStudent.fullName}</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 truncate">
                      {selectedStudent.studentId} • Class {selectedStudent.class || className}
                    </p>
                  </div>
                  <XMarkIcon className="h-4 w-4 text-blue-500 shrink-0" />
                </button>
              )}
              {hasSearched && !searching && searchResults.length === 0 && !selectedStudent && studentQuery.trim() && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">No students found matching your search.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button
            onClick={handleGenerate}
            disabled={isGenerateDisabled}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap"
          >
            <BookOpenIcon className="h-4 w-4" /> Generate Admit Card
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowPathIcon className="h-4 w-4" /> Reset
          </button>
          {generated && selectedExam && (
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
              <ClockIcon className="h-4 w-4 inline -mt-0.5 mr-1" />
              {selectedExam.name} • {className} • {academicYear}
            </span>
          )}
        </div>
      </div>

      {renderPreview()}
    </div>
  );
};

export default AdmitCard;