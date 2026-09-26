import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardDocumentListIcon,
  AcademicCapIcon,
  UserIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import SearchInput from '../../components/common/SearchInput/SearchInput';
import FilterDropdown from '../../components/common/FilterDropdown/FilterDropdown';
import Spinner from '../../components/common/Spinner/Spinner';
import studentHomeworkService, { STUDENT_ASSIGNMENT_STATUSES } from '../../services/student/studentHomework.service';
import { useTranslation } from '../../hooks/useLocalization';
import { usePortal } from '../../contexts/PortalContext';

const statusBadgeCls = (status) => {
  const map = {
    Pending: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800',
    'In Progress': 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800',
    Completed: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800',
    Overdue: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800',
  };
  return map[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700';
};

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-14">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <ClipboardDocumentListIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const StudentHomework = () => {
  const { t } = useTranslation();
  const portal = usePortal();
  const isPortalAccess = Boolean(portal?.isPortalAccess);
  const homeworkBase = isPortalAccess ? '/portal/access/homework' : '/student/dashboard/homework';

  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersActive, setFiltersActive] = useState(false);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const loadAssignments = useCallback(async () => {
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (subjectFilter !== 'All') params.subject = subjectFilter;
      if (statusFilter !== 'All') params.status = statusFilter;

      const result = await studentHomeworkService.getAssignments(params);
      setAssignments(result.assignments || []);
      setSubjects(result.subjects || []);
      setTotal(result.total ?? result.assignments.length);
      setFiltersActive(Boolean(params.search || params.subject || params.status));
      setError('');
    } catch {
      setError(t('homeworkLoadError'));
      toast.error(t('homeworkLoadError'));
    } finally {
      setIsLoading(false);
    }
  }, [search, subjectFilter, statusFilter, t]);

  useEffect(() => {
    let cancelled = false;

    const delay = setTimeout(() => {
      if (!cancelled) {
        loadAssignments().catch(() => {});
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(delay);
    };
  }, [loadAssignments]);

  const retry = () => {
    setError('');
    setIsLoading(true);
    loadAssignments().catch(() => {});
  };

  const updateFilter = (setter, value) => {
    setter(value);
    setError('');
    setIsLoading(true);
  };

  const subjectOptions = useMemo(() => {
    const names = [...new Set(subjects.map((s) => s.subjectName).filter(Boolean))];
    if (names.length === 0) {
      const fromAssignments = [...new Set(assignments.map((a) => a.subject).filter(Boolean))];
      names.push(...fromAssignments);
    }
    if (names.length === 0 && total === 0 && !filtersActive) return [t('all')];
    return [t('all'), ...names];
  }, [subjects, assignments, total, filtersActive, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{t('homeworkAssignments')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('homeworkSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <SearchInput placeholder={t('homeworkSearchPlaceholder')} value={search} onChange={(v) => updateFilter(setSearch, v)} />
        </div>
        <FilterDropdown label={t('subject')} options={subjectOptions} value={subjectFilter} onChange={(v) => updateFilter(setSubjectFilter, v)} />
        <FilterDropdown
          label={t('status')}
          options={[t('all'), ...STUDENT_ASSIGNMENT_STATUSES]}
          value={statusFilter}
          onChange={(v) => updateFilter(setStatusFilter, v)}
        />
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
          <Spinner size="lg" className="text-blue-600" />
          <p className="text-sm">{t('loadingAssignments')}</p>
        </div>
      )}

      {!isLoading && error && (
        <CardSection>
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <EmptyState title={t('somethingWentWrong')} description={error} />
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
            >
              {t('tryAgain')}
            </button>
          </div>
        </CardSection>
      )}

      {!isLoading && !error && assignments.length === 0 && (
        <CardSection>
          <EmptyState
            title={filtersActive ? t('noMatchingAssignmentsTitle') : t('noAssignmentsTitle')}
            description={filtersActive ? t('noMatchingAssignmentsDescription') : t('noAssignmentsDescription')}
          />
        </CardSection>
      )}

      {!isLoading && !error && assignments.length > 0 && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {total} {t('assignments')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {assignments.map((item) => (
              <article
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{item.title}</h2>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeCls(item.status)}`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <AcademicCapIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{t('subject')}:</span> {item.subject || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{t('teacher')}:</span> {item.teacherName || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{t('assignedDate')}:</span>{' '}
                      {formatDate(item.assignedDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{t('dueOn')}:</span> {formatDate(item.dueDate)}
                    </span>
                  </div>
                </div>

                <div className="mt-auto pt-1">
                  <Link
                    to={`${homeworkBase}/${item.id}`}
                    state={{ assignment: item }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    {t('viewAssignment')} <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default StudentHomework;