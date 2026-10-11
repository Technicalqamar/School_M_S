import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import userAccountRoutes from './routes/userAccount.routes.js';
import defaultPasswordRoutes from './routes/defaultPassword.routes.js';
import receptionistRoutes from './routes/receptionist.routes.js';
import receptionistPortalRoutes from './routes/receptionistPortal.routes.js';
import profileRoutes from './routes/profile.routes.js';
import studentRoutes from './routes/student.routes.js';
import studentPromotionRoutes from './routes/studentPromotion.routes.js';
import securityLockRoutes from './routes/securityLock.routes.js';
import teacherRoutes from './routes/teacher.routes.js';
import classRoutes from './routes/class.routes.js';
import subjectRoutes from './routes/subject.routes.js';
import examRoutes from './routes/exam.routes.js';
import examSubjectRoutes from './routes/examSubject.routes.js';
import markRoutes from './routes/mark.routes.js';
import examScheduleRoutes from './routes/examSchedule.routes.js';
import admitCardRoutes from './routes/admitCard.routes.js';
import resultRoutes from './routes/result.routes.js';
import timeSlotRoutes from './routes/timeSlot.routes.js';
import timetableEntryRoutes from './routes/timetableEntry.routes.js';
import timetableDesignerRoutes from './routes/timetableDesigner.routes.js';
import schoolSettingsRoutes from './routes/schoolSettings.routes.js';
import studentAttendanceRoutes from './routes/studentAttendance.routes.js';
import teacherAttendanceRoutes from './routes/teacherAttendance.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import idCardManagementRoutes from './routes/idCardManagement.routes.js';
import eventRoutes from './routes/event.routes.js';
import holidayRoutes from './routes/holiday.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import eventGalleryRoutes from './routes/eventGallery.routes.js';
import feeStructureRoutes from './routes/feeStructure.routes.js';
import feeCollectionRoutes from './routes/feeCollection.routes.js';
import feeOutstandingRoutes from './routes/feeOutstanding.routes.js';
import feeReportRoutes from './routes/feeReport.routes.js';
import feeVoucherRoutes from './routes/feeVoucher.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import teacherDashboardRoutes from './routes/teacherDashboard.routes.js';
import teacherMyClassesRoutes from './routes/teacherMyClasses.routes.js';
import teacherClassStudentsRoutes from './routes/teacherClassStudents.routes.js';
import teacherHomeworkRoutes from './routes/teacherHomework.routes.js';
import teacherMarksEntryRoutes from './routes/teacherMarksEntry.routes.js';
import teacherMyResultsRoutes from './routes/teacherMyResults.routes.js';
import teacherClassScheduleRoutes from './routes/teacherClassSchedule.routes.js';
import teacherAttendancePortalRoutes from './routes/teacherAttendancePortal.routes.js';
import teacherLeaveRequestRoutes from './routes/teacherLeaveRequest.routes.js';
import teacherStudentAttendanceRoutes from './routes/teacherStudentAttendance.routes.js';
import teacherNotificationRoutes from './routes/teacherNotification.routes.js';
import studentDashboardRoutes from './routes/studentDashboard.routes.js';
import studentHomeworkRoutes from './routes/studentHomework.routes.js';
import studentFeesRoutes from './routes/studentFees.routes.js';
import studentClassScheduleRoutes from './routes/studentClassSchedule.routes.js';
import studentPortalAttendanceRoutes from './routes/studentPortalAttendance.routes.js';
import studentLeaveRequestRoutes from './routes/studentLeaveRequest.routes.js';
import studentPortalExamRoutes from './routes/studentPortalExam.routes.js';
import studentNotificationRoutes from './routes/studentNotification.routes.js';
import communicationSmsRoutes from './routes/communicationSms.routes.js';
import noticeRoutes from './routes/notice.routes.js';
import studentNoticeRoutes from './routes/studentNotice.routes.js';
import teacherNoticeRoutes from './routes/teacherNotice.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import portalRoutes from './routes/portal.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';

