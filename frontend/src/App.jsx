import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RealtimeProvider } from './realtime/RealtimeProvider';
import { SchoolConfigProvider, useSchoolConfig } from './contexts/SchoolConfigContext';
import { LoaderProvider } from './contexts/LoaderContext';
import SplashScreen from './components/common/SplashScreen/SplashScreen';
import FullPageLoader from './components/common/FullPageLoader/FullPageLoader';
import ProtectedRoute from './components/ProtectedRoute';
import RequireModule from './components/RequireModule';
import RequireAdmin from './components/RequireAdmin';
import { ADMIN_MODULES } from './constants/adminModules';
import { findFirstAccessibleModulePath, getPortalBasePath } from './constants/receptionistPermissions';

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
import StudentFeeReminders from './pages/student/StudentFeeReminders';
import StudentNotices from './pages/student/StudentNotices';
import PortalAccess from './pages/portal/PortalAccess';
import PortalDashboard from './pages/portal/PortalDashboard';
import AdminLayout from './layouts/AdminLayout';
import TeacherLayout from './layouts/TeacherLayout';
import StudentLayout from './layouts/StudentLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentManagement from './pages/admin/StudentManagement';
import StudentProfilePage from './pages/admin/StudentProfile';
import StudentAttendanceHistoryPage from './components/student/SingleStudent/StudentAttendanceHistory';
import StudentIdCardPage from './components/student/SingleStudent/StudentIdCard';
import {
  StudentOverviewPage,
  StudentAcademicPage,
  StudentFeesPage,
  StudentDocumentsPage,
  StudentOtherPage,
  StudentExamRecordsPage,
  StudentAdmitCardPage,
} from './components/student/SingleStudent/SingleStudentPages';
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
import FeeRemindersPage from './pages/admin/FeeManagement/FeeReminders';
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
import ReceptionistLoginPage from './pages/auth/ReceptionistAuth/ReceptionistLogin';
import ReceptionistManagementPage from './pages/admin/ReceptionistManagement';
import AccessDeniedPage from './pages/admin/AccessDenied';

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
    // Receptionists share the Admin pages, but under the `/receptionist`
    // namespace. They land on their first granted module (or an honest
    // "access denied" screen when nothing is granted).
    if (role === 'receptionist') {
      const landing = findFirstAccessibleModulePath(user);
      return <Navigate to={landing || '/receptionist/access-denied'} replace />;
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
  const { role } = useAuth();

  // Wait for the real saved setting before deciding where to send the user.
  if (configLoading) return <FullPageLoader />;

  if (!preferences?.smsModuleEnabled) {
    // Stay inside the signed-in portal's namespace (Admin vs Receptionist).
    return <Navigate to={`${getPortalBasePath(role)}/communication/notices`} replace />;
  }

  return children;
}

