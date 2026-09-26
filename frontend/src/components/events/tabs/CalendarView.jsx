import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../../hooks/useLocalization';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Modal from '../../common/Modal/Modal';
import eventsService from '../../../services/events/events.service';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getItemColor = (item) => {
  if (item.type === 'holiday') return 'red';
  const examCats = ['Examination'];
  const meetingCats = ['Teachers Day', 'Parents Meeting'];
  const sportsCats = ['Sports Day'];
  if (examCats.includes(item.category)) return 'orange';
  if (meetingCats.includes(item.category)) return 'purple';
  if (sportsCats.includes(item.category)) return 'green';
  return 'blue';
};

const getItemEmoji = (item) => {
  if (item.type === 'holiday') return '🏖️';
  const color = getItemColor(item);
  if (color === 'orange') return '📝';
  if (color === 'purple') return '🤝';
  if (color === 'green') return '🏆';
  return '🎉';
};

const colorClasses = {
  red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800',
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 border-green-200 dark:border-green-800',
};

const dateCircleColors = {
  red: 'bg-red-500 text-white shadow-sm',
  blue: 'bg-blue-500 text-white shadow-sm',
  orange: 'bg-orange-500 text-white shadow-sm',
  purple: 'bg-purple-500 text-white shadow-sm',
  green: 'bg-green-500 text-white shadow-sm',
};

const COLOR_PRIORITY = ['red', 'orange', 'purple', 'green', 'blue'];

