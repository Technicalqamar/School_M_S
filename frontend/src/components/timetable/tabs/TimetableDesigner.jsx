import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import timetableService from '../../../services/timetable/timetable.service';
import timetableDesignService from '../../../services/timetableDesign/timetableDesign.service';
import { ACADEMIC_YEARS } from '../../../utils/classNames';
import { useSchoolConfig } from '../../../contexts/SchoolConfigContext';
import { useTimetableYear } from '../../../contexts/TimetableContext';
import { useTranslation } from '../../../hooks/useLocalization';

const GROUPS = {
  1: { name: 'Group 1', classes: ['Montessori', 'Nursery', 'KG 1', 'KG 2'] },
  2: { name: 'Group 2', classes: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'] },
  3: { name: 'Group 3', classes: ['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'] },
};

const FONT_OPTIONS = ['Inter', 'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Calibri', 'Segoe UI'];

const FONT_SIZE_OPTIONS = ['9px', '10px', '11px', '12px', '13px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
const FONT_WEIGHT_OPTIONS = [
  { value: '300', label: 'Light' }, { value: '400', label: 'Normal' }, { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' }, { value: '700', label: 'Bold' }, { value: '800', label: 'Extra Bold' },
];
const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' },
];
const PADDING_OPTIONS = [
  { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' },
];
const PAPER_SIZE_OPTIONS = ['A4', 'A3', 'Letter', 'Legal'];
const LINE_HEIGHT_OPTIONS = ['1', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.8', '2'];
const VERTICAL_OPTIONS = [
  { value: 'top', label: 'Top' }, { value: 'center', label: 'Center' }, { value: 'bottom', label: 'Bottom' },
];



const ChevronSvg = ({ open }) => <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const CloseSvg = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
const SettingsSvg = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const LogoSvg = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
const TypeSvg = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>;
const GridSvg = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
const PaintSvg = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>;
const EyeSvg = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const PrintSvg = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>;
const DownloadSvg = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;

const ColorPicker = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-300 dark:border-gray-600 p-0.5" />
      <span className="text-[9px] text-gray-400 dark:text-gray-500 font-mono w-14">{value}</span>
    </div>
  </div>
);

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} className={`relative w-9 h-4.5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`} style={{ height: '18px', width: '36px' }}>
    <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-[18px]' : ''}`} style={{ width: '14px', height: '14px' }} />
  </button>
);

const AccordionSection = ({ title, icon, isOpen, onToggle, children }) => (
  <div className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
    <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
      <span className="flex items-center gap-2">{icon}{title}</span>
      <ChevronSvg open={isOpen} />
    </button>
    {isOpen && <div className="px-4 pb-3 pt-0.5 space-y-2.5">{children}</div>}
  </div>
);

const INPUT_CLS = "w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500";
const SELECT_CLS = "w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer";

const FieldLabel = ({ children }) => <label className="block text-[9px] font-medium text-gray-500 dark:text-gray-400 mb-px">{children}</label>;

const TextField = ({ label, value, onChange }) => (
  <div><FieldLabel>{label}</FieldLabel><input type="text" value={value} onChange={onChange} className={INPUT_CLS} /></div>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div><FieldLabel>{label}</FieldLabel>
    <select value={value} onChange={onChange} className={SELECT_CLS}>
      {options.map((opt) => {
        const val = typeof opt === 'object' ? opt.value : opt;
        const lbl = typeof opt === 'object' ? opt.label : opt;
        return <option key={val} value={val}>{lbl}</option>;
      })}
    </select>
  </div>
);

const TimetableDesigner = () => {
  const { t } = useTranslation();
  const { schoolInfo, branding, academic } = useSchoolConfig();
  const { selectedYear, setSelectedYear } = useTimetableYear();
  const [designPanelOpen, setDesignPanelOpen] = useState(false);

  // --- Mutable state ---
  const [orientation, setOrientation] = useState('landscape');
  const [marginTop, setMarginTop] = useState('15mm');
  const [marginBottom, setMarginBottom] = useState('15mm');
  const [marginLeft, setMarginLeft] = useState('10mm');
  const [marginRight, setMarginRight] = useState('10mm');
  const [selectedGroup, setSelectedGroup] = useState(1);
  const [groupTimetables, setGroupTimetables] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupError, setGroupError] = useState('');
  const panelRef = useRef(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  // --- Logo ---
  const [logoShow, setLogoShow] = useState(true);
  const [logoSize, setLogoSize] = useState(40);
  const [logoWidth, setLogoWidth] = useState(40);
  const [logoHeight, setLogoHeight] = useState(40);
  const [logoPosition, setLogoPosition] = useState('left');
  const [logoVerticalPosition, setLogoVerticalPosition] = useState('center');

  // --- School Name ---
  const [schoolNameShow, setSchoolNameShow] = useState(true);
  const [schoolNameFontSize, setSchoolNameFontSize] = useState('14px');
  const [schoolNameFontWeight, setSchoolNameFontWeight] = useState('700');
  const [schoolNameColor, setSchoolNameColor] = useState('#ffffff');
  const [schoolNameAlign, setSchoolNameAlign] = useState('left');
  const [schoolNameVerticalPos, setSchoolNameVerticalPos] = useState('center');
  const [schoolNameLetterSpacing, setSchoolNameLetterSpacing] = useState(0);
  const [schoolNameLineHeight, setSchoolNameLineHeight] = useState('1.2');

  // --- Academic Year ---
  const [academicYearShow, setAcademicYearShow] = useState(true);
  const [academicYearFontSize, setAcademicYearFontSize] = useState('10px');
  const [academicYearFontWeight, setAcademicYearFontWeight] = useState('400');
  const [academicYearColor, setAcademicYearColor] = useState('#ffffff');
  const [academicYearAlign, setAcademicYearAlign] = useState('left');
  const [academicYearVerticalPos, setAcademicYearVerticalPos] = useState('center');

  // --- Timetable Title ---
  const [timetableTitle, setTimetableTitle] = useState('');
  const [titleFontSize, setTitleFontSize] = useState('14px');
  const [titleFontWeight, setTitleFontWeight] = useState('400');
  const [titleColor, setTitleColor] = useState('#ffffff');
  const [titleAlign, setTitleAlign] = useState('left');
  const [titleVerticalPos, setTitleVerticalPos] = useState('center');
  const [titleLetterSpacing, setTitleLetterSpacing] = useState(0);

  // --- Header Spacing ---
  const [headerPaddingTop, setHeaderPaddingTop] = useState(14);
  const [headerPaddingBottom, setHeaderPaddingBottom] = useState(14);
  const [headerPaddingLeft, setHeaderPaddingLeft] = useState(20);
  const [headerPaddingRight, setHeaderPaddingRight] = useState(20);
  const [logoTitleGap, setLogoTitleGap] = useState(12);
  const [nameTitleGap, setNameTitleGap] = useState(4);

  // --- Table / Design state ---
  const [borderWidth, setBorderWidth] = useState('1');
  const [borderRadius, setBorderRadius] = useState('0');
  const [cellPadding, setCellPadding] = useState('medium');
  const [alternateRowColor, setAlternateRowColor] = useState(true);
  const [gridLines, setGridLines] = useState(true);
  const [headerFontSize, setHeaderFontSize] = useState('14px');
  const [tableFontSize, setTableFontSize] = useState('12px');
  const [fontWeight, setFontWeight] = useState('400');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [headerBgColor, setHeaderBgColor] = useState('#1d4ed8');
  const [headerTextColor, setHeaderTextColor] = useState('#ffffff');
  const [tableHeaderBg, setTableHeaderBg] = useState('#1d4ed8');
  const [tableHeaderText, setTableHeaderText] = useState('#ffffff');
  const [periodCellColor, setPeriodCellColor] = useState('#ffffff');
  const [breakCellColor, setBreakCellColor] = useState('#f8fafc');
  const [paperSize, setPaperSize] = useState('A4');
  const [saveLoading, setSaveLoading] = useState(false);
  const [designLoaded, setDesignLoaded] = useState(false);

  // --- Load saved design on mount ---
  useEffect(() => {
    if (designLoaded) return;
    (async () => {
      try {
        const res = await timetableDesignService.getDesign();
        const d = res?.data?.design;
        if (!d) { setDesignLoaded(true); return; }

        // Logo
        if (d.logo) {
          setLogoShow(d.logo.show ?? true);
          setLogoSize(d.logo.size ?? 40);
          setLogoWidth(d.logo.width ?? 40);
          setLogoHeight(d.logo.height ?? 40);
          setLogoPosition(d.logo.position ?? 'left');
          setLogoVerticalPosition(d.logo.verticalPosition ?? 'center');
        }

        // School Name
        if (d.schoolName) {
          setSchoolNameShow(d.schoolName.show ?? true);
          setSchoolNameFontSize(d.schoolName.fontSize ?? '14px');
          setSchoolNameFontWeight(d.schoolName.fontWeight ?? '700');
          setSchoolNameColor(d.schoolName.color ?? '#ffffff');
          setSchoolNameAlign(d.schoolName.align ?? 'left');
          setSchoolNameVerticalPos(d.schoolName.verticalPos ?? 'center');
          setSchoolNameLetterSpacing(d.schoolName.letterSpacing ?? 0);
          setSchoolNameLineHeight(d.schoolName.lineHeight ?? '1.2');
        }

        // Academic Year
        if (d.academicYear) {
          setAcademicYearShow(d.academicYear.show ?? true);
          setAcademicYearFontSize(d.academicYear.fontSize ?? '10px');
          setAcademicYearFontWeight(d.academicYear.fontWeight ?? '400');
          setAcademicYearColor(d.academicYear.color ?? '#ffffff');
          setAcademicYearAlign(d.academicYear.align ?? 'left');
          setAcademicYearVerticalPos(d.academicYear.verticalPos ?? 'center');
        }

        // Title
        if (d.title) {
          setTimetableTitle(d.title.text ?? '');
          setTitleFontSize(d.title.fontSize ?? '14px');
          setTitleFontWeight(d.title.fontWeight ?? '400');
          setTitleColor(d.title.color ?? '#ffffff');
          setTitleAlign(d.title.align ?? 'left');
          setTitleVerticalPos(d.title.verticalPos ?? 'center');
          setTitleLetterSpacing(d.title.letterSpacing ?? 0);
        }

        // Header Spacing
        if (d.headerSpacing) {
          setHeaderPaddingTop(d.headerSpacing.paddingTop ?? 14);
          setHeaderPaddingBottom(d.headerSpacing.paddingBottom ?? 14);
          setHeaderPaddingLeft(d.headerSpacing.paddingLeft ?? 20);
          setHeaderPaddingRight(d.headerSpacing.paddingRight ?? 20);
          setLogoTitleGap(d.headerSpacing.logoTitleGap ?? 12);
          setNameTitleGap(d.headerSpacing.nameTitleGap ?? 4);
        }

        // Table
        if (d.table) {
          setBorderWidth(d.table.borderWidth ?? '1');
          setBorderRadius(d.table.borderRadius ?? '0');
          setCellPadding(d.table.cellPadding ?? 'medium');
          setAlternateRowColor(d.table.alternateRowColor ?? true);
          setGridLines(d.table.gridLines ?? true);
        }

        // Fonts
        if (d.fonts) {
          setHeaderFontSize(d.fonts.headerFontSize ?? '14px');
          setTableFontSize(d.fonts.tableFontSize ?? '12px');
          setFontWeight(d.fonts.fontWeight ?? '400');
          setFontFamily(d.fonts.fontFamily ?? 'Inter');
        }

        // Colors
        if (d.colors) {
          setHeaderBgColor(d.colors.headerBg ?? '#1d4ed8');
          setHeaderTextColor(d.colors.headerText ?? '#ffffff');
          setTableHeaderBg(d.colors.tableHeaderBg ?? '#1d4ed8');
          setTableHeaderText(d.colors.tableHeaderText ?? '#ffffff');
          setPeriodCellColor(d.colors.periodCell ?? '#ffffff');
          setBreakCellColor(d.colors.breakCell ?? '#f8fafc');
        }

        // Page
        if (d.page) {
          setPaperSize(d.page.paperSize ?? 'A4');
          setOrientation(d.page.orientation ?? 'landscape');
          setMarginTop(d.page.marginTop ?? '15mm');
          setMarginBottom(d.page.marginBottom ?? '15mm');
          setMarginLeft(d.page.marginLeft ?? '10mm');
          setMarginRight(d.page.marginRight ?? '10mm');
        }

        setDesignLoaded(true);
      } catch {
        setDesignLoaded(true);
      }
    })();
  }, [designLoaded]);

  // --- Derive preview objects from live control state ---
  const header = useMemo(() => ({
    logo: {
      show: logoShow,
      dataUrl: logoShow ? (branding?.smallLogo || null) : null,
      size: logoSize,
      width: logoWidth,
      height: logoHeight,
      position: logoPosition,
      verticalPosition: logoVerticalPosition,
    },
    schoolName: {
      text: schoolNameShow ? (schoolInfo?.name || 'School Name') : '',
      fontSize: schoolNameFontSize,
      fontWeight: schoolNameFontWeight,
      color: schoolNameColor,
      align: schoolNameAlign,
      verticalPos: schoolNameVerticalPos,
      letterSpacing: schoolNameLetterSpacing,
      lineHeight: schoolNameLineHeight,
      fontFamily: fontFamily,
    },
    academicYear: {
      text: academicYearShow ? (academic?.currentYear || selectedYear || '2026') : '',
      fontSize: academicYearFontSize,
      fontWeight: academicYearFontWeight,
      color: academicYearColor,
      align: academicYearAlign,
      verticalPos: academicYearVerticalPos,
      fontFamily: fontFamily,
    },
    principalName: {
      text: schoolInfo?.principalName || '',
      align: 'left',
      fontFamily: fontFamily,
      fontSize: '12px',
      fontWeight: '400',
      color: headerTextColor,
    },
    container: {
      bgColor: headerBgColor,
      borderColor: headerBgColor,
      borderRadius: borderRadius ? `${borderRadius}px` : '0px',
      padding: `${headerPaddingTop}px ${headerPaddingRight}px ${headerPaddingBottom}px ${headerPaddingLeft}px`,
      shadow: false,
    },
    spacing: {
      logoTitleGap: logoTitleGap,
      nameTitleGap: nameTitleGap,
    },
  }), [logoShow, logoSize, logoWidth, logoHeight, logoPosition, logoVerticalPosition, schoolNameShow, schoolInfo?.name, schoolNameFontSize, schoolNameFontWeight, schoolNameColor, schoolNameAlign, schoolNameVerticalPos, schoolNameLetterSpacing, schoolNameLineHeight, academicYearShow, academic?.currentYear, selectedYear, academicYearFontSize, academicYearFontWeight, academicYearColor, academicYearAlign, academicYearVerticalPos, schoolInfo?.principalName, headerBgColor, borderRadius, headerPaddingTop, headerPaddingBottom, headerPaddingLeft, headerPaddingRight, logoTitleGap, nameTitleGap, fontFamily, headerTextColor, branding?.smallLogo]);

  const title = useMemo(() => ({
    text: timetableTitle || t('timetable'),
    fontSize: titleFontSize,
    fontWeight: titleFontWeight,
    color: titleColor,
    align: titleAlign,
    verticalPos: titleVerticalPos,
    letterSpacing: titleLetterSpacing,
    fontFamily: fontFamily,
  }), [timetableTitle, titleFontSize, titleFontWeight, titleColor, titleAlign, titleVerticalPos, titleLetterSpacing, fontFamily]);

  const tableHeaders = useMemo(() => {
    const col = {
      bg: tableHeaderBg,
      color: tableHeaderText,
      fontFamily: fontFamily,
      fontSize: tableFontSize,
      fontWeight: '700',
      align: 'center',
    };
    return { time: { ...col }, class: { ...col }, subject: { ...col }, teacher: { ...col } };
  }, [tableHeaderBg, tableHeaderText, fontFamily, tableFontSize]);

  const periodCells = useMemo(() => ({
    subjectBg: periodCellColor,
    subjectColor: '#374151',
    teacherBg: periodCellColor,
    teacherColor: '#374151',
    altRowBg: alternateRowColor ? '#f8fafc' : periodCellColor,
    fontFamily: fontFamily,
    fontSize: tableFontSize,
    fontWeight: fontWeight,
  }), [periodCellColor, alternateRowColor, fontFamily, tableFontSize, fontWeight]);

  const breakRow = useMemo(() => ({
    bg: breakCellColor,
    color: '#374151',
    fontFamily: fontFamily,
    fontSize: tableFontSize,
    fontWeight: '600',
    borderRadius: '8px',
  }), [breakCellColor, fontFamily, tableFontSize]);

  const tableLayout = useMemo(() => ({
    rowHeight: 48,
    colWidth: 130,
    cellPadding: cellPadding,
    borderThickness: gridLines ? `${borderWidth}px` : '0px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
  }), [cellPadding, borderWidth, gridLines]);

  const [openSections, setOpenSections] = useState({
    headerSettings: true,
    tableSettings: false,
    fontSettings: false,
    colorSettings: false,
    pageSettings: false,
  });

  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && !e.target.closest('[data-designer-toggle]')) {
        setDesignPanelOpen(false);
      }
    };
    if (designPanelOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [designPanelOpen]);

  const loadGroupTimetables = useCallback(async () => {
    const groupClasses = GROUPS[selectedGroup]?.classes || [];
    if (!selectedYear || groupClasses.length === 0) {
      setGroupTimetables([]);
      setGroupError(selectedYear ? '' : t('selectYear'));
      return;
    }
    setGroupsLoading(true);
    setGroupError('');
    try {
      const allTimetables = await timetableService.getAllTimetables();
      const all = allTimetables?.data?.timetables || [];
      const filtered = all.filter(
        (t) => t.academicYear === selectedYear && groupClasses.includes(t.classId?.className)
      );
      const classMap = {};
      for (const tt of filtered) {
        const name = tt.classId?.className;
        if (name && groupClasses.includes(name)) {
          classMap[name] = tt;
        }
      }
      const ordered = groupClasses.map((name) => classMap[name]).filter(Boolean);
      setGroupTimetables(ordered);
      if (ordered.length === 0) {
        setGroupError(t('noData'));
      }
    } catch {
      setGroupError(t('failedToLoad'));
      setGroupTimetables([]);
    } finally {
      setGroupsLoading(false);
    }
  }, [selectedGroup, selectedYear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGroupTimetables();
  }, [loadGroupTimetables]);

  const getGroupClassName = () => {
    const g = GROUPS[selectedGroup];
    if (!g) return t('timetable');
    return g.name.replace(/\s+/g, '-');
  };

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      const payload = {
        logo: { show: logoShow, size: logoSize, width: logoWidth, height: logoHeight, position: logoPosition, verticalPosition: logoVerticalPosition },
        schoolName: { show: schoolNameShow, fontSize: schoolNameFontSize, fontWeight: schoolNameFontWeight, color: schoolNameColor, align: schoolNameAlign, verticalPos: schoolNameVerticalPos, letterSpacing: schoolNameLetterSpacing, lineHeight: schoolNameLineHeight },
        academicYear: { show: academicYearShow, fontSize: academicYearFontSize, fontWeight: academicYearFontWeight, color: academicYearColor, align: academicYearAlign, verticalPos: academicYearVerticalPos },
        title: { text: timetableTitle, fontSize: titleFontSize, fontWeight: titleFontWeight, color: titleColor, align: titleAlign, verticalPos: titleVerticalPos, letterSpacing: titleLetterSpacing },
        headerSpacing: { paddingTop: headerPaddingTop, paddingBottom: headerPaddingBottom, paddingLeft: headerPaddingLeft, paddingRight: headerPaddingRight, logoTitleGap, nameTitleGap },
        table: { borderWidth, borderRadius, cellPadding, alternateRowColor, gridLines },
        fonts: { headerFontSize, tableFontSize, fontWeight, fontFamily },
        colors: { headerBg: headerBgColor, headerText: headerTextColor, tableHeaderBg, tableHeaderText, periodCell: periodCellColor, breakCell: breakCellColor },
        page: { paperSize, orientation, marginTop, marginBottom, marginLeft, marginRight },
      };
      await timetableDesignService.saveDesign(payload);
      toast.success(t('savedSuccessfully'));
    } catch {
      toast.error(t('failedToSave'));
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePrint = () => {
    const previewEl = document.getElementById('designer-preview');
    if (!previewEl) {
      window.print();
      return;
    }
    const pageSize = `${paperSize}${orientation === 'landscape' ? ' landscape' : ''}`;
    const printCss = `
      @page { size: ${pageSize}; margin: ${marginTop} ${marginRight} ${marginBottom} ${marginLeft}; }
      body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      #designer-preview { margin: 0; padding: 0; min-width: 0 !important; width: 100% !important; }
      #designer-preview .overflow-x-auto { overflow: visible !important; }
      #designer-preview tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
      .no-print { display: none !important; }
    `;
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    const stylesHtml = Array.from(styles).map((s) => s.outerHTML).join('\n');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    const content = `<div id="designer-preview">${previewEl.innerHTML}</div>`;
    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Print Timetable</title>${stylesHtml}<style>${printCss}</style></head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleExportPdf = async () => {
    if (groupTimetables.length === 0) {
      toast.error(t('noData'));
      return;
    }
    setPdfExporting(true);
    const removedRules = [];
    let cloneContainer = null;
    try {
      const original = document.getElementById('designer-preview');
      if (!original) {
        toast.error(t('noData'));
        return;
      }

      const groupName = getGroupClassName();
      const year = selectedYear || 'Timetable';
      const formatMap = { A4: 'a4', A3: 'a3', Letter: 'letter', Legal: 'legal' };
      const pdfFormat = formatMap[paperSize] || 'a4';

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Remove problematic CSS rules from stylesheets (belt)
      for (const ss of document.styleSheets) {
        try {
          const rules = ss.cssRules;
          if (!rules) continue;
          const toRemove = [];
          for (let i = 0; i < rules.length; i++) {
            const text = rules[i].cssText;
            if (text.includes('oklab') || text.includes('oklch') || (text.includes('color') && text.includes('mix'))) {
              toRemove.push(i);
            }
          }
          for (const idx of toRemove.reverse()) {
            removedRules.push({ sheet: ss, rule: rules[idx], index: idx });
            ss.deleteRule(idx);
          }
        } catch { /* empty */ }
      }

      // Clone the preview off-screen (suspenders)
      cloneContainer = document.createElement('div');
      cloneContainer.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
      const clone = original.cloneNode(true);
      cloneContainer.appendChild(clone);
      document.body.appendChild(cloneContainer);

      // Walk the clone and normalize unsupported color functions
      const MODERN_COLOR_FN = /(oklab|oklch|color-mix)\s*\(/i;
      const COLOR_PROPS = ['color','backgroundColor','borderTopColor','borderRightColor',
        'borderBottomColor','borderLeftColor','outlineColor','textDecorationColor','caretColor','columnRuleColor'];
      const COMPOUND_PROPS = ['boxShadow','textShadow'];

      function resolveColor(str) {
        try {
          const c = document.createElement('canvas').getContext('2d');
          c.fillStyle = str;
          c.fillRect(0, 0, 1, 1);
          const d = c.getImageData(0, 0, 1, 1).data;
          return d[3] === 255 ? `rgb(${d[0]},${d[1]},${d[2]})` : `rgba(${d[0]},${d[1]},${d[2]},${(d[3]/255).toFixed(3)})`;
        } catch { return str; }
      }

      (function walk(el) {
        const cs = getComputedStyle(el);
        for (const p of COLOR_PROPS) {
          const v = cs.getPropertyValue(p);
          if (v && MODERN_COLOR_FN.test(v)) {
            el.style.setProperty(p, resolveColor(v), 'important');
          }
        }
        for (const p of COMPOUND_PROPS) {
          const v = cs.getPropertyValue(p);
          if (v && v !== 'none' && MODERN_COLOR_FN.test(v)) {
            el.style.setProperty(p, v.replace(MODERN_COLOR_FN, (_, fn) => {
              const start = v.indexOf(fn);
              if (start === -1) return fn;
              let depth = 1, i = start + fn.length + 1;
              while (i < v.length && depth > 0) { if (v[i] === '(') depth++; else if (v[i] === ')') depth--; i++; }
              return resolveColor(v.slice(start, i));
            }), 'important');
          }
        }
        for (let i = 0; i < cs.length; i++) {
          const n = cs[i];
          if (n.startsWith('--')) {
            const v = cs.getPropertyValue(n);
            if (v && MODERN_COLOR_FN.test(v)) {
              el.style.setProperty(n, v.replace(MODERN_COLOR_FN, (_, fn) => {
                const start = v.indexOf(fn);
                if (start === -1) return fn;
                let depth = 1, i = start + fn.length + 1;
                while (i < v.length && depth > 0) { if (v[i] === '(') depth++; else if (v[i] === ')') depth--; i++; }
                return resolveColor(v.slice(start, i));
              }), 'important');
            }
          }
        }
        for (const child of el.children) walk(child);
      })(clone);

      await Promise.all(Array.from(clone.querySelectorAll('img')).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
      }));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ unit: 'mm', format: pdfFormat, orientation: orientation });

      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      const parseMargin = (val) => {
        const num = parseFloat(val);
        if (val.endsWith('mm')) return num;
        if (val.endsWith('px')) return num * 0.2646;
        if (val.endsWith('in')) return num * 25.4;
        return num || 10;
      };
      const mTop = parseMargin(marginTop);
      const mBottom = parseMargin(marginBottom);
      const mLeft = parseMargin(marginLeft);
      const mRight = parseMargin(marginRight);

      const availW = pdfW - mLeft - mRight;
      const availH = pdfH - mTop - mBottom;
      const aspect = canvas.width / canvas.height;
      const pageAspect = availW / availH;

      let rW, rH;
      if (aspect > pageAspect) {
        rW = availW;
        rH = availW / aspect;
      } else {
        rH = availH;
        rW = availH * aspect;
      }

      pdf.addImage(imgData, 'JPEG', mLeft + (availW - rW) / 2, mTop + (availH - rH) / 2, rW, rH);
      pdf.save(`${groupName}-${year}-Timetable.pdf`);

      toast.success(t('savedSuccessfully'));
    } catch (err) {
      console.error('PDF export error:', err);
      if (err instanceof Error) {
        console.error('Stack:', err.stack);
        try {
          const el = document.querySelector('#designer-preview *');
          if (el) {
            const cs = getComputedStyle(el);
            for (let i = 0; i < cs.length; i++) {
              const v = cs.getPropertyValue(cs[i]);
              if (v && (v.includes('oklab') || v.includes('oklch'))) {
                console.error('Offending element:', el.tagName, el.className, 'Property:', cs[i], 'Value:', v);
                break;
              }
            }
          }
        } catch { /* empty */ }
      }
      toast.error(`${t('failedToSave')}: ${err?.message || t('unknown')}`);
    } finally {
      for (const { sheet, rule, index } of removedRules) {
        try { sheet.insertRule(rule.cssText, index); } catch { /* empty */ }
      }
      if (cloneContainer && cloneContainer.parentNode) {
        cloneContainer.parentNode.removeChild(cloneContainer);
      }
      setPdfExporting(false);
    }
  };

  const paddingMap = { small: 'p-2', medium: 'p-4', large: 'p-6' };
  const orientClasses = orientation === 'landscape' ? 'min-w-[900px]' : 'min-w-[600px]';

  const cellStyle = (overrides = {}) => ({
    border: `${tableLayout.borderThickness} ${tableLayout.borderStyle} ${tableLayout.borderColor}`,
    padding: `${tableLayout.rowHeight / 3}px ${tableLayout.colWidth > 130 ? 14 : 8}px`,
    minWidth: `${tableLayout.colWidth}px`,
    maxWidth: `${tableLayout.colWidth * 1.4}px`,
    height: `${tableLayout.rowHeight}px`,
    verticalAlign: 'top',
    ...overrides,
  });

  const renderGroupPreview = () => {
    const group = GROUPS[selectedGroup];
    const classNames = group?.classes || [];
    const hasData = groupTimetables.length > 0;

    const buildRows = () => {
      if (!hasData) return [];
      const timeSlots = {};
      for (const tt of groupTimetables) {
        for (const p of tt.periods || []) {
          const key = `${p.startTime}-${p.endTime}`;
          if (!timeSlots[key]) {
            timeSlots[key] = { startTime: p.startTime, endTime: p.endTime };
          }
        }
      }
      const sorted = Object.values(timeSlots).sort((a, b) => a.startTime.localeCompare(b.startTime));
      return sorted.map((slot) => {
        const periodsForSlot = {};
        let allBreak = true;
        let breakName = '';
        for (const tt of groupTimetables) {
          const name = tt.classId?.className;
          if (!name || !classNames.includes(name)) continue;
          const match = tt.periods.find((p) => p.startTime === slot.startTime && p.endTime === slot.endTime);
          if (match) {
            if (match.type === 'break') {
              periodsForSlot[name] = null;
              if (match.breakName) breakName = match.breakName;
            } else {
              periodsForSlot[name] = { s: match.subjectId?.subjectName || '', t: match.teacherId?.fullName || '' };
              allBreak = false;
            }
          }
        }
        if (allBreak) {
          return { time: `${slot.startTime} - ${slot.endTime}`, isBreak: true, breakName: breakName || 'Break', periods: {} };
        }
        return { time: `${slot.startTime} - ${slot.endTime}`, isBreak: false, periods: periodsForSlot };
      });
    };

    const rows = buildRows();
    const displayClasses = classNames.filter((name) => groupTimetables.some((tt) => tt.classId?.className === name));

    return (
      <div className={`${paddingMap[tableLayout.cellPadding]} bg-white rounded-lg overflow-hidden`}>
        <div style={{ backgroundColor: header.container.bgColor, color: header.schoolName.color, padding: header.container.padding, borderRadius: header.container.borderRadius, border: `1px solid ${header.container.borderColor}`, boxShadow: header.container.shadow ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: header.logo.verticalPosition === 'top' ? 'flex-start' : header.logo.verticalPosition === 'bottom' ? 'flex-end' : 'center', justifyContent: header.logo.position === 'center' ? 'center' : header.logo.position === 'right' ? 'flex-end' : 'flex-start', gap: `${header.spacing.logoTitleGap}px` }}>
            {header.logo.show && (
              <div className="flex-shrink-0">
                {header.logo.dataUrl ? <img src={header.logo.dataUrl} alt="Logo" style={{ width: `${header.logo.width}px`, height: `${header.logo.height}px` }} className="rounded-full object-cover ring-2 ring-white/40" /> : <div style={{ width: `${header.logo.width}px`, height: `${header.logo.height}px` }} className="rounded-full bg-white/20 flex items-center justify-center"><LogoSvg /></div>}
              </div>
            )}
            <div className="min-w-0" style={{ flex: 1 }}>
              {header.schoolName.text && (
                <h1 className="font-bold tracking-wide truncate" style={{ fontFamily: header.schoolName.fontFamily, fontSize: header.schoolName.fontSize, fontWeight: header.schoolName.fontWeight, color: header.schoolName.color, textAlign: header.schoolName.align, letterSpacing: `${header.schoolName.letterSpacing}px`, lineHeight: header.schoolName.lineHeight }}>{header.schoolName.text}</h1>
              )}
              {group?.name && (
                <p className="opacity-90" style={{ fontFamily: title.fontFamily, fontSize: title.fontSize, fontWeight: title.fontWeight, color: title.color, textAlign: title.align, letterSpacing: `${title.letterSpacing}px`, marginTop: header.schoolName.text ? `${header.spacing.nameTitleGap}px` : 0 }}>{title.text} - {group.name}</p>
              )}
              {header.academicYear.text && (
                <p style={{ fontFamily: header.academicYear.fontFamily, fontSize: header.academicYear.fontSize, fontWeight: header.academicYear.fontWeight, color: header.academicYear.color, textAlign: header.academicYear.align }}>Academic Year: {header.academicYear.text}</p>
              )}
              {header.principalName.text && (
                <p style={{ fontFamily: header.principalName.fontFamily, fontSize: header.principalName.fontSize, fontWeight: header.principalName.fontWeight, color: header.principalName.color, textAlign: header.principalName.align }}>Principal: {header.principalName.text}</p>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {hasData ? (
            <table className="w-full" style={{ borderCollapse: 'collapse', fontFamily: periodCells.fontFamily }}>
              <thead>
                <tr>
                  <th style={{ ...cellStyle({ backgroundColor: tableHeaders.time.bg, color: tableHeaders.time.color, fontWeight: tableHeaders.time.fontWeight, fontFamily: tableHeaders.time.fontFamily, fontSize: tableHeaders.time.fontSize, textAlign: tableHeaders.time.align }), position: 'sticky', left: 0, zIndex: 1, minWidth: '100px', width: '100px' }} className="text-[10px]">Time</th>
                  {displayClasses.map((name) => (
                    <th key={name} style={cellStyle({ backgroundColor: tableHeaders.class.bg, color: tableHeaders.class.color, fontWeight: tableHeaders.class.fontWeight, fontFamily: tableHeaders.class.fontFamily, fontSize: tableHeaders.class.fontSize, textAlign: tableHeaders.class.align })} className="text-[10px]">{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  if (row.isBreak) {
                    return (
                      <tr key={ri}>
                        <td style={{ ...cellStyle({ backgroundColor: breakRow.bg, color: breakRow.color, fontWeight: breakRow.fontWeight, textAlign: 'center', fontFamily: breakRow.fontFamily, fontSize: breakRow.fontSize }), fontWeight: 600, minWidth: '100px', width: '100px' }} className="text-[10px]">{row.time}</td>
                        <td colSpan={displayClasses.length} style={cellStyle({ backgroundColor: breakRow.bg, color: breakRow.color, textAlign: 'center', fontWeight: breakRow.fontWeight, fontFamily: breakRow.fontFamily, fontSize: breakRow.fontSize })} className="text-[10px] font-bold italic">
                          <span className="inline-block px-3 py-0.5 uppercase tracking-wider" style={{ backgroundColor: breakRow.bg, color: breakRow.color, fontSize: breakRow.fontSize, borderRadius: breakRow.borderRadius }}>{row.breakName}</span>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={ri}>
                      <td style={{ ...cellStyle({ backgroundColor: periodCells.altRowBg, color: periodCells.subjectColor, fontWeight: periodCells.fontWeight, fontFamily: periodCells.fontFamily, fontSize: periodCells.fontSize }), fontWeight: 600, minWidth: '100px', width: '100px' }} className="text-[10px]">{row.time}</td>
                      {displayClasses.map((name) => {
                        const cell = row.periods[name];
                        return (
                          <td key={name} style={cellStyle({ backgroundColor: ri % 2 !== 0 ? periodCells.altRowBg : periodCells.subjectBg, color: periodCells.subjectColor, fontWeight: periodCells.fontWeight, fontFamily: periodCells.fontFamily, fontSize: periodCells.fontSize })} className={`text-[10px]`}>
                            {cell ? (
                              <div className="space-y-0.5">
                                <span className="block font-semibold truncate" style={{ color: periodCells.subjectColor, fontSize: periodCells.fontSize }}>{cell.t}</span>
                                <span className="block opacity-60 truncate" style={{ color: periodCells.subjectColor, fontSize: periodCells.fontSize }}>{cell.s}</span>
                              </div>
                            ) : <span className="opacity-20">&mdash;</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-xs">
              {groupsLoading ? t('loading') : groupError || t('selectYear')}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPreview = () => renderGroupPreview();

  return (
    <div className="space-y-4">
      <style>{`
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  #designer-preview { margin: 0; padding: 0; min-width: 0 !important; width: 100% !important; }
  #designer-preview .overflow-x-auto { overflow: visible !important; }
  #designer-preview tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
}
      `}</style>
      <div className="flex items-center justify-between no-print">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('timetableDesigner')}</h2>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {[1, 2, 3].map((g) => (
              <button key={g} onClick={() => setSelectedGroup(g)} className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all cursor-pointer whitespace-nowrap ${selectedGroup === g ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>Group {g}</button>
            ))}
          </div>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px] text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer">
            <option value="">{t('selectYear')}</option>
            {ACADEMIC_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button data-designer-toggle onClick={() => setDesignPanelOpen((p) => !p)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer shadow-sm ${designPanelOpen ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500'}`}>
            <SettingsSvg />
            <span>{t('timetableDesigner')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 no-print">
          <div className="flex items-center gap-2">
            <EyeSvg />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('preview')}</span>
          </div>
          {groupTimetables.length > 0 ? (
            <span className="text-[10px] text-gray-400">{GROUPS[selectedGroup]?.name} &middot; {groupTimetables.length} classes</span>
          ) : (
            <span className="text-[10px] text-gray-400">{selectedYear ? t('noData') : t('selectYear')}</span>
          )}
        </div>
        <div className="p-4 md:p-6 overflow-x-auto">
          <div id="designer-preview" className={orientClasses}>
            {renderPreview()}
          </div>
        </div>
      </div>

      {designPanelOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:bg-black/20" onClick={() => setDesignPanelOpen(false)} />}

      <div ref={panelRef} className={`fixed top-0 right-0 h-full z-50 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out ${designPanelOpen ? 'translate-x-0' : 'translate-x-full'} w-full sm:w-[380px] md:w-[400px] lg:w-[420px]`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2"><SettingsSvg /> {t('timetableDesigner')}</h3>
          <button onClick={() => setDesignPanelOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"><CloseSvg /></button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-52px)]">
          {/* Section A — Header Settings */}
          <AccordionSection title={t('schoolSettings')} icon={<TypeSvg />} isOpen={openSections.headerSettings} onToggle={() => toggleSection('headerSettings')}>
            <div className="space-y-3">
              {/* --- Logo --- */}
              <div>
                <h4 className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">{t('schoolLogo')}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">{t('status')}</span>
                    <Toggle value={logoShow} onChange={setLogoShow} />
                  </div>
                  <div><FieldLabel>Size</FieldLabel><input type="range" min="16" max="120" value={logoSize} onChange={(e) => { const v = Number(e.target.value); setLogoSize(v); setLogoWidth(v); setLogoHeight(v); }} className="w-full" /></div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div><FieldLabel>Width (px)</FieldLabel><input type="number" value={logoWidth} onChange={(e) => setLogoWidth(Number(e.target.value))} className={INPUT_CLS} /></div>
                    <div><FieldLabel>Height (px)</FieldLabel><input type="number" value={logoHeight} onChange={(e) => setLogoHeight(Number(e.target.value))} className={INPUT_CLS} /></div>
                  </div>
                  <SelectField label="Position" value={logoPosition} onChange={(e) => setLogoPosition(e.target.value)} options={ALIGN_OPTIONS} />
                  <SelectField label="Vertical Position" value={logoVerticalPosition} onChange={(e) => setLogoVerticalPosition(e.target.value)} options={VERTICAL_OPTIONS} />
                </div>
              </div>

              <hr className="border-gray-100 dark:border-gray-700/50" />

              {/* --- School Name --- */}
              <div>
                <h4 className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">{t('schoolName')}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Show</span>
                    <Toggle value={schoolNameShow} onChange={setSchoolNameShow} />
                  </div>
                  <SelectField label="Font Size" value={schoolNameFontSize} onChange={(e) => setSchoolNameFontSize(e.target.value)} options={FONT_SIZE_OPTIONS} />
                  <SelectField label="Font Weight" value={schoolNameFontWeight} onChange={(e) => setSchoolNameFontWeight(e.target.value)} options={FONT_WEIGHT_OPTIONS} />
                  <ColorPicker label="Font Color" value={schoolNameColor} onChange={setSchoolNameColor} />
                  <SelectField label="Text Alignment" value={schoolNameAlign} onChange={(e) => setSchoolNameAlign(e.target.value)} options={ALIGN_OPTIONS} />
                  <SelectField label="Vertical Position" value={schoolNameVerticalPos} onChange={(e) => setSchoolNameVerticalPos(e.target.value)} options={VERTICAL_OPTIONS} />
                  <div><FieldLabel>Letter Spacing (px)</FieldLabel><input type="number" step="0.5" value={schoolNameLetterSpacing} onChange={(e) => setSchoolNameLetterSpacing(Number(e.target.value))} className={INPUT_CLS} /></div>
                  <SelectField label="Line Height" value={schoolNameLineHeight} onChange={(e) => setSchoolNameLineHeight(e.target.value)} options={LINE_HEIGHT_OPTIONS} />
                </div>
              </div>

              <hr className="border-gray-100 dark:border-gray-700/50" />

              {/* --- Academic Year --- */}
              <div>
                <h4 className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">{t('academicYear')}</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Show</span>
                    <Toggle value={academicYearShow} onChange={setAcademicYearShow} />
                  </div>
                  <SelectField label="Font Size" value={academicYearFontSize} onChange={(e) => setAcademicYearFontSize(e.target.value)} options={FONT_SIZE_OPTIONS} />
                  <SelectField label="Font Weight" value={academicYearFontWeight} onChange={(e) => setAcademicYearFontWeight(e.target.value)} options={FONT_WEIGHT_OPTIONS} />
                  <ColorPicker label="Font Color" value={academicYearColor} onChange={setAcademicYearColor} />
                  <SelectField label="Text Alignment" value={academicYearAlign} onChange={(e) => setAcademicYearAlign(e.target.value)} options={ALIGN_OPTIONS} />
                  <SelectField label="Vertical Position" value={academicYearVerticalPos} onChange={(e) => setAcademicYearVerticalPos(e.target.value)} options={VERTICAL_OPTIONS} />
                </div>
              </div>

              <hr className="border-gray-100 dark:border-gray-700/50" />

              {/* --- Timetable Title --- */}
              <div>
                <h4 className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">{t('timetable')}</h4>
                <div className="space-y-2">
                  <TextField label="Title Text" value={timetableTitle} onChange={(e) => setTimetableTitle(e.target.value)} />
                  <SelectField label="Font Size" value={titleFontSize} onChange={(e) => setTitleFontSize(e.target.value)} options={FONT_SIZE_OPTIONS} />
                  <SelectField label="Font Weight" value={titleFontWeight} onChange={(e) => setTitleFontWeight(e.target.value)} options={FONT_WEIGHT_OPTIONS} />
                  <ColorPicker label="Font Color" value={titleColor} onChange={setTitleColor} />
                  <SelectField label="Alignment" value={titleAlign} onChange={(e) => setTitleAlign(e.target.value)} options={ALIGN_OPTIONS} />
                  <SelectField label="Vertical Position" value={titleVerticalPos} onChange={(e) => setTitleVerticalPos(e.target.value)} options={VERTICAL_OPTIONS} />
                  <div><FieldLabel>Letter Spacing (px)</FieldLabel><input type="number" step="0.5" value={titleLetterSpacing} onChange={(e) => setTitleLetterSpacing(Number(e.target.value))} className={INPUT_CLS} /></div>
                </div>
              </div>

              <hr className="border-gray-100 dark:border-gray-700/50" />

              {/* --- Header Spacing --- */}
              <div>
                <h4 className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">{t('schoolSettings')}</h4>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <div><FieldLabel>Top Padding (px)</FieldLabel><input type="number" value={headerPaddingTop} onChange={(e) => setHeaderPaddingTop(Number(e.target.value))} className={INPUT_CLS} /></div>
                    <div><FieldLabel>Bottom Padding (px)</FieldLabel><input type="number" value={headerPaddingBottom} onChange={(e) => setHeaderPaddingBottom(Number(e.target.value))} className={INPUT_CLS} /></div>
                    <div><FieldLabel>Left Padding (px)</FieldLabel><input type="number" value={headerPaddingLeft} onChange={(e) => setHeaderPaddingLeft(Number(e.target.value))} className={INPUT_CLS} /></div>
                    <div><FieldLabel>Right Padding (px)</FieldLabel><input type="number" value={headerPaddingRight} onChange={(e) => setHeaderPaddingRight(Number(e.target.value))} className={INPUT_CLS} /></div>
                  </div>
                  <div><FieldLabel>Logo - School Name Gap (px)</FieldLabel><input type="number" value={logoTitleGap} onChange={(e) => setLogoTitleGap(Number(e.target.value))} className={INPUT_CLS} /></div>
                  <div><FieldLabel>School Name - Title Gap (px)</FieldLabel><input type="number" value={nameTitleGap} onChange={(e) => setNameTitleGap(Number(e.target.value))} className={INPUT_CLS} /></div>
                </div>
              </div>
            </div>
          </AccordionSection>

          {/* Section B — Table Settings */}
          <AccordionSection title={t('schoolSettings')} icon={<GridSvg />} isOpen={openSections.tableSettings} onToggle={() => toggleSection('tableSettings')}>
            <div><FieldLabel>Border Width</FieldLabel><input type="text" value={borderWidth} onChange={(e) => setBorderWidth(e.target.value)} className={INPUT_CLS} placeholder="e.g. 1" /></div>
            <div><FieldLabel>Border Radius</FieldLabel><input type="text" value={borderRadius} onChange={(e) => setBorderRadius(e.target.value)} className={INPUT_CLS} placeholder="e.g. 0" /></div>
            <SelectField label="Cell Padding" value={cellPadding} onChange={(e) => setCellPadding(e.target.value)} options={PADDING_OPTIONS} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Alternate Row Color</span>
              <Toggle value={alternateRowColor} onChange={setAlternateRowColor} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Grid Lines</span>
              <Toggle value={gridLines} onChange={setGridLines} />
            </div>
          </AccordionSection>

          {/* Section C — Font Settings */}
          <AccordionSection title={t('typography')} icon={<TypeSvg />} isOpen={openSections.fontSettings} onToggle={() => toggleSection('fontSettings')}>
            <SelectField label="Header Font Size" value={headerFontSize} onChange={(e) => setHeaderFontSize(e.target.value)} options={FONT_SIZE_OPTIONS} />
            <SelectField label="Table Font Size" value={tableFontSize} onChange={(e) => setTableFontSize(e.target.value)} options={FONT_SIZE_OPTIONS} />
            <SelectField label="Font Weight" value={fontWeight} onChange={(e) => setFontWeight(e.target.value)} options={FONT_WEIGHT_OPTIONS} />
            <SelectField label="Font Family" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} options={FONT_OPTIONS} />
          </AccordionSection>

          {/* Section D — Color Settings */}
          <AccordionSection title={t('colorControls')} icon={<PaintSvg />} isOpen={openSections.colorSettings} onToggle={() => toggleSection('colorSettings')}>
            <ColorPicker label="Header Background" value={headerBgColor} onChange={setHeaderBgColor} />
            <ColorPicker label="Header Text Color" value={headerTextColor} onChange={setHeaderTextColor} />
            <ColorPicker label="Table Header Background" value={tableHeaderBg} onChange={setTableHeaderBg} />
            <ColorPicker label="Table Header Text" value={tableHeaderText} onChange={setTableHeaderText} />
            <ColorPicker label="Period Cell Color" value={periodCellColor} onChange={setPeriodCellColor} />
            <ColorPicker label="Break Cell Color" value={breakCellColor} onChange={setBreakCellColor} />
          </AccordionSection>

          {/* Section E — Page Settings */}
          <AccordionSection title={t('schoolSettings')} icon={<PrintSvg />} isOpen={openSections.pageSettings} onToggle={() => toggleSection('pageSettings')}>
            <SelectField label="Paper Size" value={paperSize} onChange={(e) => setPaperSize(e.target.value)} options={PAPER_SIZE_OPTIONS} />
            <div><FieldLabel>Orientation</FieldLabel><div className="flex gap-1">{['portrait', 'landscape'].map((o) => <button key={o} onClick={() => setOrientation(o)} className={`flex-1 px-2 py-1.5 rounded-lg text-[9px] font-medium transition-all cursor-pointer capitalize ${orientation === o ? 'bg-blue-600 text-white shadow-sm' : 'border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{o}</button>)}</div></div>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <div><FieldLabel>Margin Top</FieldLabel><input type="text" value={marginTop} onChange={(e) => setMarginTop(e.target.value)} className={INPUT_CLS} placeholder="15mm" /></div>
              <div><FieldLabel>Margin Bottom</FieldLabel><input type="text" value={marginBottom} onChange={(e) => setMarginBottom(e.target.value)} className={INPUT_CLS} placeholder="15mm" /></div>
              <div><FieldLabel>Margin Left</FieldLabel><input type="text" value={marginLeft} onChange={(e) => setMarginLeft(e.target.value)} className={INPUT_CLS} placeholder="10mm" /></div>
              <div><FieldLabel>Margin Right</FieldLabel><input type="text" value={marginRight} onChange={(e) => setMarginRight(e.target.value)} className={INPUT_CLS} placeholder="10mm" /></div>
            </div>
          </AccordionSection>

          {/* Bottom Buttons */}
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
            <button onClick={handleSave} disabled={saveLoading} className="w-full px-3 py-2 rounded-lg text-[10px] font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              {saveLoading ? t('saving') : t('save')}
            </button>
            <button onClick={handlePrint} className="w-full px-3 py-2 rounded-lg text-[10px] font-medium text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5">
              <PrintSvg /> {t('print')}
            </button>
            <button onClick={handleExportPdf} disabled={pdfExporting || groupTimetables.length === 0} className="w-full px-3 py-2 rounded-lg text-[10px] font-medium text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              <DownloadSvg /> {pdfExporting ? t('saving') : t('download')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetableDesigner;