function renderAdminShell(basePath) {
  return (
    <Route key={basePath} path={basePath} element={<AdminLayout />}>
            <Route
              index
              element={
                <RequireModule module="dashboard">
                  <AdminDashboard />
                </RequireModule>
              }
            />
            <Route
              path="students"
              element={
                <RequireModule module="student-management">
                  <StudentManagement />
                </RequireModule>
              }
            />
            <Route
              path="students/:studentId"
              element={
                <RequireModule module="student-management" page="all-students">
                  <StudentProfilePage />
                </RequireModule>
              }
            >
              <Route index element={<StudentOverviewPage />} />
              <Route path="academic" element={<StudentAcademicPage />} />
              <Route path="attendance" element={<StudentAttendanceHistoryPage />} />
              <Route path="exams" element={<StudentExamRecordsPage />} />
              <Route path="admit-card" element={<StudentAdmitCardPage />} />
              <Route path="fees" element={<StudentFeesPage />} />
              <Route path="id-card" element={<StudentIdCardPage />} />
              <Route path="documents" element={<StudentDocumentsPage />} />
              <Route path="other" element={<StudentOtherPage />} />
            </Route>
            <Route
              path="teachers"
              element={
                <RequireModule module="teacher-management">
                  <TeacherManagement />
                </RequireModule>
              }
            />
            <Route
              path="classes"
              element={
                <RequireModule module="class-management">
                  <ClassManagement />
                </RequireModule>
              }
            />
            <Route
              path="subjects"
              element={
                <RequireModule module="subject-management">
                  <SubjectManagement />
                </RequireModule>
              }
            />
            <Route
              path="timetable"
              element={
                <RequireModule module="timetable-management">
                  <TimetableManagement />
                </RequireModule>
              }
            />
            <Route
              path="attendance"
              element={
                <RequireModule module="attendance-management">
                  <AttendanceManagement />
                </RequireModule>
              }
            />
            <Route
              path="events"
              element={
                <RequireModule module="events-and-holidays">
                  <EventsHolidays />
                </RequireModule>
              }
            />
            <Route
              path="payroll"
              element={
                <RequireModule module="payroll-management">
                  <PayrollManagement />
                </RequireModule>
              }
            />
            <Route
              path="fees/fee-structure"
              element={
                <RequireModule module="fee-management" page="fee-structure">
                  <FeeStructurePage />
                </RequireModule>
              }
            />
            <Route
              path="fees/collect-fee"
              element={
                <RequireModule module="fee-management" page="collect-fee">
                  <CollectFeePage />
                </RequireModule>
              }
            />
            <Route
              path="fees/student-fee-details"
              element={
                <RequireModule module="fee-management" page="student-fee-details">
                  <StudentFeeDetailsPage />
                </RequireModule>
              }
            />
            <Route
              path="fees/reports"
              element={
                <RequireModule module="fee-management" page="reports">
                  <FeeReportsPage />
                </RequireModule>
              }
            />
            <Route
              path="fees/outstanding-dues"
              element={
                <RequireModule module="fee-management" page="outstanding-dues">
                  <OutstandingDuesPage />
                </RequireModule>
              }
            />
            <Route
              path="fees/reminders"
              element={
                <RequireModule module="fee-management" page="reminders">
                  <FeeRemindersPage />
                </RequireModule>
              }
            />
            <Route
              path="fees/voucher-generation"
              element={
                <RequireModule module="fee-management" page="voucher-generation">
                  <FeeVoucherGenerationPage />
                </RequireModule>
              }
            />
            <Route
              path="communication/sms"
              element={
                <RequireModule module="communication" page="sms">
                  <SmsRouteGuard>
                    <SmsPage />
                  </SmsRouteGuard>
                </RequireModule>
              }
            />
            <Route
              path="communication/notices"
              element={
                <RequireModule module="communication" page="notices">
                  <NoticesPage />
                </RequireModule>
              }
            />
            <Route
              path="communication/notifications"
              element={
                <RequireModule module="communication" page="notifications">
                  <NotificationsPage />
                </RequireModule>
              }
            />
            <Route
              path="settings"
              element={
                <RequireModule module="school-settings">
                  <SchoolSettings />
                </RequireModule>
              }
            />
            <Route
              path="exams/setup"
              element={
                <RequireModule module="exam-management" page="exam-setup">
                  <ExamSetupPage />
                </RequireModule>
              }
            />
            <Route
              path="exams/subjects-marks"
              element={
                <RequireModule module="exam-management" page="subjects-marks">
                  <SubjectMarksPage />
                </RequireModule>
              }
            />
            <Route
              path="exams/schedule"
              element={
                <RequireModule module="exam-management" page="exam-schedule">
                  <ExamSchedulePage />
                </RequireModule>
              }
            />
            <Route
              path="exams/marks-entry"
              element={
                <RequireModule module="exam-management" page="marks-entry">
                  <MarksEntryPage />
                </RequireModule>
              }
            />
            <Route
              path="exams/admit-card"
              element={
                <RequireModule module="exam-management" page="admit-card">
                  <AdmitCardPage />
                </RequireModule>
              }
            />
            <Route
              path="exams/results"
              element={
                <RequireModule module="exam-management" page="results">
                  <ResultsPage />
                </RequireModule>
              }
            />
            <Route
              path="exams/result-history"
              element={
                <RequireModule module="exam-management" page="result-history">
                  <ResultHistoryPage />
                </RequireModule>
              }
            />
            <Route
              path="accounts/all"
              element={
                <RequireModule module="user-accounts" page="all-accounts">
                  <AllAccountsPage />
                </RequireModule>
              }
            />
            <Route
              path="accounts/create"
              element={
                <RequireModule module="user-accounts" page="create-account">
                  <CreateAccountPage />
                </RequireModule>
              }
            />
            <Route
              path="accounts/access"
              element={
                <RequireModule module="user-accounts" page="account-access">
                  <AccountAccessPage />
                </RequireModule>
              }
            />
            {/* Receptionist Management: Admin-only. The route guard here and the
                backend `authorize('admin')` together keep every receptionist
                (including their own records) out of this module. */}
            <Route
              path="receptionists"
              element={
                <RequireAdmin>
                  <ReceptionistManagementPage />
                </RequireAdmin>
              }
            />
            <Route path="access-denied" element={<AccessDeniedPage />} />
    </Route>
  );
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

        {/* Shared Admin shell. Admins and receptionists both live here: a
            receptionist opens the same pages an Admin uses (no duplicate
            portal), mounted under the `/admin` and `/receptionist`
            namespaces respectively. Every page is additionally gated by
            RequireModule, which checks the receptionist's stored permission
            set before rendering. The backend re-checks all of this server-side. */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'receptionist']} />}>
          {renderAdminShell('/admin')}
          {renderAdminShell('/receptionist')}
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
            <Route path="fee-reminders" element={<StudentFeeReminders />} />
            <Route path="examination" element={<StudentExamination />} />
            <Route path="class-schedule" element={<StudentClassSchedule />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="notices" element={<StudentNotices />} />
          </Route>
        </Route>

        <Route path="/portal/access" element={<PortalAccess />}>
          <Route index element={<PortalDashboard />} />
          <Route path="homework" element={<StudentHomework />} />
          <Route path="homework/:assignmentId" element={<StudentAssignmentDetail />} />
          <Route path="fees" element={<StudentFees />} />
          <Route path="fee-reminders" element={<StudentFeeReminders />} />
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
      <RealtimeProvider>
        <SchoolConfigProvider>
          <LoaderProvider>
            <AppContent />
          </LoaderProvider>
        </SchoolConfigProvider>
      </RealtimeProvider>
    </AuthProvider>
  );
}

export default App;