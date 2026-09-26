import { useState, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import CardSection from '../../components/common/CardSection/CardSection';
import Spinner from '../../components/common/Spinner/Spinner';
import studentHomeworkService from '../../services/student/studentHomework.service';
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

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const DetailRow = ({ label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg px-4 py-3 border border-gray-100 dark:border-gray-600">
    <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">{value}</p>
  </div>
);

const StudentAssignmentDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { state } = useLocation();
  const portal = usePortal();
  const homeworkBase = portal?.isPortalAccess ? '/portal/access/homework' : '/student/dashboard/homework';

  const [assignment, setAssignment] = useState(state?.assignment || null);
  const [isLoading, setIsLoading] = useState(!state?.assignment && Boolean(id));
  const [error, setError] = useState('');

  useEffect(() => {
    if (state?.assignment || !id) return;

    let mounted = true;

    studentHomeworkService
      .getAssignment(id)
      .then((result) => {
        if (!mounted) return;
        setAssignment(result);
        setError('');
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.response?.data?.message || t('homeworkLoadError'));
        toast.error(err?.response?.data?.message || t('homeworkLoadError'));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, state?.assignment, t]);

  const unavailable = !id && !assignment;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{t('assignmentDetails')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('homeworkSubtitle')}</p>
        </div>
        <Link
          to={homeworkBase}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t('backToAssignments')}
        </Link>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
          <Spinner size="lg" className="text-blue-600" />
          <p className="text-sm">{t('loadingAssignments')}</p>
        </div>
      )}

      {!isLoading && unavailable && (
        <CardSection>
          <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-14">
            <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
              <ClipboardDocumentListIcon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('assignmentUnavailableTitle')}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{t('assignmentUnavailableDescription')}</p>
            <Link
              to={homeworkBase}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              {t('backToAssignments')}
            </Link>
          </div>
        </CardSection>
      )}

      {!isLoading && !unavailable && error && (
        <CardSection>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
            <Link
              to={homeworkBase}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" />
              {t('backToAssignments')}
            </Link>
          </div>
        </CardSection>
      )}

      {!isLoading && !unavailable && !error && assignment && (
        <CardSection>
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">{assignment.title}</h2>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeCls(assignment.status)}`}
              >
                {assignment.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <DetailRow label={t('subject')} value={assignment.subject || '-'} />
              <DetailRow
                label={t('teacher')}
                value={assignment.teacherName ? `${assignment.teacherName}${assignment.teacherCode ? ` (${assignment.teacherCode})` : ''}` : '-'}
              />
              <DetailRow label={t('assignedDate')} value={formatDate(assignment.assignedDate)} />
              <DetailRow label={t('dueOn')} value={
                <span className="inline-flex items-center gap-1"><ClockIcon className="h-4 w-4 text-gray-400" /> {formatDate(assignment.dueDate)}</span>
              } />
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ClipboardDocumentListIcon className="h-4 w-4" />
                {t('descriptionInstructions')}
              </p>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {assignment.description || t('noDescription')}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
              <CalendarDaysIcon className="h-4 w-4" />
              <span>
                {t('assignedDate')}: {formatDate(assignment.assignedDate)} &bull; {t('dueOn')}: {formatDate(assignment.dueDate)}
              </span>
            </div>
          </div>
        </CardSection>
      )}
    </div>
  );
};

export default StudentAssignmentDetail;