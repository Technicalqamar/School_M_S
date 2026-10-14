import { useState } from 'react';
import { useTranslation } from '../../hooks/useLocalization';
import { useAuth } from '../../contexts/AuthContext';
import { filterTabsByPermission } from '../../constants/receptionistPermissions';
import AllClasses from './tabs/AllClasses';
import AddClass from './tabs/AddClass';
import ClassDetails from './tabs/ClassDetails';

const ClassManagement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const allTabs = [
    { key: 'All Classes', label: t('allClasses') },
    { key: 'Add New Class', label: t('addNewClass') },
    { key: 'Class Details', label: t('classDetails') },
  ];
  const tabComponents = {
    'All Classes': AllClasses,
    'Add New Class': AddClass,
    'Class Details': ClassDetails,
  };

  const tabs = filterTabsByPermission(user, 'class-management', allTabs);
  const [activeTab, setActiveTab] = useState(allTabs[0].key);
  const [selectedClass, setSelectedClass] = useState(null);
  const [editingClass, setEditingClass] = useState(null);

  if (tabs.length === 0) return null;
  const currentTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : tabs[0].key;

  const ActiveComponent = tabComponents[currentTab];

  const handleViewDetails = (classData) => {
    setSelectedClass(classData);
    setActiveTab('Class Details');
  };

  const handleEditClass = (classData) => {
    setEditingClass(classData);
    setActiveTab('Add New Class');
  };

  const handleAddSuccess = () => {
    setEditingClass(null);
    setActiveTab('All Classes');
  };

  const handleBackToAll = () => {
    setSelectedClass(null);
    setActiveTab('All Classes');
  };

  const componentProps = {};
  if (currentTab === 'All Classes') {
    componentProps.onViewDetails = handleViewDetails;
    componentProps.onEditClass = handleEditClass;
  }
  if (currentTab === 'Add New Class') {
    componentProps.editData = editingClass;
    componentProps.onSuccess = handleAddSuccess;
  }
  if (currentTab === 'Class Details') {
    componentProps.classData = selectedClass;
    componentProps.onBack = handleBackToAll;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key !== 'Add New Class') setEditingClass(null); if (tab.key !== 'Class Details') setSelectedClass(null); }}
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

      <ActiveComponent key={currentTab === 'Add New Class' ? editingClass?._id || 'add-class' : currentTab === 'Class Details' ? selectedClass?._id || 'no-class' : undefined} {...componentProps} />
    </div>
  );
};

export default ClassManagement;