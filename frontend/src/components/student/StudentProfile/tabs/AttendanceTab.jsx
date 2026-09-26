import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import CardSection from '../../../common/CardSection/CardSection';
import { EmptyState } from '../shared';

const AttendanceTab = ({ attendanceLoading = false }) => {
  if (attendanceLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">
        <CalendarDaysIcon className="h-8 w-8 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CardSection title="Monthly Attendance Summary">
        <EmptyState
          icon={CalendarDaysIcon}
          title="No attendance records available"
          message="Attendance information for this student is not available yet."
        />
      </CardSection>

      <CardSection title="Recent Attendance">
        <EmptyState
          icon={CalendarDaysIcon}
          title="Attendance history empty"
          message="Daily attendance records will appear here once attendance data is connected."
        />
      </CardSection>
    </div>
  );
};

export default AttendanceTab;