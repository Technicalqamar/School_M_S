import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SchoolConfigProvider, useSchoolConfig } from './contexts/SchoolConfigContext';
import { LoaderProvider } from './contexts/LoaderContext';
import SplashScreen from './components/common/SplashScreen/SplashScreen';
import FullPageLoader from './components/common/FullPageLoader/FullPageLoader';
import ProtectedRoute from './components/ProtectedRoute';
import { ADMIN_MODULES } from './constants/adminModules';

import AdminLoginPage from './pages/auth/AdminAuth/AdminLogin';
import AdminForgotPasswordPage from './pages/auth/AdminAuth/ForgotPassword';
import AdminVerifyOTPPage from './pages/auth/AdminAuth/VerifyOTP';
import AdminResetPasswordPage from './pages/auth/AdminAuth/ResetPassword';
import TeacherLoginPage from './pages/auth/TeacherAuth/TeacherLogin';
import StudentLoginPage from './pages/auth/StudentAuth/StudentLogin';
import ChangePasswordPage from './pages/auth/ChangePassword/ChangePassword';
import Landing from './pages/public/Landing';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherMyClasses from './pages/teacher/MyClasses';
import TeacherClassStudents from './pages/teacher/ClassStudents';
import TeacherHomeworkAssignments from './pages/teacher/HomeworkAssignments';
import TeacherMarksEntry from './pages/teacher/MarksEntry';
import TeacherMyResults from './pages/teacher/MyResults';
import TeacherClassSchedule from './pages/teacher/TeacherClassSchedule';
import TeacherAttendance from './pages/teacher/TeacherAttendance';
import TeacherNotifications from './pages/teacher/TeacherNotifications';
import TeacherNotices from './pages/teacher/TeacherNotices';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentHomework from './pages/student/StudentHomework';
import StudentAssignmentDetail from './pages/student/StudentAssignmentDetail';
import StudentFees from './pages/student/StudentFees';
import StudentClassSchedule from './pages/student/StudentClassSchedule';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentExamination from './pages/student/StudentExamination';
import StudentNotifications from './pages/student/StudentNotifications';
import StudentNotices from './pages/student/StudentNotices';
import PortalAccess from './pages/portal/PortalAccess';
import PortalDashboard from './pages/portal/PortalDashboard';
import AdminLayout from './layouts/AdminLayout';
import TeacherLayout from './layouts/TeacherLayout';
import StudentLayout from './layouts/StudentLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentManagement from './pages/admin/StudentManagement';
import StudentProfilePage from './pages/admin/StudentProfile';
import TeacherManagement from './pages/admin/TeacherManagement';
import ClassManagement from './pages/admin/ClassManagement';
import SubjectManagement from './pages/admin/SubjectManagement';
import TimetableManagement from './pages/admin/TimetableManagement';
import AttendanceManagement from './pages/admin/AttendanceManagement';
import EventsHolidays from './pages/admin/EventsHolidays';
import PayrollManagement from './pages/admin/PayrollManagement/PayrollManagement';
import FeeStructurePage from './pages/admin/FeeManagement/FeeStructure';
import CollectFeePage from './pages/admin/FeeManagement/CollectFee';
import StudentFeeDetailsPage from './pages/admin/FeeManagement/StudentFeeDetails';
import FeeReportsPage from './pages/admin/FeeManagement/Reports';
import OutstandingDuesPage from './pages/admin/FeeManagement/OutstandingDues';
import FeeVoucherGenerationPage from './pages/admin/FeeManagement/FeeVoucherGeneration';
import SmsPage from './pages/admin/Communication/Sms';
import NoticesPage from './pages/admin/Communication/Notices';
import NotificationsPage from './pages/admin/Communication/Notifications';
import SchoolSettings from './pages/admin/SchoolSettings';
import ExamSetupPage from './pages/admin/ExamManagement/ExamSetup';
import SubjectMarksPage from './pages/admin/ExamManagement/SubjectMarks';
import ExamSchedulePage from './pages/admin/ExamManagement/ExamSchedule';
import MarksEntryPage from './pages/admin/ExamManagement/MarksEntry';
import AdmitCardPage from './pages/admin/ExamManagement/AdmitCard';
import ResultsPage from './pages/admin/ExamManagement/Results';
import ResultHistoryPage from './pages/admin/ExamManagement/ResultHistory';
import AllAccountsPage from './pages/admin/UserAccounts/AllAccounts';
import CreateAccountPage from './pages/admin/UserAccounts/CreateAccount';
import AccountAccessPage from './pages/admin/UserAccounts/AccountAccess';
import ReceptionistAccountsPage from './pages/admin/UserAccounts/ReceptionistAccounts';
import ReceptionistLoginPage from './pages/auth/ReceptionistAuth/ReceptionistLogin';
import ReceptionistLayout from './layouts/ReceptionistLayout';
import ReceptionistDashboard from './pages/receptionist/ReceptionistDashboard';
import StudentRecords from './pages/receptionist/StudentRecords';
import ReceptionistAttendance from './pages/receptionist/ReceptionistAttendance';
import ReceptionistFees from './pages/receptionist/ReceptionistFees';
import ReceptionistNotices from './pages/receptionist/ReceptionistNotices';
import ModuleUnavailable from './pages/receptionist/ModuleUnavailable';
import RequirePermission from './components/receptionist/RequirePermission';

