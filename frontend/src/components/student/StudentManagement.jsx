import { useState, Component } from 'react';
import { useTranslation } from '../../hooks/useLocalization';
import AllStudents from './tabs/AllStudents';
import AddStudent from './tabs/AddStudent';
import StudentPromotionTab from './tabs/StudentPromotion';
import PromotionHistory from './tabs/PromotionHistory';
const tabComponents = {
  'All Students': AllStudents,
  'Add Student': AddStudent,
  'Student Promotion': StudentPromotionTab,
  'Promotion History': PromotionHistory,
};

class TabErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    console.error('Tab render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="text-sm mt-1">Please try switching tabs or reload the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const TabWrapper = ({ tab, onSuccess }) => {
  const Component = tabComponents[tab];
  return <Component onSuccess={onSuccess} />;
};

const StudentManagement = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('All Students');

  const tabs = [
    { key: 'All Students', label: t('allStudents') },
    { key: 'Add Student', label: t('addStudent') },
    { key: 'Student Promotion', label: t('studentPromotion') },
    { key: 'Promotion History', label: t('promotionHistory') },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <TabErrorBoundary key={activeTab}>
        <TabWrapper tab={activeTab} onSuccess={() => setActiveTab('All Students')} />
      </TabErrorBoundary>
    </div>
  );
};

export default StudentManagement;
