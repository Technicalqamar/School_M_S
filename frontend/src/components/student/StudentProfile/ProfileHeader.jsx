import StatusBadge from '../../common/StatusBadge/StatusBadge';
import { getImageUrl } from '../../../utils/imageUrl';
import { getInitials } from './helpers';

const ProfileHeader = ({ student }) => {
  const imgSrc = getImageUrl(student.studentImage);
  const initials = getInitials(student.fullName);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 md:p-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-2xl ring-2 ring-yellow-400/50 flex-shrink-0 overflow-hidden">
          {imgSrc ? (
            <img src={imgSrc} alt={student.fullName} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            initials
          )}
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">{student.fullName}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{student.studentId}</p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
            {student.class && (
              <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full">
                {student.class}
              </span>
            )}
            {student.academicYear && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-0.5 rounded-full">
                Year {student.academicYear}
              </span>
            )}
            {student.gender && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-0.5 rounded-full">
                {student.gender}
              </span>
            )}
            <StatusBadge status={student.status} />
          </div>

          {student.fatherName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Father: {student.fatherName}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;