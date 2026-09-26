import { useState } from 'react';
import { useTranslation } from '../../hooks/useLocalization';
import AllClasses from './tabs/AllClasses';
import AddClass from './tabs/AddClass';
import ClassDetails from './tabs/ClassDetails';

const ClassManagement = () => {
  const { t } = useTranslation();
  const tabs = [t('allClasses'), t('addNewClass'), t('classDetails')];
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [editingClass, setEditingClass] = useState(null);

  const tabComponents = {
    [tabs[0]]: AllClasses,
    [tabs[1]]: AddClass,
    [tabs[2]]: ClassDetails,
  };

  const ActiveComponent = tabComponents[activeTab];

  const handleViewDetails = (classData) => {
    setSelectedClass(classData);
    setActiveTab(tabs[2]);
  };

  const handleEditClass = (classData) => {
    setEditingClass(classData);
    setActiveTab(tabs[1]);
  };

  const handleAddSuccess = () => {
    setEditingClass(null);
    setActiveTab(tabs[0]);
  };

  const handleBackToAll = () => {
    setSelectedClass(null);
    setActiveTab(tabs[0]);
  };

  const componentProps = {};
  if (activeTab === tabs[0]) {
    componentProps.onViewDetails = handleViewDetails;
    componentProps.onEditClass = handleEditClass;
  }
  if (activeTab === tabs[1]) {
    componentProps.editData = editingClass;
    componentProps.onSuccess = handleAddSuccess;
  }
  if (activeTab === tabs[2]) {
    componentProps.classData = selectedClass;
    componentProps.onBack = handleBackToAll;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab !== tabs[1]) setEditingClass(null); if (tab !== tabs[2]) setSelectedClass(null); }}
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

      <ActiveComponent key={activeTab === tabs[1] ? editingClass?._id || 'add-class' : activeTab === tabs[2] ? selectedClass?._id || 'no-class' : undefined} {...componentProps} />
    </div>
  );
};

export default ClassManagement;
