import { useState } from 'react';
import AllReceptionists from '../../components/receptionists/AllReceptionists/AllReceptionists';
import AddReceptionist from '../../components/receptionists/AddReceptionist/AddReceptionist';
import ReceptionistAccess from '../../components/receptionists/ReceptionistAccess/ReceptionistAccess';

// Standalone Admin module for managing receptionist accounts. Admin-only: the
// route is wrapped with RequireAdmin in App.jsx and every backend endpoint is
// `authorize('admin')`, so a receptionist can never reach or mutate this module
// (including their own account).
const TABS = [
  { key: 'all', label: 'All Receptionists' },
  { key: 'add', label: 'Add Receptionist' },
  { key: 'access', label: 'Access & Permissions' },
];

const ReceptionistManagement = () => {
  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Receptionist Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Create receptionist login accounts, review them, and control exactly
          which Admin modules each receptionist can open.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'all' && <AllReceptionists />}
      {activeTab === 'add' && <AddReceptionist onCreated={() => setActiveTab('all')} />}
      {activeTab === 'access' && <ReceptionistAccess />}
    </div>
  );
};

export default ReceptionistManagement;