dotenv.config();

const app = express();

// Security headers (cross-origin to allow frontend on different port to load images)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);

// Response compression
app.use(compression());

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/user-accounts', userAccountRoutes);
app.use('/api/v1/default-passwords', defaultPasswordRoutes);
app.use('/api/v1/receptionists', receptionistRoutes);
app.use('/api/v1/receptionist', receptionistPortalRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/students', studentPromotionRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/auth/security-lock', securityLockRoutes);
app.use('/api/v1/teachers', teacherRoutes);
app.use('/api/v1/classes', classRoutes);
app.use('/api/v1/subjects', subjectRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/exam-subjects', examSubjectRoutes);
app.use('/api/v1/marks', markRoutes);
app.use('/api/v1/exam-schedules', examScheduleRoutes);
app.use('/api/v1/admit-cards', admitCardRoutes);
app.use('/api/v1/results', resultRoutes);
app.use('/api/v1/school-settings', schoolSettingsRoutes);
app.use('/api/v1/time-slots', timeSlotRoutes);
// Designer must be mounted BEFORE the /api/v1/timetable router so the
// `/designer` path is never caught by that router's `/:id` handler.
app.use('/api/v1/timetable/designer', timetableDesignerRoutes);
app.use('/api/v1/timetable', timetableEntryRoutes);
app.use('/api/v1/student-attendance', studentAttendanceRoutes);
app.use('/api/v1/teacher-attendance', teacherAttendanceRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/id-cards', idCardManagementRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/holidays', holidayRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/event-gallery', eventGalleryRoutes);
app.use('/api/v1/fees/structures', feeStructureRoutes);
app.use('/api/v1/fees/collections', feeCollectionRoutes);
app.use('/api/v1/fees/outstanding-dues', feeOutstandingRoutes);
app.use('/api/v1/fees/reports', feeReportRoutes);
app.use('/api/v1/fees/vouchers', feeVoucherRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/teacher/dashboard', teacherDashboardRoutes);
app.use('/api/v1/teacher/my-classes', teacherMyClassesRoutes);
app.use('/api/v1/teacher/my-classes', teacherClassStudentsRoutes);
app.use('/api/v1/teacher/homework', teacherHomeworkRoutes);
app.use('/api/v1/teacher/marks-entry', teacherMarksEntryRoutes);
app.use('/api/v1/teacher/my-results', teacherMyResultsRoutes);
app.use('/api/v1/teacher/class-schedule', teacherClassScheduleRoutes);
app.use('/api/v1/teacher/attendance', teacherAttendancePortalRoutes);
app.use('/api/v1/teacher/leave-requests', teacherLeaveRequestRoutes);
app.use('/api/v1/teacher/student-attendance', teacherStudentAttendanceRoutes);
app.use('/api/v1/teacher/notifications', teacherNotificationRoutes);
app.use('/api/v1/teacher/notices', teacherNoticeRoutes);
app.use('/api/v1/student/dashboard', studentDashboardRoutes);
app.use('/api/v1/student/homework', studentHomeworkRoutes);
app.use('/api/v1/student/fees', studentFeesRoutes);
app.use('/api/v1/student/class-schedule', studentClassScheduleRoutes);
app.use('/api/v1/student/attendance', studentPortalAttendanceRoutes);
app.use('/api/v1/student/leave-requests', studentLeaveRequestRoutes);
app.use('/api/v1/student/exam', studentPortalExamRoutes);
app.use('/api/v1/student/notifications', studentNotificationRoutes);
app.use('/api/v1/student/notices', studentNoticeRoutes);
app.use('/api/v1/communication/sms', communicationSmsRoutes);
app.use('/api/v1/communication/notices', noticeRoutes);
app.use('/api/v1/communication/notifications', notificationRoutes);
app.use('/api/v1/portal', portalRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handling middleware
app.use(errorHandler);

export default app;
