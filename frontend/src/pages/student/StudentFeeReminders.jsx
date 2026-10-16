import StudentNotifications from './StudentNotifications';

// Student Portal "Fee Reminders" area.
//
// There is no second inbox and no second notification system: this is the exact
// same Student Notifications page (same existing endpoints, same read/unread and
// mark-as-read conventions, same realtime sync), narrowed to the fee-reminder
// notification type. The server still scopes every row to the signed-in
// student's own account, so only that student's authorized records are shown.
//
// A stable module-level array (never an inline literal) keeps the page's fetch
// effect from re-running on every render.
const FEE_REMINDER_TYPES = ['FEE_REMINDER'];

const StudentFeeReminders = () => (
  <StudentNotifications
    filterTypes={FEE_REMINDER_TYPES}
    headingKey="feeReminders"
    subtitleKey="feeRemindersSubtitle"
  />
);

export default StudentFeeReminders;
