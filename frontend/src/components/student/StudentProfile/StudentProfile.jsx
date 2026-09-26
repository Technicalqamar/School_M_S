import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeftIcon,
  UserCircleIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Spinner from '../../common/Spinner/Spinner';
import studentService from '../../../services/student/student.service';
import feeService from '../../../services/fee/fee.service';
import { EmptyState } from './shared';
import ProfileHeader from './ProfileHeader';
import OverviewTab from './tabs/OverviewTab';
import AcademicTab from './tabs/AcademicTab';
import AttendanceTab from './tabs/AttendanceTab';
import FeesTab from './tabs/FeesTab';

const TABS = [
  { key: 'overview', label: 'Overview', icon: UserCircleIcon },
  { key: 'academic', label: 'Academic', icon: AcademicCapIcon },
  { key: 'attendance', label: 'Attendance', icon: CalendarDaysIcon },
  { key: 'fees', label: 'Fees', icon: BanknotesIcon },
];

const StudentProfile = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [student, setStudent] = useState(location.state?.student || null);
  const [loading, setLoading] = useState(!student);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [feesLoading, setFeesLoading] = useState(true);
  const [feeReport, setFeeReport] = useState(null);
  const [payments, setPayments] = useState([]);
  const [feeError, setFeeError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadStudent = async () => {
      setLoading(true);
      setNotFound(false);

      try {
        const response = await studentService.getStudentById(studentId);
        if (cancelled) return;
        setStudent(response.data.student);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setNotFound(true);
          setStudent(null);
        } else {
          toast.error(err.response?.data?.message || 'Failed to load student profile');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadStudent();

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  useEffect(() => {
    if (!student) return;

    let cancelled = false;

    const loadFees = async () => {
      setFeesLoading(true);
      setFeeError('');

      const reportPromise = feeService.generateReport({
        scope: 'Student',
        feeType: 'All Fees',
        studentId: student._id,
        academicYear: student.academicYear,
        respectAdmission: true,
      });
      const paymentsPromise = feeService.getStudentPayments({
        studentId: student._id,
        academicYear: student.academicYear,
      });

      const results = await Promise.allSettled([reportPromise, paymentsPromise]);

      if (cancelled) return;

      const [reportResult, paymentsResult] = results;

      if (reportResult.status === 'fulfilled') {
        setFeeReport(reportResult.value.data?.report || null);
      } else {
        setFeeReport(null);
        setFeeError(reportResult.reason?.response?.data?.message || reportResult.reason?.message || '');
      }

      setPayments(paymentsResult.status === 'fulfilled' ? paymentsResult.value.data?.payments || [] : []);
      setFeesLoading(false);
    };

    loadFees();

    return () => {
      cancelled = true;
    };
  }, [student]);

  const goBack = () => navigate('/admin/students');

  if (loading && !student) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" className="text-blue-600" />
      </div>
    );
  }

  if (notFound || !student) {
    return (
      <div className="space-y-6">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Student Management
        </button>
        <EmptyState
          icon={UserIcon}
          title="Student Not Found"
          message="The requested student could not be found."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all cursor-pointer self-start"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Student Management
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Profile</h1>
      </div>

      <ProfileHeader student={student} />

      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div>
        {activeTab === 'overview' && <OverviewTab student={student} />}
        {activeTab === 'academic' && <AcademicTab student={student} />}
        {activeTab === 'attendance' && <AttendanceTab />}
        {activeTab === 'fees' && (
          <FeesTab feeReport={feeReport} payments={payments} feeLoading={feesLoading} feeError={feeError} />
        )}
      </div>
    </div>
  );
};

export default StudentProfile;