const CalendarView = ({ onDataChange }) => {
  const { t } = useTranslation();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [selectedItem, setSelectedItem] = useState(null);
  const [allItems, setAllItems] = useState([]);

  const fetchCalendarData = useCallback(async () => {
    try {
      const fromDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const toDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const [events, holidays] = await Promise.all([
        eventsService.getCalendarEvents({ fromDate, toDate }),
        eventsService.getCalendarHolidays({ fromDate, toDate }),
      ]);
      setAllItems([
        ...(events || []).map((e) => ({ ...e, type: 'event', id: e._id })),
        ...(holidays || []).map((h) => ({ ...h, type: 'holiday', id: h._id })),
      ]);
    } catch {
      setAllItems([]);
    }
  }, [currentYear, currentMonth]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const today = new Date();
  const isToday = (day) => today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  const totalCells = firstDayOfWeek + daysInMonth;
  const trailingEmpty = (7 - (totalCells % 7)) % 7;

  const goToday = () => {
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
  };

  const getItemsForDate = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allItems.filter((item) => {
      if (item.type === 'event') {
        const d = item.date ? item.date.split('T')[0] : '';
        return d === dateStr;
      }
      const s = item.startDate ? item.startDate.split('T')[0] : '';
      const e = item.endDate ? item.endDate.split('T')[0] : '';
      return s <= dateStr && e >= dateStr;
    });
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-800/90 dark:to-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button onClick={prevMonth}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-200/70 dark:hover:bg-gray-700/60 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer">
              <ChevronLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button onClick={nextMonth}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-gray-200/70 dark:hover:bg-gray-700/60 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer">
              <ChevronRightIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <button onClick={goToday}
              className="ml-1 sm:ml-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700/60 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all cursor-pointer shadow-sm">
              {t('today')}
            </button>
          </div>
          <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 dark:text-white">
            {MONTHS[currentMonth]} {currentYear}
          </h2>
          <div className="w-28 sm:w-36" />
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Weekday Headers */}
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider py-1.5 sm:py-2">
              {d}
            </div>
          ))}

          {/* Leading Empty Cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`lead-${i}`} className="min-h-[70px] sm:min-h-[90px] lg:min-h-[105px]" />
          ))}

          {/* Date Boxes */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const items = getItemsForDate(day);
            const todayFlag = isToday(day);

            let dateColor = null;
            if (!todayFlag && items.length > 0) {
              const presentColors = [...new Set(items.map(getItemColor))];
              dateColor = COLOR_PRIORITY.find((c) => presentColors.includes(c)) || presentColors[0];
            }

            return (
              <div key={day}
                className={`min-h-[70px] sm:min-h-[90px] lg:min-h-[105px] p-1.5 sm:p-2 lg:p-2.5 rounded-xl border shadow-sm transition-all duration-200 flex flex-col ${
                  todayFlag
                    ? 'border-blue-400 dark:border-blue-500 shadow-blue-100 dark:shadow-blue-900/20 bg-blue-50/80 dark:bg-blue-900/15'
                    : items.length > 0
                      ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-0.5'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-0.5'
                }`}>
                {/* Date Number */}
                <div className={`flex-shrink-0 text-sm sm:text-base lg:text-lg font-bold mb-1 ${
                  todayFlag
                    ? 'w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-sm'
                    : dateColor
                      ? `w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full ${dateCircleColors[dateColor]}`
                      : 'text-gray-700 dark:text-gray-200'
                }`}>
                  {day}
                </div>

                {/* Event Badges */}
                <div className="space-y-0.5 flex-1 overflow-hidden">
                  {items.slice(0, 3).map((item) => {
                    const color = getItemColor(item);
                    const emoji = getItemEmoji(item);
                    return (
                      <button key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`w-full text-left px-1.5 py-[2px] sm:py-0.5 rounded-md text-[9px] sm:text-[10px] lg:text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${colorClasses[color]}`}>
                        <span className="flex-shrink-0 text-[10px] sm:text-xs leading-none">{emoji}</span>
                        <span className="truncate">{item.name}</span>
                      </button>
                    );
                  })}
                    {items.length > 3 && (
                    <span className="text-[9px] sm:text-[10px] text-gray-400 dark:text-gray-500 pl-1">
                      {t('moreEvents', { count: items.length - 3 })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Trailing Empty Cells */}
          {Array.from({ length: trailingEmpty }).map((_, i) => (
            <div key={`trail-${i}`} className="min-h-[70px] sm:min-h-[90px] lg:min-h-[105px]" />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-5 pt-4 border-t border-gray-200 dark:border-gray-700/60 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> {t('schoolEvents')}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" /> {t('sports')}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> {t('exams')}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> {t('meetings')}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> {t('holidays')}</span>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <Modal isOpen={true} onClose={() => setSelectedItem(null)}
          title={selectedItem.type === 'holiday' ? t('holidayDetails') : t('eventDetails')}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                selectedItem.type === 'holiday' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                {selectedItem.type === 'holiday' ? '🏖️' : '🎉'}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{selectedItem.name}</h3>
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  {selectedItem.type === 'holiday' ? t('holiday') : selectedItem.category}
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              {selectedItem.type === 'holiday' ? (
                <>
                  <Row label={t('startDate')} value={selectedItem.startDateDisplay} />
                  <Row label={t('endDate')} value={selectedItem.endDateDisplay} />
                  <Row label={t('duration')} value={`${selectedItem.totalDays} ${t('totalDays').toLowerCase().replace('total ', '')}`} />
                  <Row label={t('type')} value={selectedItem.type} />
                  <Row label={t('appliesTo')} value={selectedItem.appliesTo} />
                  {selectedItem.description && <Description text={selectedItem.description} />}
                </>
              ) : (
                <>
                  <Row label={t('dateLabel')} value={selectedItem.dateDisplay} />
                  <Row label={t('category')} value={selectedItem.category} />
                  <Row label={t('eventTimeLabel')} value={`${selectedItem.startTime} - ${selectedItem.endTime}`} />
                  <Row label={t('venue')} value={selectedItem.venue} />
                  <Row label={t('audience')} value={selectedItem.audience} />
                  <Row label={t('status')} value={selectedItem.status} />
                  {selectedItem.description && <Description text={selectedItem.description} />}
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Row = ({ label, value }) => (
  <div className="flex justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{value}</span>
  </div>
);

const Description = ({ text }) => (
  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
    <p className="text-xs text-gray-500 mb-1">Description</p>
    <p className="text-xs text-gray-700 dark:text-gray-300">{text}</p>
  </div>
);

export default CalendarView;