function IndexRedirect() {
  const { user, role, loading: authLoading, DASHBOARD_ROUTES, CHANGE_PASSWORD_ROUTES } = useAuth();
  const { loading: configLoading, preferences } = useSchoolConfig();

  if (authLoading) return null;
  if (!user || !role) return <Landing />;

  if (role !== 'admin') {
    // First-login portal users land on the change-password screen, never the
    // dashboard (whose shells would fire blocked requests).
    if (user.mustChangePassword === true && CHANGE_PASSWORD_ROUTES[role]) {
      return <Navigate to={CHANGE_PASSWORD_ROUTES[role]} replace />;
    }
    return <Navigate to={DASHBOARD_ROUTES[role] || '/admin/login'} replace />;
  }

  if (configLoading) return <FullPageLoader />;

  const landingPage = preferences?.defaultLandingPage;
  const route = ADMIN_MODULES[landingPage] || '/admin';
  return <Navigate to={route} replace />;
}

function SmsRouteGuard({ children }) {
  const { loading: configLoading, preferences } = useSchoolConfig();

  // Wait for the real saved setting before deciding where to send the user.
  if (configLoading) return <FullPageLoader />;

  if (!preferences?.smsModuleEnabled) {
    return <Navigate to="/admin/communication/notices" replace />;
  }

  return children;
}

