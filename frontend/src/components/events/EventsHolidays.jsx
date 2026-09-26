import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../hooks/useLocalization';
import { SparklesIcon } from '@heroicons/react/24/outline';
import StatCard from '../common/StatCard/StatCard';
import eventsService from '../../services/events/events.service';
import AllEvents from './tabs/AllEvents';
import AddEvent from './tabs/AddEvent';
import HolidayManagement from './tabs/HolidayManagement';
import CalendarView from './tabs/CalendarView';
import EventGallery from './tabs/EventGallery';

const tabs = ['Events', 'Add Event', 'Holidays', 'Calendar View', 'Event Gallery'];

const tabComponents = {
  Events: AllEvents,
  'Add Event': AddEvent,
  Holidays: HolidayManagement,
  'Calendar View': CalendarView,
  'Event Gallery': EventGallery,
};

const EventsHolidays = () => {
  const { t } = useTranslation();
  const tabLabels = {
    'Events': `${t('event')}s`,
    'Add Event': t('addEvent'),
    'Holidays': `${t('holiday')}s`,
    'Calendar View': 'Calendar View',
    'Event Gallery': t('eventGallery'),
  };
  const [activeTab, setActiveTab] = useState('Events');
  const [refreshKey, setRefreshKey] = useState(0);
  const [editEvent, setEditEvent] = useState(null);
  const [editHoliday, setEditHoliday] = useState(null);
  const [stats, setStats] = useState({ totalEvents: 0, totalHolidays: 0, upcomingEvents: 0, upcomingHolidays: 0 });

  useEffect(() => {
    eventsService.getStats().then(setStats).catch(() => setStats({ totalEvents: 0, totalHolidays: 0, upcomingEvents: 0, upcomingHolidays: 0 }));
  }, [refreshKey]);

  const ActiveComponent = tabComponents[activeTab];

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
              key={tab}
              onClick={() => {
                if (tab !== 'Add Event') setEditEvent(null);
                if (tab !== 'Holidays') setEditHoliday(null);
                setActiveTab(tab);
              }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </nav>
      </div>

      <ActiveComponent
        key={refreshKey}
        onDataChange={onDataChange}
        onEditEvent={activeTab === 'Events' ? handleEditEvent : undefined}
        editEvent={activeTab === 'Add Event' ? editEvent : undefined}
        onClearEdit={activeTab === 'Add Event' ? handleClearEdit : undefined}
        editHoliday={activeTab === 'Holidays' ? editHoliday : undefined}
        onEditHoliday={activeTab === 'Holidays' ? handleEditHoliday : undefined}
        onClearHolidayEdit={activeTab === 'Holidays' ? handleClearHolidayEdit : undefined}
      />
    </div>
  );
};

export default EventsHolidays;
