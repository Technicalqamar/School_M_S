import Modal from '../Modal/Modal';
import StatusBadge from '../StatusBadge/StatusBadge';
import { getImageUrl } from '../../../utils/imageUrl';
import { useTranslation } from '../../../hooks/useLocalization';

const InfoRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0">
    <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
    <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value || '-'}</span>
  </div>
);

const TeacherViewModal = ({ teacher, isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!teacher) return null;

  const imgSrc = getImageUrl(teacher.teacherImage);
  const initials = teacher.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || t('noDataDash');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('teacher') + ' ' + t('details')} maxWidth="max-w-lg">
      <div className="flex flex-col items-center pb-5 border-b border-gray-200 dark:border-gray-700">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xl ring-2 ring-yellow-400/50 mb-3 overflow-hidden">
          {imgSrc ? (
            <img src={imgSrc} alt={teacher.fullName} className="w-full h-full rounded-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = initials; }} />
          ) : (
            initials
          )}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{teacher.fullName}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{teacher.teacherId}</p>
        <div className="mt-2">
          <StatusBadge status={teacher.status} />
        </div>
      </div>

      <div className="mt-4">
        <InfoRow label={t('academicYear')} value={teacher.academicYear} />
        <InfoRow label="Father Name" value={teacher.fatherName} />
        <InfoRow label="Qualification" value={teacher.qualification} />
        <InfoRow label="Experience" value={teacher.experience} />
        <InfoRow label="Phone Number" value={teacher.phoneNumber} />
        <InfoRow label="Email" value={teacher.email} />
        <InfoRow label="City" value={teacher.city} />
        <InfoRow label="Joining Date" value={teacher.joiningDate?.slice(0, 10)} />
      </div>
    </Modal>
  );
};

export default TeacherViewModal;