function AppContent() {
  const { loading: authLoading } = useAuth();
  const { loaded: configLoaded, login: loginConfig } = useSchoolConfig();
  const splashEnabled = configLoaded ? (loginConfig?.splashEnabled ?? true) : true;
  const loaderStyle = configLoaded ? (loginConfig?.loaderStyle || '') : '';

  const [splashTimerExpired, setSplashTimerExpired] = useState(false);

  useEffect(() => {
    if (authLoading || !splashEnabled) return;
    const resetId = setTimeout(() => setSplashTimerExpired(false), 0);
    const timerId = setTimeout(() => setSplashTimerExpired(true), 1200);
    return () => { clearTimeout(resetId); clearTimeout(timerId); };
  }, [authLoading, splashEnabled]);

  const splashVisible = authLoading || (splashEnabled && !splashTimerExpired);

  return (
    <>
      <SplashScreen visible={splashVisible} loaderStyle={loaderStyle} />
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
        <Route path="/admin/verify-otp" element={<AdminVerifyOTPPage />} />
        <Route path="/admin/reset-password" element={<AdminResetPasswordPage />} />
        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route path="/student/login" element={<StudentLoginPage />} />
        <Route path="/receptionist/login" element={<ReceptionistLoginPage />} />

        {/* First-login password change: authenticated, but deliberately NOT
            wrapped in the portal layouts so no protected data request fires. */}
        <Route element={<ProtectedRoute allowedRoles={['teacher']} allowPasswordChange />}>
          <Route path="/teacher/change-password" element={<ChangePasswordPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['student']} allowPasswordChange />}>
          <Route path="/student/change-password" element={<ChangePasswordPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['receptionist']} allowPasswordChange />}>
          <Route path="/receptionist/change-password" element={<ChangePasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="students" element={<StudentManagement />} />
            <Route path="students/:studentId" element={<StudentProfilePage />} />
            <Route path="teachers" element={<TeacherManagement />} />
            <Route path="classes" element={<ClassManagement />} />
            <Route path="subjects" element={<SubjectManagement />} />
            <Route path="timetable" element={<TimetableManagement />} />
            <Route path="attendance" element={<AttendanceManagement />} />
            <Route path="events" element={<EventsHolidays />} />
            <Route path="payroll" element={<PayrollManagement />} />
            <Route path="fees/fee-structure" element={<FeeStructurePage />} />
            <Route path="fees/collect-fee" element={<CollectFeePage />} />
            <Route path="fees/student-fee-details" element={<StudentFeeDetailsPage />} />
            <Route path="fees/reports" element={<FeeReportsPage />} />
            <Route path="fees/outstanding-dues" element={<OutstandingDuesPage />} />
            <Route path="fees/voucher-generation" element={<FeeVoucherGenerationPage />} />
            <Route path="communication/sms" element={<SmsRouteGuard><SmsPage /></SmsRouteGuard>} />
            <Route path="communication/notices" element={<NoticesPage />} />
            <Route path="communication/notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<SchoolSettings />} />
            <Route path="exams/setup" element={<ExamSetupPage />} />
            <Route path="exams/subjects-marks" element={<SubjectMarksPage />} />
            <Route path="exams/schedule" element={<ExamSchedulePage />} />
            <Route path="exams/marks-entry" element={<MarksEntryPage />} />
            <Route path="exams/admit-card" element={<AdmitCardPage />} />
            <Route path="exams/results" element={<ResultsPage />} />
            <Route path="exams/result-history" element={<ResultHistoryPage />} />
            <Route path="accounts/all" element={<AllAccountsPage />} />
            <Route path="accounts/create" element={<CreateAccountPage />} />
            <Route path="accounts/access" element={<AccountAccessPage />} />
            <Route path="accounts/receptionists" element={<ReceptionistAccountsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
          <Route path="/teacher/dashboard" element={<TeacherLayout />}>
            <Route index element={<TeacherDashboard />} />
            <Route path="my-classes" element={<TeacherMyClasses />} />
            <Route path="my-classes/:classId" element={<TeacherClassStudents />} />
            <Route path="homework" element={<TeacherHomeworkAssignments />} />
            <Route path="marks-entry" element={<TeacherMarksEntry />} />
            <Route path="my-results" element={<TeacherMyResults />} />
            <Route path="class-schedule" element={<TeacherClassSchedule />} />
            <Route path="attendance" element={<TeacherAttendance />} />
            <Route path="notifications" element={<TeacherNotifications />} />
            <Route path="notices" element={<TeacherNotices />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['student']} />}>
          <Route path="/student/dashboard" element={<StudentLayout />}>
            <Route index element={<StudentDashboard />} />
            <Route path="homework" element={<StudentHomework />} />
            <Route path="homework/:assignmentId" element={<StudentAssignmentDetail />} />
            <Route path="fees" element={<StudentFees />} />
            <Route path="examination" element={<StudentExamination />} />
            <Route path="class-schedule" element={<StudentClassSchedule />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="notices" element={<StudentNotices />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['receptionist']} />}>
          {/* Pathless parent: each module owns a real URL (/receptionist/students,
              /receptionist/attendance, ...) that matches the sidebar navigation.
              Previously these were nested under /receptionist/dashboard, so every
              sidebar link resolved to an unmatched route and bounced the user back
              to the dashboard. */}
          <Route element={<ReceptionistLayout />}>
            <Route
              path="/receptionist/dashboard"
              element={
                <RequirePermission permission="dashboard.view">
                  <ReceptionistDashboard />
                </RequirePermission>
              }
            />
            <Route
              path="/receptionist/students"
              element={
                <RequirePermission permission="students.view">
                  <StudentRecords />
                </RequirePermission>
              }
            />
            <Route
              path="/receptionist/attendance"
              element={
                <RequirePermission permission="attendance.view">
                  <ReceptionistAttendance />
                </RequirePermission>
              }
            />
            <Route
              path="/receptionist/fees"
              element={
                <RequirePermission permission="fees.view">
                  <ReceptionistFees />
                </RequirePermission>
              }
            />
            <Route
              path="/receptionist/notices"
              element={
                <RequirePermission permission="notices.view">
                  <ReceptionistNotices />
                </RequirePermission>
              }
            />

            {/* Genuinely unimplemented modules keep an honest "not available" page
                instead of silently bouncing to the dashboard. They are static
                face pages only - no backend endpoint exists behind them, so a
                receptionist can never read real data here. */}
            <Route path="/receptionist/admissions" element={<ModuleUnavailable title="Admissions" />} />
            <Route
              path="/receptionist/parents"
              element={<ModuleUnavailable title="Parent / Contact Records" />}
            />
            <Route path="/receptionist/reports" element={<ModuleUnavailable title="Reports & Exports" />} />
          </Route>
        </Route>

        <Route path="/portal/access" element={<PortalAccess />}>
          <Route index element={<PortalDashboard />} />
          <Route path="homework" element={<StudentHomework />} />
          <Route path="homework/:assignmentId" element={<StudentAssignmentDetail />} />
          <Route path="fees" element={<StudentFees />} />
          <Route path="examination" element={<StudentExamination />} />
          <Route path="class-schedule" element={<StudentClassSchedule />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="notifications" element={<StudentNotifications />} />
          <Route path="notices" element={<StudentNotices />} />
        </Route>

        <Route path="/" element={<IndexRedirect />} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <SchoolConfigProvider>
        <LoaderProvider>
          <AppContent />
        </LoaderProvider>
      </SchoolConfigProvider>
    </AuthProvider>
  );
}

export default App;
