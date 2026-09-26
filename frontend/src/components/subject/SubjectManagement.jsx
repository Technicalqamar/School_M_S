import { useState } from 'react';
import { useTranslation } from '../../hooks/useLocalization';
import AllSubjects from './tabs/AllSubjects';
import AddSubject from './tabs/AddSubject';
import ClassSubjectAssignment from './tabs/ClassSubjectAssignment';

const SubjectManagement = () => {
  const { t } = useTranslation();
  const tabs = [t('allSubjects'), t('addSubject'), t('classSubjectAssignment')];
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);

  const tabComponents = {
    [tabs[0]]: AllSubjects,
    [tabs[1]]: AddSubject,
    [tabs[2]]: ClassSubjectAssignment,
  };

  const ActiveComponent = tabComponents[activeTab];

  const handleViewDetails = (subject) => {
    setSelectedSubject(subject);
  };

  const handleEditSubject = (subject) => {
    setEditingSubject(subject);
    setActiveTab(tabs[1]);
  };

  const handleAddSuccess = () => {
    setEditingSubject(null);
    setActiveTab(tabs[0]);
  };

  const componentProps = {};
  if (activeTab === tabs[0]) {
    componentProps.onViewDetails = handleViewDetails;
    componentProps.onEditSubject = handleEditSubject;
    componentProps.selectedSubject = selectedSubject;
    componentProps.onCloseView = () => setSelectedSubject(null);
  }
  if (activeTab === tabs[1]) {
    componentProps.editData = editingSubject;
    componentProps.onSuccess = handleAddSuccess;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab !== tabs[1]) setEditingSubject(null); if (tab !== tabs[0]) setSelectedSubject(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <ActiveComponent key={activeTab === tabs[1] ? editingSubject?._id || 'add-subject' : undefined} {...componentProps} />
    </div>
  );
};

export default SubjectManagement;
