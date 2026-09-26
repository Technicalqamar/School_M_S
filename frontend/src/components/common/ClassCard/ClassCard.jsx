import StatusBadge from '../StatusBadge/StatusBadge';
import ActionButtons from '../ActionButtons/ActionButtons';

const ClassCard = ({ classData, onView, onEdit, onDelete }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{classData.className}</h3>
        <StatusBadge status={classData.status} />
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{classData.academicYear}</p>

      <div className="flex items-center gap-4 mb-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{classData.totalStudents || 0}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Students</p>
        </div>
      </div>

      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-center">
        <ActionButtons onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
};

export default ClassCard;
