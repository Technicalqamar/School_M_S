import { useTranslation } from '../../../../hooks/useLocalization';
import { ClockIcon } from '@heroicons/react/24/outline';

const formatTime = (t) => t || '--:--';

const TimetableGrid = ({ periods, mode = 'class' }) => {
  const { t } = useTranslation();
  if (!periods || periods.length === 0) return null;

  const showTeacher = mode === 'class';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <th className="sticky top-0 z-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider min-w-[140px]">
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-3.5 w-3.5 opacity-80" />
                  <span>{t('startTime')}</span>
                </div>
              </th>
              {showTeacher ? (
                <>
                  <th className="sticky top-0 z-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider min-w-[120px]">{t('subject')}</th>
                  <th className="sticky top-0 z-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider min-w-[120px]">{t('teacher')}</th>
                </>
              ) : (
                <>
                  <th className="sticky top-0 z-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider min-w-[120px]">{t('classLabel')}</th>
                  <th className="sticky top-0 z-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider min-w-[120px]">{t('subject')}</th>
                </>
              )}
              <th className="sticky top-0 z-10 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider min-w-[90px]">{t('type')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {periods.map((period, idx) => {
              const isBreak = period.type === 'Break' || period.type === 'Break Period';
              const timeStr = `${formatTime(period.startTime)} - ${formatTime(period.endTime)}`;

              if (isBreak) {
                return (
                  <tr key={period.id || idx} className="bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                    <td className="px-4 py-3 text-xs font-medium text-amber-800 dark:text-amber-300 whitespace-nowrap">{timeStr}</td>
                    <td colSpan={showTeacher ? 2 : 2} className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        {t('status')} — {period.breakName || 'Recess'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase tracking-wider font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded">{t('other')}</span>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={period.id || idx} className="bg-white dark:bg-gray-800 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors">
                  <td className="px-4 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap border-r border-gray-100 dark:border-gray-700/50">{timeStr}</td>
                  {showTeacher ? (
                    <>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{period.subject || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                          {period.teacher || '-'}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{period.className || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{period.subject || '-'}</span>
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{t('type')}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TimetableGrid;
