import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { hasModuleAccess } from '../../../constants/receptionistPermissions';
import studentService from '../../../services/student/student.service';
import { parseStudentRoute } from '../../../utils/singleStudent';
import { SelectedStudentContext } from './useSelectedStudent';

// The selected-student context is the single source of truth for "which
// student is the Single Student Management module currently working on". It is
// mounted once inside the shared Admin shell (AdminLayout) so BOTH the Sidebar
// (which renders the "Single Student Management" group) and the routed student
// workspace read the very same student - no duplicated fetch, and no chance of
// the two drifting apart.
//
// The identity is derived purely from the URL (`/admin/students/:studentId...`
// or `/receptionist/students/:studentId/...`), so a refresh or a direct link is
// authoritative and the selected student can never silently change. When the id
// is absent or the student cannot be loaded, the context reports an explicit
// status instead of substituting another student.

const IDLE_STATE = { student: null, studentId: null, status: 'idle', error: '' };

export const SelectedStudentProvider = ({ children }) => {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();

  const route = parseStudentRoute(location.pathname);
  const studentId = route?.studentId || null;

  // Opening a student workspace requires the same grant the route guard uses
  // (`student-management` -> `all-students`). Admins always pass. Checking here
  // avoids firing a request the guard would immediately reject.
  const canViewStudent = hasModuleAccess(user, 'student-management', 'all-students');

  const [state, setState] = useState(IDLE_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (authLoading) return undefined;

    let cancelled = false;

    const load = async () => {
      if (!studentId || !canViewStudent) {
        requestIdRef.current += 1;
        setState(IDLE_STATE);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setState((prev) => {
        if (prev.studentId === studentId && prev.student) {
          return { ...prev, status: 'loading', error: '' };
        }
        return { student: null, studentId, status: 'loading', error: '' };
      });

      try {
        const response = await studentService.getStudentById(studentId);
        if (cancelled || requestIdRef.current !== requestId) return;
        const student = response?.data?.student || null;
        setState({
          student,
          studentId,
          status: student ? 'ready' : 'notfound',
          error: '',
        });
      } catch (err) {
        if (cancelled || requestIdRef.current !== requestId) return;
        if (err?.response?.status === 404) {
          setState({ student: null, studentId, status: 'notfound', error: '' });
        } else {
          setState({
            student: null,
            studentId,
            status: 'error',
            error: err?.response?.data?.message || 'Failed to load student profile',
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [studentId, canViewStudent, authLoading, reloadKey]);

  const refresh = () => setReloadKey((key) => key + 1);

  return (
    <SelectedStudentContext.Provider
      value={{ ...state, basePath: route?.basePath || null, refresh }}
    >
      {children}
    </SelectedStudentContext.Provider>
  );
};

export default SelectedStudentProvider;
