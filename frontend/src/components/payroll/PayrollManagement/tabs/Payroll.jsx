import { useState, useEffect, useMemo, useRef } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  ChevronDownIcon,
  UserIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import SearchInput from '../../../common/SearchInput/SearchInput';
import Table from '../../../common/Table/Table';
import ActionButtons from '../../../common/ActionButtons/ActionButtons';
import Modal from '../../../common/Modal/Modal';
import SelectInput from '../../../common/SelectInput/SelectInput';
import Button from '../../../common/Button/Button';
import payrollService from '../../../../services/payroll/payroll.service';
import teacherService from '../../../../services/teacher/teacher.service';
import { useCurrency } from '../../../../hooks/useLocalization';
import { useSchoolConfig } from '../../../../contexts/SchoolConfigContext';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const STATUS_OPTIONS = ['Generated', 'Pending', 'Paid'];
const EMPTY_STATS = { totalPayrolls: 0, generatedPayrolls: 0, paidPayrolls: 0, totalNetSalary: 0 };

const initialGenerateForm = {
  teacherId: '',
  teacherName: '',
  month: '',
  year: '',
};

// Format a date stored as YYYY-MM-DD (or ISO) as "01 Jun 2026" without timezone shifting.
const formatDate = (value) => {
  if (!value) return '—';
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value).slice(0, 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${match[3]} ${months[Number(match[2]) - 1]} ${match[1]}`;
};

// Selectable payroll years come from the system's central Academic Year setting
// plus the years that actually exist in real payroll records — never an
// invented sequential list.
const statusBadgeClass = (status) => {
  if (status === 'Paid') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  if (status === 'Pending') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
};

const Payroll = () => {
  const { formatCurrency } = useCurrency();
  const { academic } = useSchoolConfig();
  const centralYear = String(academic.currentYear || '').trim();

  // Academic year source: the system's centrally configured Academic Year plus
  // years that actually exist in real payroll records (never invented).
  const [dataYears, setDataYears] = useState(() => new Set());
  const yearOptions = useMemo(() => {
    const years = new Set(dataYears);
    if (centralYear) years.add(centralYear);
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [dataYears, centralYear]);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(() => ({
    year: centralYear || '',
    month: '',
    status: '',
  }));
  const defaultYearApplied = useRef(Boolean(centralYear));
  const [data, setData] = useState([]);
  const [statistics, setStatistics] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const requestRef = useRef(0);

  // Generate modal state
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateForm, setGenerateForm] = useState(initialGenerateForm);
  const [generateErrors, setGenerateErrors] = useState({});
  const [generating, setGenerating] = useState(false);

  // Teacher search selection (real teacher data via existing teacher search API)
  const [teacherQuery, setTeacherQuery] = useState('');
  const [teacherResults, setTeacherResults] = useState([]);
  const [teacherSearching, setTeacherSearching] = useState(false);
  const [teacherDropdownOpen, setTeacherDropdownOpen] = useState(false);

  // View modal state
  const [viewItem, setViewItem] = useState(null);
  const [viewStructure, setViewStructure] = useState(null);
  const [showView, setShowView] = useState(false);

  const buildParams = () => {
    const params = {};
    if (filters.year) params.year = filters.year;
    if (filters.month) params.month = MONTH_NAMES.indexOf(filters.month) + 1;
    if (filters.status) params.status = filters.status;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
    return params;
  };

  const fetchPayrolls = async () => {
    const reqId = ++requestRef.current;
    try {
      const result = await payrollService.getPayrollRecords(buildParams());
      if (reqId !== requestRef.current) return;
      setData(result.data?.payrolls || []);
      setStatistics(result.data?.statistics || EMPTY_STATS);
      setLoadError(null);
    } catch (err) {
      if (reqId !== requestRef.current) return;
      setLoadError(err.response?.data?.message || 'Failed to load payroll records');
    } finally {
      if (reqId === requestRef.current) setLoading(false);
    }
  };

  // Distinct years present in real payroll records (any status) — the source
  // for the Payroll Year options so no invented/sequential years are offered.
  const fetchAvailableYears = async () => {
    try {
      const result = await payrollService.getPayrollRecords();
      const years = (result.data?.payrolls || [])
        .map((payroll) => payroll.payrollYear)
        .filter((year) => year !== undefined && year !== null)
        .map(String);
      if (years.length) setDataYears(new Set(years));
    } catch {
      // Keep the current options if the census request fails.
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAvailableYears();
  }, []);

  // Apply the central academic year once it is available (school settings load
  // asynchronously), matching the convention used across the admin module.
  useEffect(() => {
    if (centralYear && !defaultYearApplied.current) {
      defaultYearApplied.current = true;
      setFilters((prev) => ({ ...prev, year: centralYear }));
    }
  }, [centralYear]);

  // Debounce the teacher search box.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load records whenever a filter changes (initial load included).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayrolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.year, filters.month, filters.status]);

  // Load/search real teachers for the Generate form (existing teacher search conventions).
  useEffect(() => {
    if (!showGenerate) return undefined;

    let cancelled = false;
    const timer = setTimeout(
      () => {
        setTeacherSearching(true);
        teacherService
          .getAllTeachers({ search: teacherQuery.trim() || undefined, limit: 25 })
          .then((res) => {
            if (!cancelled) setTeacherResults(res.data?.teachers || []);
          })
          .catch(() => {
            if (!cancelled) setTeacherResults([]);
          })
          .finally(() => {
            if (!cancelled) setTeacherSearching(false);
          });
      },
      teacherQuery.trim() ? 400 : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showGenerate, teacherQuery]);

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || filters.month || filters.status || (filters.year && filters.year !== centralYear),
  );

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilters({ year: centralYear || '', month: '', status: '' });
    fetchPayrolls();
  };

  const openGenerate = () => {
    setGenerateForm(initialGenerateForm);
    setGenerateErrors({});
    setTeacherQuery('');
    setTeacherResults([]);
    setTeacherDropdownOpen(false);
    setShowGenerate(true);
  };

  const closeGenerate = () => {
    setShowGenerate(false);
    setGenerateForm(initialGenerateForm);
    setGenerateErrors({});
    setTeacherQuery('');
    setTeacherResults([]);
    setTeacherDropdownOpen(false);
  };

  const handleGenerateChange = (e) => {
    const { name, value } = e.target;
    setGenerateForm((prev) => ({ ...prev, [name]: value }));
    if (generateErrors[name]) setGenerateErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const selectTeacher = (teacher) => {
    setGenerateForm((prev) => ({
      ...prev,
      teacherId: teacher.teacherId,
      teacherName: teacher.fullName,
    }));
    setTeacherQuery('');
    setTeacherDropdownOpen(false);
    if (generateErrors.teacherId) setGenerateErrors((prev) => ({ ...prev, teacherId: '' }));
  };

  const clearTeacher = () => {
    setGenerateForm((prev) => ({ ...prev, teacherId: '', teacherName: '' }));
    setTeacherDropdownOpen(true);
  };

  const validateGenerate = () => {
    const newErrors = {};
    if (!generateForm.teacherId) newErrors.teacherId = 'Teacher is required';
    if (!generateForm.month) newErrors.month = 'Payroll month is required';
    if (!generateForm.year) newErrors.year = 'Payroll year is required';
    setGenerateErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerate = async () => {
    if (!validateGenerate()) return;
    setGenerating(true);

    const payload = {
      teacherId: generateForm.teacherId,
      month: MONTH_NAMES.indexOf(generateForm.month) + 1,
      year: Number(generateForm.year),
    };

    try {
      const result = await payrollService.generatePayroll(payload);
      toast.success(result.message || 'Payroll generated successfully');
      closeGenerate();
      await fetchPayrolls();
      fetchAvailableYears();
    } catch (err) {
      // Duplicate (409), empty month (400), future period (400), etc. — always
      // show the backend message verbatim; never fall back to dummy data.
      const msg = err.response?.data?.message || 'Failed to generate payroll';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const openView = (item) => {
    setViewItem(item);
    setShowView(true);
    setViewStructure(null);
    if (item.salaryStructureId) {
      payrollService
        .getSalaryStructureById(item.salaryStructureId)
        .then((res) => setViewStructure(res.data?.structure || null))
        .catch(() => setViewStructure(null));
    }
  };

  const closeView = () => {
    setShowView(false);
    setViewItem(null);
    setViewStructure(null);
  };

  const tableColumns = [
    { key: 'teacherId', label: 'Teacher ID' },
    { key: 'teacherName', label: 'Teacher Name' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
    { key: 'basicSalary', label: 'Basic Salary' },
    { key: 'workingDays', label: 'Working Days' },
    { key: 'presentDays', label: 'Present' },
    { key: 'absentDays', label: 'Absent' },
    { key: 'leaveDays', label: 'Leave' },
    { key: 'lateDays', label: 'Late' },
    { key: 'totalWorkingHours', label: 'Working Hours' },
    { key: 'salaryDeduction', label: 'Deduction' },
    { key: 'netSalary', label: 'Net Salary' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: '', className: 'text-right' },
  ];

  const renderRow = (item) => (
    <>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900 dark:text-white">{item.teacherId}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {item.teacher?.fullName || '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {MONTH_SHORT[Number(item.payrollMonth) - 1] || item.payrollMonth}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.payrollYear}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {formatCurrency(item.basicSalary)}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 tabular-nums">{item.workingDays}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 tabular-nums">{item.presentDays}</td>
      <td className="px-4 py-3 text-red-600 dark:text-red-400 tabular-nums">{item.absentDays}</td>
      <td className="px-4 py-3 text-green-600 dark:text-green-400 tabular-nums">{item.leaveDays}</td>
      <td className="px-4 py-3 text-amber-600 dark:text-amber-400 tabular-nums">{item.lateDays}</td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap tabular-nums">
        {`${Number(item.totalWorkingHours || 0).toFixed(2)}h`}
      </td>
      <td className="px-4 py-3 text-red-600 dark:text-red-400 whitespace-nowrap">
        -{formatCurrency(item.salaryDeduction)}
      </td>
      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
        {formatCurrency(item.netSalary)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusBadgeClass(
            item.status,
          )}`}
        >
          {item.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <ActionButtons onView={() => openView(item)} />
      </td>
    </>
  );

  const selectClass =
    'appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border text-sm transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer';

  const filterLabelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payroll</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate and manage monthly payroll runs. All salary calculations are computed by the backend from real
            attendance and approved leave records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetFilters}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <ArrowPathIcon className="h-4 w-4" /> Reset / Refresh
          </button>
          <button
            onClick={fetchPayrolls}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            <ArrowPathIcon className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={openGenerate}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <PlusIcon className="h-4 w-4" /> Generate Payroll
          </button>
        </div>
      </div>

      {loadError && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={fetchPayrolls}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Total Payrolls</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">{statistics.totalPayrolls}</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-1">Generated</p>
            <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">{statistics.generatedPayrolls}</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Paid</p>
            <p className="text-lg font-semibold text-green-700 dark:text-green-300">{statistics.paidPayrolls}</p>
          </div>
          <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
            <p className="text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1">Net Payroll Value</p>
            <p className="text-lg font-semibold text-indigo-700 dark:text-indigo-300">
              {formatCurrency(statistics.totalNetSalary)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <label className={filterLabelClass}>Teacher ID / Name</label>
            <SearchInput placeholder="Search by Teacher ID or Name..." value={search} onChange={setSearch} />
          </div>
          <div className="relative">
            <label className={filterLabelClass}>Payroll Month</label>
            <div className="relative">
              <select
                value={filters.month}
                onChange={(e) => handleFilterChange('month', e.target.value)}
                className={selectClass}
              >
                <option value="">All Months</option>
                {MONTH_NAMES.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="relative">
            <label className={filterLabelClass}>Payroll Year</label>
            <div className="relative">
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                className={selectClass}
              >
                <option value="">All Years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="relative">
            <label className={filterLabelClass}>Status</label>
            <div className="relative">
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className={selectClass}
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-sm">Loading payroll records...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16">
            <BanknotesIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              {hasActiveFilters ? 'No matching payroll records' : 'No payroll records found'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {hasActiveFilters ? 'Try adjusting your filters.' : 'Generate a payroll for a teacher to get started.'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={openGenerate}
                className="mt-4 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center gap-2 cursor-pointer mx-auto"
              >
                <PlusIcon className="h-4 w-4" /> Generate Payroll
              </button>
            )}
          </div>
        ) : (
          <Table columns={tableColumns} data={data} renderRow={renderRow} />
        )}
      </div>

      {/* Generate Payroll modal */}
      <Modal
        isOpen={showGenerate}
        onClose={closeGenerate}
        title="Generate Payroll"
        maxWidth="max-w-lg"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Select a teacher and a payroll period. The backend calculates working days, attendance, leave, deductions and
          net salary from real records.
        </p>

        <div className="mb-4 relative">
          <label htmlFor="payrollTeacherSearch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Search Teacher <span className="text-red-500">*</span>
          </label>
          <input
            id="payrollTeacherSearch"
            type="text"
            value={teacherQuery}
            onChange={(e) => setTeacherQuery(e.target.value)}
            onFocus={() => setTeacherDropdownOpen(true)}
            onBlur={() => setTimeout(() => setTeacherDropdownOpen(false), 150)}
            placeholder="Search by Teacher ID or Name..."
            autoComplete="off"
            className="appearance-none w-full px-4 py-2.5 pr-10 rounded-lg border text-sm transition-all border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder-gray-400"
          />
          {teacherDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-60 overflow-y-auto">
              {teacherSearching ? (
                <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">Searching teachers...</p>
              ) : teacherResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">No teachers found</p>
              ) : (
                teacherResults.map((teacher) => (
                  <button
                    key={teacher._id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectTeacher(teacher);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <span className="block text-sm font-medium text-gray-800 dark:text-white">{teacher.fullName}</span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">{teacher.teacherId}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {generateForm.teacherId && (
            <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
                {generateForm.teacherName} · {generateForm.teacherId}
              </span>
              <button
                type="button"
                onClick={clearTeacher}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex-shrink-0"
              >
                Clear
              </button>
            </div>
          )}
          {generateErrors.teacherId && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{generateErrors.teacherId}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectInput
            label="Payroll Month"
            name="month"
            value={generateForm.month}
            onChange={handleGenerateChange}
            options={MONTH_NAMES}
            required
          />
          <SelectInput
            label="Payroll Year"
            name="year"
            value={generateForm.year}
            onChange={handleGenerateChange}
            options={yearOptions}
            required
          />
        </div>
        {generateErrors.month && (
          <p className="text-xs text-red-600 dark:text-red-400 -mt-2 mb-3">{generateErrors.month}</p>
        )}
        {generateErrors.year && (
          <p className="text-xs text-red-600 dark:text-red-400 -mt-2 mb-3">{generateErrors.year}</p>
        )}

        <div className="flex gap-3 mt-6">
          <Button variant="secondary" onClick={closeGenerate} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} loading={generating}>
            Generate Payroll
          </Button>
        </div>
      </Modal>

      {/* View Payroll modal */}
      <Modal
        isOpen={showView}
        onClose={closeView}
        title="Payroll Details"
        maxWidth="max-w-lg"
      >
        {viewItem && (
          <div className="space-y-5">
            <div className="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="mx-auto w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                {viewItem.teacher?.teacherImage ? (
                  <img
                    src={viewItem.teacher.teacherImage}
                    alt={viewItem.teacher?.fullName || 'Teacher'}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <UserIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {viewItem.teacher?.fullName || viewItem.teacherId}
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500">{viewItem.teacherId}</p>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${statusBadgeClass(
                  viewItem.status,
                )}`}
              >
                {viewItem.status}
              </span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <CalendarDaysIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payroll Period</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {MONTH_NAMES[Number(viewItem.payrollMonth) - 1]} {viewItem.payrollYear}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Working Days</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">{viewItem.workingDays}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Present</p>
                <p className="text-base font-semibold text-green-600 dark:text-green-400">{viewItem.presentDays}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Absent</p>
                <p className="text-base font-semibold text-red-600 dark:text-red-400">{viewItem.absentDays}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Leave</p>
                <p className="text-base font-semibold text-green-600 dark:text-green-400">{viewItem.leaveDays}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Late</p>
                <p className="text-base font-semibold text-amber-600 dark:text-amber-400">{viewItem.lateDays}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Working Hours</p>
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {`${Number(viewItem.totalWorkingHours || 0).toFixed(2)}h`}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center gap-3">
              <CurrencyDollarIcon className="h-5 w-5 text-indigo-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Salary Structure / Basic Salary</p>
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                  {viewStructure
                    ? `${viewStructure.salaryType} · ${formatCurrency(viewItem.basicSalary)} · effective ${formatDate(
                        viewStructure.effectiveFrom,
                      )}`
                    : formatCurrency(viewItem.basicSalary)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-xs text-red-500 dark:text-red-400 uppercase tracking-wider mb-1">Deduction</p>
                <p className="text-base font-semibold text-red-700 dark:text-red-300">
                  -{formatCurrency(viewItem.salaryDeduction)}
                </p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <p className="text-xs text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">Net Salary</p>
                <p className="text-base font-semibold text-green-700 dark:text-green-300">
                  {formatCurrency(viewItem.netSalary)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payroll;