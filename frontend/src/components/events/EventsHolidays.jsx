import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../hooks/useLocalization';
import { SparklesIcon } from '@heroicons/react/24/outline';
import StatCard from '../common/StatCard/StatCard';
import eventsService from '../../services/events/events.service';
import { useAuth } from '../../contexts/AuthContext';
import { filterTabsByPermission } from '../../constants/receptionistPermissions';
import AllEvents from './tabs/AllEvents';
import AddEvent from './tabs/AddEvent';
import HolidayManagement from './tabs/HolidayManagement';
import CalendarView from './tabs/CalendarView';
import EventGallery from './tabs/EventGallery';

const ALL_TABS = [
  { key: 'Events', component: AllEvents },
  { key: 'Add Event', component: AddEvent },
  { key: 'Holidays', component: HolidayManagement },
  { key: 'Calendar View', component: CalendarView },
  { key: 'Event Gallery', component: EventGallery },
];

const EventsHolidays = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const tabLabels = {
    Events: `${t('event')}s`,
    'Add Event': t('addEvent'),
    Holidays: `${t('holiday')}s`,
    'Calendar View': 'Calendar View',
    'Event Gallery': t('eventGallery'),
  };

  // Receptionists only see the tabs their stored permissions open (module, page
  // or action grant per tab); the module route may be reached with any grant,
  // so the active tab is clamped to the first visible one. Admins see every tab.
  const tabs = filterTabsByPermission(user, 'events-and-holidays', ALL_TABS);

  const [activeTab, setActiveTab] = useState('Events');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editEvent, setEditEvent] = useState(null);
  const [editHoliday, setEditHoliday] = useState(null);
  const [stats, setStats] = useState({ totalEvents: 0, totalHolidays: 0, upcomingEvents: 0, upcomingHolidays: 0 });

  useEffect(() => {
    eventsService.getStats().then(setStats).catch(() => setStats({ totalEvents: 0, totalHolidays: 0, upcomingEvents: 0, upcomingHolidays: 0 }));
  }, [refreshKey]);

  const handleEditEvent = useCallback((event) => {
    setEditEvent(event);
    setActiveTab('Add Event');
  }, []);

  const handleClearEdit = useCallback(() => {
    setEditEvent(null);
  }, []);

  const handleEditHoliday = useCallback((holiday) => {
    setEditHoliday(holiday);
  }, []);

  const handleClearHolidayEdit = useCallback(() => {
    setEditHoliday(null);
  }, []);

  const onDataChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (tabs.length === 0) return null;
  const currentTab = tabs.some((tab) => tab.key === activeTab) ? activeTab : tabs[0].key;
  const ActiveComponent = tabs.find((tab) => tab.key === currentTab).component;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('eventsAndHolidays')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('eventsAndHolidays')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={SparklesIcon} label={t('totalEvents')} value={stats.totalEvents} color="blue" />
        <StatCard icon={SparklesIcon} label={t('totalHolidays')} value={stats.totalHolidays} color="green" />
        <StatCard icon={SparklesIcon} label={t('upcomingEvents')} value={stats.upcomingEvents} color="yellow" />
        <StatCard icon={SparklesIcon} label={t('upcomingHolidays')} value={stats.upcomingHolidays} color="purple" />
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key !== 'Add Event') setEditEvent(null);
                if (tab.key !== 'Holidays') setEditHoliday(null);
                setActiveTab(tab.key);
              }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                currentTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tabLabels[tab.key]}
            </button>
          ))}
        </nav>
      </div>

      <ActiveComponent
        key={refreshKey}
        onDataChange={onDataChange}
        onEditEvent={currentTab === 'Events' ? handleEditEvent : undefined}
        editEvent={currentTab === 'Add Event' ? editEvent : undefined}
        onClearEdit={currentTab === 'Add Event' ? handleClearEdit : undefined}
        editHoliday={currentTab === 'Holidays' ? editHoliday : undefined}
        onEditHoliday={currentTab === 'Holidays' ? handleEditHoliday : undefined}
        onClearHolidayEdit={currentTab === 'Holidays' ? handleClearHolidayEdit : undefined}
      />
    </div>
  );
};

export default EventsHolidays;