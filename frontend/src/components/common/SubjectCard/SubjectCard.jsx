import StatusBadge from '../StatusBadge/StatusBadge';
import ActionButtons from '../ActionButtons/ActionButtons';

const SubjectCard = ({ subject, onView, onEdit, onDelete }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{subject.subjectName}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subject.subjectCode}</p>
        </div>
        <StatusBadge status={subject.status} />
      </div>

      <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">Assigned Classes</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{subject.assignedClassesCount || 0}</p>
      </div>

      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-center">
        <ActionButtons onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
};

export default SubjectCard;
