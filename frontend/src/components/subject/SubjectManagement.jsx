import { useState } from 'react';
import { useTranslation } from '../../hooks/useLocalization';
import { useAuth } from '../../contexts/AuthContext';
import { filterTabsByPermission } from '../../constants/receptionistPermissions';
import AllSubjects from './tabs/AllSubjects';
import AddSubject from './tabs/AddSubject';
import ClassSubjectAssignment from './tabs/ClassSubjectAssignment';

const SubjectManagement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const allTabs = [
    { key: 'All Subjects', label: t('allSubjects') },
    { key: 'Add Subject', label: t('addSubject') },
    { key: 'Class Subject Assignment', label: t('classSubjectAssignment') },
  ];
  const tabComponents = {
    'All Subjects': AllSubjects,
    'Add Subject': AddSubject,
    'Class Subject Assignment': ClassSubjectAssignment,
  };

  const tabs = filterTabsByPermission(user, 'subject-management', allTabs);
  const [activeTab, setActiveTab] = useState(allTabs[0].key);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);

  if (tabs.length === 0) return null;
  const currentTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : tabs[0].key;

  const ActiveComponent = tabComponents[currentTab];

  const handleViewDetails = (subject) => {
    setSelectedSubject(subject);
  };

  const handleEditSubject = (subject) => {
    setEditingSubject(subject);
    setActiveTab('Add Subject');
  };

  const handleAddSuccess = () => {
    setEditingSubject(null);
    setActiveTab('All Subjects');
  };

  const componentProps = {};
  if (currentTab === 'All Subjects') {
    componentProps.onViewDetails = handleViewDetails;
    componentProps.onEditSubject = handleEditSubject;
    componentProps.selectedSubject = selectedSubject;
    componentProps.onCloseView = () => setSelectedSubject(null);
  }
  if (currentTab === 'Add Subject') {
    componentProps.editData = editingSubject;
    componentProps.onSuccess = handleAddSuccess;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key !== 'Add Subject') setEditingSubject(null); if (tab.key !== 'All Subjects') setSelectedSubject(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                currentTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <ActiveComponent key={currentTab === 'Add Subject' ? editingSubject?._id || 'add-subject' : undefined} {...componentProps} />
    </div>
  );
};

export default SubjectManagement;