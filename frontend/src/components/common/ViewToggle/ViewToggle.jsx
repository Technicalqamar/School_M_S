import { Squares2X2Icon, TableCellsIcon } from '@heroicons/react/24/outline';

const ViewToggle = ({ view, onChange }) => {
  return (
    <div className="flex items-center rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
      <button
        onClick={() => onChange('card')}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
          view === 'card'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        <Squares2X2Icon className="h-4 w-4" />
        <span className="hidden sm:inline">Card View</span>
      </button>
      <button
        onClick={() => onChange('table')}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
          view === 'table'
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        <TableCellsIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Table View</span>
      </button>
    </div>
  );
};

export default ViewToggle;
