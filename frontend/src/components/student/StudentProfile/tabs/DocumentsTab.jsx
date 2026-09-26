import { DocumentTextIcon } from '@heroicons/react/24/outline';
import CardSection from '../../../common/CardSection/CardSection';
import { EmptyState } from '../shared';

const DocumentsTab = ({ documents = [] }) => {
  if (documents.length > 0) {
    return (
      <CardSection title="Student Documents">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((document, index) => (
            <div
              key={document.id || `${document.name}-${index}`}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-start gap-3"
            >
              <DocumentTextIcon className="h-6 w-6 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{document.name}</p>
                {document.type && <p className="text-xs text-gray-500 dark:text-gray-400">{document.type}</p>}
              </div>
            </div>
          ))}
        </div>
      </CardSection>
    );
  }

  return (
    <EmptyState
      icon={DocumentTextIcon}
      title="No documents available"
      message="Uploaded documents for this student will appear here."
    />
  );
};

export default DocumentsTab;