import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import userAccountRoutes from './routes/userAccount.routes.js';
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
import timetableRoutes from './routes/timetable.routes.js';
import timetableDesignRoutes from './routes/timetableDesign.routes.js';
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
import studentDashboardRoutes from './routes/studentDashboard.routes.js';
import studentHomeworkRoutes from './routes/studentHomework.routes.js';
import studentFeesRoutes from './routes/studentFees.routes.js';
import portalRoutes from './routes/portal.routes.js';
import { errorHandler } from './middlewares/error.middleware.js';

dotenv.config();

const app = express();

// Security headers (cross-origin to allow frontend on different port to load images)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors());

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
app.use('/api/v1/timetables', timetableRoutes);
app.use('/api/v1/timetable-design', timetableDesignRoutes);
app.use('/api/v1/school-settings', schoolSettingsRoutes);
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
app.use('/api/v1/student/dashboard', studentDashboardRoutes);
app.use('/api/v1/student/homework', studentHomeworkRoutes);
app.use('/api/v1/student/fees', studentFeesRoutes);
app.use('/api/v1/portal', portalRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handling middleware
app.use(errorHandler);

export default app;
