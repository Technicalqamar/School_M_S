import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from '../../../hooks/useLocalization';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon, XCircleIcon, UserGroupIcon,
  PrinterIcon, DocumentArrowDownIcon, DocumentCheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import StatCard from '../../common/StatCard/StatCard';
import SearchInput from '../../common/SearchInput/SearchInput';
import Modal from '../../common/Modal/Modal';
import { CLASS_NAMES } from '../../../utils/classNames';
import { resolveCurrentAcademicYear, useAcademicYear } from '../../../utils/academicYear';
import {
  buildDesignPayload,
  extractSavedDesign,
  resolveDesignTargets,
} from '../../../utils/idCardDesign';
import { VerticalTemplate, HorizontalTemplate } from '../templates';
import { getInitials } from '../templates/shared/cardHtmlUtils';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { useAuth } from '../../../contexts/AuthContext';
import { hasReceptionistActionAccess } from '../../../constants/receptionistPermissions';
import { getImageUrl } from '../../../utils/imageUrl';
import Spinner from '../../common/Spinner/Spinner';
import qrManagementService from '../../../services/qrManagement/qrManagement.service';
import teacherService from '../../../services/teacher/teacher.service';

const CARD_STATUSES = ['All', 'Pending', 'Generated', 'Printed'];

const PAGE_SIZE = 10;


const CloseSvg = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const PaintSvg = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>;


const IDCardManagement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { schoolInfo, academic } = useSchoolConfig();
  // Generating, re-issuing and printing cards are `id-card-generate` operations
  // on the backend. Viewing stays available with `id-card-view` only.
  const canGenerate = hasReceptionistActionAccess(user, 'attendance-management', 'id-card-generate');
  const SCHOOL_INFO = {
    name: schoolInfo.name,
    address: schoolInfo.address || schoolInfo.schoolAddress || 'N/A',
    contact: schoolInfo.contact || schoolInfo.schoolContact || 'N/A',
    email: schoolInfo.email || schoolInfo.schoolEmail || 'N/A',
  };

  const [allStudents, setAllStudents] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  // Current Academic Year from School Settings (or the calendar year), never a
  // hardcoded value.
  const currentYear = resolveCurrentAcademicYear(academic?.currentYear);
  const { year: academicYear, setYear: setAcademicYear } = useAcademicYear(academic?.currentYear);
  const [cardType, setCardType] = useState('Student');
  const [className, setClassName] = useState('All Classes');
  const [search, setSearch] = useState('');
  const [cardFilter, setCardFilter] = useState('All');

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [previewStudent, setPreviewStudent] = useState(null);
  const [previewSide, setPreviewSide] = useState('front');
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [savedTemplate, setSavedTemplate] = useState(null);
  const [designerPreviewSide, setDesignerPreviewSide] = useState('front');
  const DEFAULT_VISIBILITY = {
  schoolLogo: true, schoolName: true, studentPhoto: true, studentName: true,
  fatherName: true, studentId: true, class: true, academicYear: true, qrCode: true,
  fatherPhone: true, schoolAddress: true, note: true,
};

