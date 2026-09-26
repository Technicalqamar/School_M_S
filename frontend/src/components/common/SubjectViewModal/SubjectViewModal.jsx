import Modal from '../Modal/Modal';
import StatusBadge from '../StatusBadge/StatusBadge';
import { useTranslation } from '../../../hooks/useLocalization';

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
    <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value || '-'}</span>
  </div>
);

const SubjectViewModal = ({ subject, isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!subject) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('subject') + ' ' + t('details')} maxWidth="max-w-lg">
      <div className="flex flex-col items-center pb-5 border-b border-gray-200 dark:border-gray-700">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg ring-2 ring-yellow-400/50 mb-3">
          {subject.subjectName?.slice(0, 2).toUpperCase() || t('noDataDash')}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{subject.subjectName}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{subject.subjectCode}</p>
        <div className="mt-2">
          <StatusBadge status={subject.status} />
        </div>
      </div>

      <div className="mt-4">
        <InfoRow label="Assigned Classes" value={(subject.assignedClassesCount || 0) + ' class' + ((subject.assignedClassesCount || 0) !== 1 ? 'es' : '')} />
        <InfoRow label="Description" value={subject.description} />
        {subject.createdAt && <InfoRow label="Created" value={new Date(subject.createdAt).toLocaleDateString()} />}
      </div>
    </Modal>
  );
};

export default SubjectViewModal;