const DEFAULT_CONFIG = { cardWidth: 320, cardHeight: 0, cardPadding: 16, borderRadius: 12, photoSize: 80, photoShape: 'circle', qrSize: 140, qrPosition: 'center', nameFontSize: 16, detailsFontSize: 12, fontWeight: 700, primaryColor: '#2563eb', secondaryColor: '#1e40af', textColor: '#1f2937', cardBgColor: '#ffffff', visibility: { ...DEFAULT_VISIBILITY } };
  const [savedDesignerConfig, setSavedDesignerConfig] = useState(null);
  const [frontConfig, setFrontConfig] = useState(() => ({ ...DEFAULT_CONFIG }));
  const [backConfig, setBackConfig] = useState(() => ({ ...DEFAULT_CONFIG }));
  const panelRef = useRef(null);
  const activeTemplate = savedTemplate || selectedTemplate || 'vertical';
  const activeConfig = designerPreviewSide === 'front' ? frontConfig : backConfig;
  const setActiveConfig = designerPreviewSide === 'front' ? setFrontConfig : setBackConfig;

  const setConfigProp = (key, value) => {
    setActiveConfig((prev) => ({ ...prev, [key]: value }));
    if (key === 'cardWidth' || key === 'cardHeight' || key === 'cardPadding' || key === 'borderRadius') {
      const otherSetter = designerPreviewSide === 'front' ? setBackConfig : setFrontConfig;
      otherSetter((prev) => ({ ...prev, [key]: value }));
    }
  };
  const setVisibilityProp = (key, checked) => setActiveConfig((prev) => ({ ...prev, visibility: { ...prev.visibility, [key]: checked } }));

  useEffect(() => {
    if (!designerOpen) return;
    if (savedDesignerConfig) {
      const { cardWidth, cardHeight } = savedDesignerConfig.front;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFrontConfig({ ...savedDesignerConfig.front, cardWidth, cardHeight });
      setBackConfig({ ...savedDesignerConfig.back, cardWidth, cardHeight });
    }
  }, [designerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizeTeacherCard = (teacher) => ({
    ...teacher,
    id: teacher._id || teacher.id,
    _id: teacher._id || teacher.id,
    fullName: teacher.fullName || 'Teacher',
    studentId: teacher.teacherId || teacher.studentId || teacher.id,
    teacherId: teacher.teacherId || teacher.studentId || teacher.id,
    fatherName: teacher.fatherName || '—',
    fatherPhone: teacher.phoneNumber || teacher.alternatePhoneNumber || '—',
    academicYear: teacher.academicYear || academicYear || currentYear,
    class: teacher.class || 'Teacher',
    qrValue: teacher.qrValue || `QR-${teacher.teacherId || teacher.studentId || teacher.id}`,
    qrStatus: teacher.qrStatus || 'Generated',
    cardStatus: teacher.cardStatus || 'Pending',
    personType: 'Teacher',
  });

  const allCardRecords = useMemo(() => {
    if (cardType === 'Teacher') {
      return allTeachers.map(normalizeTeacherCard);
    }
    return allStudents.map((student) => ({
      ...student,
      id: student.id || student._id,
      _id: student._id || student.id,
      personType: 'Student',
    }));
  }, [allStudents, allTeachers, academicYear, cardType]);

  const getCardStatus = (student) => {
    if (student.cardStatus === 'Printed') return 'Printed';
    if (student.qrStatus === 'Generated' || student.qrValue) return 'Generated';
    return 'Pending';
  };

  const filtered = useMemo(() => {
    let list = allCardRecords;
    if (academicYear) list = list.filter((s) => s.academicYear === academicYear);
    if (cardType !== 'Teacher' && className && className !== 'All Classes') {
      list = list.filter((s) => s.class === className);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => (s.fullName || '').toLowerCase().includes(q) || (s.studentId || '').toLowerCase().includes(q));
    }
    if (cardFilter !== 'All') list = list.filter((s) => getCardStatus(s) === cardFilter);
    return list;
  }, [allCardRecords, academicYear, className, search, cardFilter, cardType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const designerPreviewStudent = useMemo(() => {
    if (!designerOpen) return null;
    if (filtered.length > 0) return filtered[0];
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designerOpen]);

  const paginatedStudents = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const stats = useMemo(() => {
    const source = cardType === 'Teacher' ? allTeachers : allStudents;
    const total = source.length;
    const generated = source.filter((s) => s.qrStatus === 'Generated' || s.cardStatus === 'Generated').length;
    const printed = source.filter((s) => s.cardStatus === 'Printed').length;
    const pending = total - generated - printed;
    return { total, generated, printed, pending };
  }, [allStudents, allTeachers, cardType]);

  const selectAll = () => {
    if (selectedIds.size === paginatedStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedStudents.map((s) => s.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLoadStudents = async () => {
    if (!academicYear) {
      toast.error(t('selectAcademicYearAndClass'));
      return;
    }
    setLoading(true);
    setCurrentPage(1);
    setSelectedIds(new Set());
    try {
      if (cardType === 'Teacher') {
        const response = await teacherService.getAllTeachers({
          status: 'Active',
          limit: 500,
        });
        const teachers = (response?.data?.teachers || response?.teachers || []).map((teacher) => ({
          ...teacher,
          id: teacher._id || teacher.id,
          teacherImage: teacher.teacherImage || teacher.profileImage,
          fullName: teacher.fullName || 'Teacher',
          studentId: teacher.teacherId || teacher.studentId || teacher.id,
          teacherId: teacher.teacherId || teacher.studentId || teacher.id,
          academicYear: teacher.academicYear || academicYear || currentYear,
          qrValue: teacher.qrValue || `QR-${teacher.teacherId || teacher.studentId || teacher.id}`,
          qrStatus: teacher.qrStatus || 'Generated',
          cardStatus: teacher.cardStatus || 'Pending',
          class: teacher.class || 'Teacher',
          personType: 'Teacher',
        }));
        setAllTeachers(teachers);
        setAllStudents([]);
        if (teachers.length === 0) {
          toast('No teachers loaded for this academic year', { icon: 'ℹ️' });
        } else {
          toast.success(`${teachers.length} teachers loaded successfully`);
        }
        return;
      }

      const result = await qrManagementService.getStudentsWithCards({
        academicYear,
        class: className,
      });
      const students = result.students || [];
      setAllStudents(students);
      setAllTeachers([]);
      // Restore the design previously saved for these cards. The designer is a
      // single layout for the whole working set, so any card carrying a saved
      // design defines the layout shown in the designer and used for printing.
      const savedDesign = extractSavedDesign(students);
      if (savedDesign) {
        const front = { ...DEFAULT_CONFIG, ...(savedDesign.frontDesign || {}) };
        const back = { ...DEFAULT_CONFIG, ...(savedDesign.backDesign || {}) };
        setFrontConfig(front);
        setBackConfig(back);
        setSelectedTemplate(savedDesign.template);
        setSavedTemplate(savedDesign.template);
        setSavedDesignerConfig({ front, back });
      }
      if (students.length === 0) {
        toast(t('noStudentsLoaded'), { icon: 'ℹ️' });
      } else {
        toast.success(`${students.length} ${t('studentsLoadedSuccessfully')}`);
      }
    } catch (err) {
      setAllStudents([]);
      setAllTeachers([]);
      toast.error(err?.response?.data?.message || `Failed to load ${cardType === 'Teacher' ? 'teachers' : 'students'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!academicYear) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) handleLoadStudents();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear, className, cardType]);

  const handleGenerateMissingCards = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (cardType === 'Teacher') {
        const teachers = allTeachers.map((teacher) => ({
          ...teacher,
          qrValue: `QR-${teacher.teacherId}`,
          qrStatus: 'Generated',
          cardStatus: 'Generated',
        }));
        setAllTeachers(teachers);
        toast.success(`${teachers.length} teacher QR code${teachers.length !== 1 ? 's' : ''} generated`);
        return;
      }

      const result = await qrManagementService.generateQRCodes({
        academicYear,
        class: className === 'All Classes' ? undefined : className,
      });
      const generatedCount = result?.generatedCount || 0;
      if (generatedCount > 0) {
        toast.success(`${generatedCount} QR code${generatedCount !== 1 ? 's' : ''} generated`);
      } else {
        toast('All selected students already have QR codes', { icon: 'ℹ️' });
      }
      await handleLoadStudents();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to generate QR codes');
    } finally {
      setActionBusy(false);
    }
  };

  const handlePrintAll = () => {
    handlePrintCards(filtered);
  };

  const handleMarkAsPrinted = async () => {
    const toMark = selectedIds.size
      ? filtered.filter((s) => selectedIds.has(s.id))
      : [];
    if (!toMark.length) { toast.error(`No ${cardType.toLowerCase()}s selected`); return; }
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (cardType === 'Teacher') {
        setAllTeachers((teachers) => teachers.map((teacher) => toMark.some((item) => (item.id || item._id) === (teacher._id || teacher.id))
          ? { ...teacher, cardStatus: 'Printed', qrStatus: 'Generated', qrValue: teacher.qrValue || `QR-${teacher.teacherId}` }
          : teacher));
        toast.success(`${toMark.length} card${toMark.length !== 1 ? 's' : ''} marked as printed`);
        setSelectedIds(new Set());
        return;
      }

      await qrManagementService.markAsPrinted(toMark.map((s) => s.id));
      toast.success(`${toMark.length} card${toMark.length !== 1 ? 's' : ''} marked as printed`);
      setSelectedIds(new Set());
      await handleLoadStudents();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark cards as printed');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRegenerateCard = async (studentId) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (cardType === 'Teacher') {
        const teacher = allTeachers.find((item) => (item._id || item.id) === studentId);
        const updated = teacher ? { ...teacher, qrValue: `QR-${teacher.teacherId}`, qrStatus: 'Generated', cardStatus: 'Generated' } : teacher;
        if (teacher) {
          setAllTeachers((items) => items.map((item) => ((item._id || item.id) === studentId ? updated : item)));
        }
        toast.success(`QR code regenerated for ${teacher?.fullName || 'teacher'}`);
        return;
      }

      await qrManagementService.regenerateQRCode(studentId);
      toast.success(`QR code regenerated for ${allStudents.find((s) => s.id === studentId)?.fullName || 'student'}`);
      await handleLoadStudents();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to regenerate QR code');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!selectedTemplate) return;

    const nextTemplate = selectedTemplate;
    const nextConfig = { front: { ...frontConfig }, back: { ...backConfig } };

    // Teacher cards have no persistence API. Keep the previous local-only
    // behaviour instead of posting teacher ids to the student design endpoint.
    if (cardType === 'Teacher') {
      setSavedTemplate(nextTemplate);
      setSavedDesignerConfig(nextConfig);
      toast.success('Design saved successfully');
      return;
    }

    const targets = resolveDesignTargets({ selectedIds, students: filtered });
    if (targets.length === 0) {
      toast.error('Load students before saving the design');
      return;
    }
    if (actionBusy) return;

    // Reflect the scope actually being written: an explicit selection when the
    // user made one, otherwise every card currently in view.
    const usingSelection = selectedIds.size > 0;

    setActionBusy(true);
    try {
      const payload = buildDesignPayload({
        template: nextTemplate,
        frontConfig,
        backConfig,
      });
      // One layout, many per-student cards: persist to every card in scope.
      for (const studentId of targets) {
        await qrManagementService.updateCardDesign(studentId, payload);
      }
      setSavedTemplate(nextTemplate);
      setSavedDesignerConfig(nextConfig);
      setAllStudents((prev) =>
        prev.map((s) =>
          targets.includes(s.id) || targets.includes(s._id)
            ? {
                ...s,
                card: {
                  ...(s.card || {}),
                  template: payload.template,
                  frontDesign: payload.frontDesign,
                  backDesign: payload.backDesign,
                },
              }
            : s,
        ),
      );
      toast.success(
        usingSelection
          ? `Design saved for ${targets.length} selected card${targets.length !== 1 ? 's' : ''}`
          : `Design saved for all ${targets.length} card${targets.length !== 1 ? 's' : ''} in view`,
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save the design');
    } finally {
      setActionBusy(false);
    }
  };

  const handlePrintCards = async (students) => {
    if (!students.length) { toast.error('No cards selected'); return; }

    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Popup blocked'); return; }

    const Template = activeTemplate === 'horizontal' ? HorizontalTemplate : VerticalTemplate;
    const cardsHtml = (await Promise.all(
      students.map((s) => Template.toHtml(s, SCHOOL_INFO, frontConfig, backConfig))
    )).join('');

    const printCss = `
      @page { size: A4; margin: 5mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `;

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Print ID Cards</title><style>${printCss}</style></head><body>${cardsHtml}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleSinglePrint = (student) => {
    handlePrintCards([student]);
  };

  const handleSinglePdf = async (student) => {
    try {
      const { default: html2pdf } = await import('html2pdf.js');
      const Template = activeTemplate === 'horizontal' ? HorizontalTemplate : VerticalTemplate;
      const cardHtml = await Template.toHtml(student, SCHOOL_INFO, frontConfig, backConfig);

      const element = document.createElement('div');
      element.innerHTML = cardHtml;
      document.body.appendChild(element);

      await html2pdf().set({
        margin: 0,
        filename: `ID-Card-${student.studentId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      }).from(element).save();

      document.body.removeChild(element);
      toast.success('PDF downloaded successfully');
    } catch {
      toast.error('Failed to download PDF');
    }
  };

  const renderPhoto = (student) => {
    const imageUrl = getImageUrl(student?.studentImage || student?.teacherImage || student?.profileImage);
    return imageUrl ? (
      <img src={imageUrl} alt={student.fullName} className="w-9 h-9 rounded-full object-cover ring-1 ring-yellow-400/50 flex-shrink-0" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
    ) : (
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs ring-1 ring-yellow-400/50 flex-shrink-0">
        {getInitials(student.fullName)}
      </div>
    );
  };

  const renderStatusBadge = (status, type) => {
    if (type === 'qr') {
      return status === 'Generated'
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700"><CheckCircleIcon className="h-3 w-3" /> {t('generated')}</span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700">{t('notGenerated')}</span>;
    }
    if (status === 'Printed') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700"><CheckCircleIcon className="h-3 w-3" /> {t('printed')}</span>;
    if (status === 'Generated') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700">{t('generated')}</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700"><XCircleIcon className="h-3 w-3" /> {t('pending')}</span>;
  };

  const renderPagination = () => {
    if (filtered.length === 0) return null;
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 3) { start = 2; end = Math.min(4, totalPages - 1); }
      if (currentPage >= totalPages - 2) { start = Math.max(2, totalPages - 3); end = totalPages - 1; }
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {filtered.length} {t('students')} — {t('page')} {currentPage} {t('of')} {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {t('previous')}
          </button>
          {pages.map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-gray-400 dark:text-gray-500">...</span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`min-w-[28px] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  currentPage === page
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            )
          )}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {t('next')}
          </button>
        </div>
      </div>
    );
  };

  const currentRecordsCount = cardType === 'Teacher' ? allTeachers.length : allStudents.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('idCardManagement')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('idCardManagement')}</p>
        </div>
        <div className="flex-shrink-0 pt-1 flex items-center gap-3">
          <SearchInput placeholder={t('searchNameOrId')} value={search} onChange={setSearch} />
          <button
            data-designer-toggle
            onClick={() => setDesignerOpen((p) => !p)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer shadow-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md"
          >
            <PaintSvg />
            {t('idCardDesigner')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={UserGroupIcon} label={t('totalStudents')} value={stats.total} color="blue" />
        <StatCard icon={CheckCircleIcon} label={t('cardsGenerated')} value={stats.generated} color="green" />
        <StatCard icon={PrinterIcon} label={t('printedCards')} value={stats.printed} color="yellow" />
        <StatCard icon={XCircleIcon} label={t('pendingCards')} value={stats.pending} color="red" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('academicYearLabel')}</label>
            <div className="relative">
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="">{t('selectYear')}</option>
                {currentYear ? <option value={currentYear}>{currentYear}</option> : null}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Card Type</label>
            <div className="relative">
              <select
                value={cardType}
                onChange={(e) => setCardType(e.target.value)}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                <option value="Student">Student</option>
                <option value="Teacher">Teacher</option>
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('classLabel')}</label>
            <div className="relative">
              <select
                value={className}
                onChange={(e) => { setClassName(e.target.value); setCurrentPage(1); }}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                disabled={cardType === 'Teacher'}
              >
                <option value="All Classes">{t('allClasses')}</option>
                {CLASS_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('cardStatus')}</label>
            <div className="relative">
              <select
                value={cardFilter}
                onChange={(e) => setCardFilter(e.target.value)}
                className="appearance-none w-full px-3 py-2.5 pr-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
              >
                {CARD_STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? t('all') : s === 'Pending' ? t('pending') : s === 'Generated' ? t('generated') : t('printed')}</option>)}
              </select>
              <ChevronDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleLoadStudents}
            disabled={!academicYear || (cardType !== 'Teacher' && !className) || loading}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            <UserGroupIcon className="h-4 w-4" />
            {cardType === 'Teacher' ? 'Load Teachers' : t('loadStudents')}
          </button>
          {canGenerate && (
            <button
              onClick={handleGenerateMissingCards}
              disabled={currentRecordsCount === 0 || actionBusy}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {cardType === 'Teacher' ? 'Generate Teacher Cards' : t('generateMissingCards')}
            </button>
          )}
          {canGenerate && (
            <button
              onClick={() => handlePrintCards(selectedIds.size ? filtered.filter((s) => selectedIds.has(s.id)) : [])}
              disabled={filtered.length === 0}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              <PrinterIcon className="h-4 w-4" />
              {t('printSelected')}
            </button>
          )}
          {canGenerate && (
            <button
              onClick={handlePrintAll}
              disabled={filtered.length === 0}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              <PrinterIcon className="h-4 w-4" />
              {t('printAll')}
            </button>
          )}
          {canGenerate && (
            <button
              onClick={handleMarkAsPrinted}
              disabled={selectedIds.size === 0 || actionBusy}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              <DocumentCheckIcon className="h-4 w-4" />
              {t('markAsPrinted')}
            </button>
          )}

        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <Spinner size="md" className="text-blue-600 mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('loadingStudents')}</p>
        </div>
      ) : currentRecordsCount === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <UserGroupIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('noStudentsLoaded')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {t('loadStudentsHint')}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800">
                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={paginatedStudents.length > 0 && selectedIds.size === paginatedStudents.length}
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('photo')}</th>
                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('studentName')}</th>
                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('studentIdLabel')}</th>
                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('classLabel')}</th>
                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('academicYearLabel')}</th>
                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('cardStatus')}</th>
                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('preview')}</th>
                <th className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 px-3 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedStudents.length === 0 ? (
                <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <UserGroupIcon className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                      <p className="text-sm">{t('noStudentsFound')}</p>
                      <p className="text-xs">{t('adjustFilters')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => (
                  <tr key={student.id} className="bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(student.id)}
                        onChange={() => toggleSelect(student.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-3">{renderPhoto(student)}</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">{student.fullName}</td>
                    <td className="px-3 py-3 text-xs font-mono font-medium text-gray-700 dark:text-gray-300">{student.studentId}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{student.class}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{student.academicYear}</td>
                    <td className="px-3 py-3">{renderStatusBadge(getCardStatus(student), 'card')}</td>
                    <td className="px-3 py-3">
                      <div
                        className="w-10 h-7 rounded border border-gray-200 dark:border-gray-600 bg-gradient-to-r from-blue-50 to-white dark:from-gray-700 dark:to-gray-800 flex items-center justify-center cursor-pointer hover:ring-1 hover:ring-blue-400 transition-shadow overflow-hidden"
                        onClick={() => { setPreviewStudent(student); setPreviewSide('front'); }}
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-[6px] ring-1 ring-yellow-400/50 mb-0.5">
                            {getInitials(student.fullName)}
                          </div>
                          <span className="text-[5px] text-gray-400 dark:text-gray-500 leading-none">{t('idCard')}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {canGenerate && (
                          <button
                            onClick={() => handleRegenerateCard(student.id)}
                            className="p-1.5 rounded-lg text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors cursor-pointer"
                            title={t('reissueCard')}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <line x1="2" y1="10" x2="22" y2="10" />
                              <line x1="7" y1="15" x2="13" y2="15" />
                            </svg>
                          </button>
                        )}
                        {canGenerate && (
                          <button
                            onClick={() => handleSinglePrint(student)}
                            className="p-1.5 rounded-lg text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                            title={t('printCard')}
                          >
                            <PrinterIcon className="h-4 w-4" />
                          </button>
                        )}
                        {canGenerate && (
                          <button
                            onClick={() => handleSinglePdf(student)}
                            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                            title={t('downloadPdf')}
                          >
                            <DocumentArrowDownIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {renderPagination()}
        </div>
      )}

      {previewStudent && (
        <Modal isOpen={!!previewStudent} onClose={() => setPreviewStudent(null)} title={t('idCardPreview')} maxWidth={activeTemplate === 'horizontal' ? 'max-w-[680px]' : 'max-w-[520px]'}>
          <div className="flex items-center justify-center gap-2 mb-5">
            <button
              onClick={() => setPreviewSide('front')}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${previewSide === 'front' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {t('frontSide')}
            </button>
            <button
              onClick={() => setPreviewSide('back')}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${previewSide === 'back' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {t('backSide')}
            </button>
          </div>
          {activeTemplate === 'horizontal' ? (
            <HorizontalTemplate student={previewStudent} schoolInfo={SCHOOL_INFO} side={previewSide} layoutConfig={previewSide === 'front' ? frontConfig : backConfig} />
          ) : (
            <VerticalTemplate student={previewStudent} schoolInfo={SCHOOL_INFO} side={previewSide} layoutConfig={previewSide === 'front' ? frontConfig : backConfig} />
          )}
        </Modal>
      )}

      {designerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 lg:bg-black/20" />
          {designerPreviewStudent && (
            <div className="relative z-10 flex items-center justify-center p-6 w-full"
              style={{ maxWidth: 'calc(100% - 420px)' }}>
              <div onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl px-8 py-6 max-w-full flex flex-col items-center max-h-[85vh]">
                <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                  <button onClick={() => setDesignerPreviewSide('front')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      designerPreviewSide === 'front'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}>{t('frontSide')}</button>
                  <button onClick={() => setDesignerPreviewSide('back')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      designerPreviewSide === 'back'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}>{t('backSide')}</button>
                </div>
                <div className="overflow-y-auto flex-shrink-0">
                  <div className="scale-[0.85] origin-center">
                    {activeTemplate === 'horizontal' ? (
                      <HorizontalTemplate student={designerPreviewStudent} schoolInfo={SCHOOL_INFO} side={designerPreviewSide} layoutConfig={activeConfig} />
                    ) : (
                      <VerticalTemplate student={designerPreviewStudent} schoolInfo={SCHOOL_INFO} side={designerPreviewSide} layoutConfig={activeConfig} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div ref={panelRef} className={`fixed top-0 right-0 h-full z-50 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out ${designerOpen ? 'translate-x-0' : 'translate-x-full'} w-full sm:w-[380px] md:w-[400px] lg:w-[420px]`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2"><PaintSvg /> {t('idCardDesignerTitle')}</h3>
          <button onClick={() => setDesignerOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"><CloseSvg /></button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-52px)] p-4 space-y-5">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">{t('selectTemplate')}</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'vertical', name: t('verticalCard'), desc: t('verticalCardDesc') },
                { id: 'horizontal', name: t('horizontalCard'), desc: t('horizontalCardDesc') },
              ].map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer text-left ${
                    selectedTemplate === tpl.id
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-blue-900/10'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className={`w-12 h-16 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-[9px] border border-white/20 ${tpl.id === 'vertical' ? 'flex-col' : 'flex-row'} ${selectedTemplate === tpl.id ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`${tpl.id === 'vertical' ? 'w-6 h-1.5 rounded mb-1' : 'w-4 h-3 rounded mr-1'} bg-white/40`} />
                    <div className={`${tpl.id === 'vertical' ? 'w-7 h-7 rounded-full' : 'w-3 h-3 rounded-full'} bg-white/60`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200">{tpl.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{tpl.desc}</p>
                  </div>
                  {selectedTemplate === tpl.id && (
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {selectedTemplate && (
            <div className="pt-2">
              <button
                onClick={handleSaveDesign}
                className="w-full px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {t('saveDesign')}
              </button>
              {savedTemplate && (
                <p className="text-[11px] text-green-600 dark:text-green-400 text-center mt-2">
                  {savedTemplate === 'vertical' ? t('verticalCard') : t('horizontalCard')}
                </p>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('layoutControls')}</p>
            <div className="space-y-4">
              {[
                { key: 'cardWidth', label: t('cardWidth'), min: 200, max: 600, suffix: 'px' },
                { key: 'cardHeight', label: t('cardHeight'), min: 0, max: 600, suffix: 'px' },
                { key: 'cardPadding', label: t('cardPadding'), min: 0, max: 40, suffix: 'px' },
                { key: 'borderRadius', label: t('borderRadius'), min: 0, max: 30, suffix: 'px' },
              ].map(({ key, label, min, max, suffix }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{label}</label>
                    <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{activeConfig[key]}{suffix}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={activeConfig[key]}
                    onChange={(e) => setConfigProp(key, Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('photoControls')}</p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{t('photoSize')}</label>
                  <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{activeConfig.photoSize}px</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={160}
                  value={activeConfig.photoSize}
                  onChange={(e) => setConfigProp('photoSize', Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-2">{t('photoShape')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'circle', label: t('circle'), icon: 'M12 2a10 10 0 100 20 10 10 0 000-20z' },
                    { value: 'rounded', label: t('rounded'), icon: 'M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z' },
                    { value: 'square', label: t('square'), icon: 'M4 4h16v16H4z' },
                  ].map(({ value, label, icon }) => (
                    <button
                      key={value}
                      onClick={() => setConfigProp('photoShape', value)}
                      className={`flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-medium border-2 transition-all cursor-pointer ${
                        activeConfig.photoShape === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d={icon} />
                      </svg>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('qrCodeControls')}</p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{t('qrCodeSize')}</label>
                  <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{activeConfig.qrSize}px</span>
                </div>
                <input type="range" min={80} max={240} value={activeConfig.qrSize}
                  onChange={(e) => setConfigProp('qrSize', Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-2">{t('qrCodePosition')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'left', label: t('left') },
                    { value: 'center', label: t('center') },
                    { value: 'right', label: t('right') },
                  ].map(({ value, label }) => (
                    <button key={value}
                      onClick={() => setConfigProp('qrPosition', value)}
                      className={`px-2 py-2.5 rounded-xl text-[11px] font-medium border-2 transition-all cursor-pointer ${
                        activeConfig.qrPosition === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('typography')}</p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{t('nameFontSize')}</label>
                  <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{activeConfig.nameFontSize}px</span>
                </div>
                <input type="range" min={10} max={32} value={activeConfig.nameFontSize}
                  onChange={(e) => setConfigProp('nameFontSize', Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{t('detailsFontSize')}</label>
                  <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 tabular-nums">{activeConfig.detailsFontSize}px</span>
                </div>
                <input type="range" min={8} max={24} value={activeConfig.detailsFontSize}
                  onChange={(e) => setConfigProp('detailsFontSize', Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1.5">{t('fontWeight')}</label>
                <select value={activeConfig.fontWeight}
                  onChange={(e) => setConfigProp('fontWeight', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  {[300, 400, 500, 600, 700].map((w) => (
                    <option key={w} value={w}>{
                      w === 300 ? 'Light (300)' : w === 400 ? 'Regular (400)' : w === 500 ? 'Medium (500)' : w === 600 ? 'Semi Bold (600)' : 'Bold (700)'
                    }</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('colorControls')}</p>
            <div className="space-y-3">
              {[
                { key: 'primaryColor', label: t('primaryColor') },
                { key: 'secondaryColor', label: t('secondaryColor') },
                { key: 'textColor', label: t('textColor') },
                { key: 'cardBgColor', label: t('cardBgColor') },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{label}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">{activeConfig[key]}</span>
                    <input type="color" value={activeConfig[key]}
                      onChange={(e) => setConfigProp(key, e.target.value)}
                      className="w-8 h-8 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer bg-transparent" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('visibilityControls')}</p>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">{t('headerSection')}</p>
                <div className="space-y-2">
                  {[
                    { key: 'schoolLogo', label: t('showSchoolLogo') },
                    { key: 'schoolName', label: t('showSchoolName') },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={!!activeConfig.visibility[key]}
                        onChange={(e) => setVisibilityProp(key, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors select-none">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">{t('studentSection')}</p>
                <div className="space-y-2">
                  {[
                    { key: 'studentPhoto', label: t('showStudentPhoto') },
                    { key: 'studentName', label: t('showStudentName') },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={!!activeConfig.visibility[key]}
                        onChange={(e) => setVisibilityProp(key, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors select-none">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">{t('studentInfoSection')}</p>
                <div className="space-y-2">
                  {[
                    { key: 'fatherName', label: t('showFatherName') },
                    { key: 'studentId', label: t('showStudentId') },
                    { key: 'class', label: t('showClass') },
                    { key: 'academicYear', label: t('showAcademicYear') },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={!!activeConfig.visibility[key]}
                        onChange={(e) => setVisibilityProp(key, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors select-none">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">{t('backSideSection')}</p>
                <div className="space-y-2">
                  {[
                    { key: 'qrCode', label: t('showQrCode') },
                    { key: 'fatherPhone', label: t('showFatherPhone') },
                    { key: 'schoolAddress', label: t('showSchoolAddress') },
                    { key: 'note', label: t('showNote') },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={!!activeConfig.visibility[key]}
                        onChange={(e) => setVisibilityProp(key, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors select-none">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IDCardManagement;
