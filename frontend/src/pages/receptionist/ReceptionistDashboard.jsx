import { useEffect, useState } from 'react';
import {
  UsersIcon,
  UserGroupIcon,
  AcademicCapIcon,
  RectangleStackIcon,
  UserPlusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import receptionistService from '../../services/receptionist/receptionist.service';
import { useAuth } from '../../contexts/AuthContext';

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${accent}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </div>
);

const ReceptionistDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await receptionistService.getDashboard();
      setData(response.data);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'You do not have permission to view the dashboard.'
          : err.response?.data?.message || 'Unable to load dashboard data. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const stats = data?.statistics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
            Welcome{user?.fullName ? `, ${user.fullName}` : ''}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Reception overview{stats?.month ? ` — ${stats.month}` : ''}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={UsersIcon} label="Total Students" value={stats?.totalStudents ?? 0} accent="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" />
          <StatCard icon={AcademicCapIcon} label="Active Students" value={stats?.activeStudents ?? 0} accent="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" />
          <StatCard icon={UserGroupIcon} label="Teachers" value={stats?.totalTeachers ?? 0} accent="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400" />
          <StatCard icon={RectangleStackIcon} label="Classes" value={stats?.totalClasses ?? 0} accent="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" />
          <StatCard icon={UserPlusIcon} label={`New Admissions (${stats?.month ?? 'this month'})`} value={stats?.newAdmissions ?? 0} accent="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400" />
        </div>
      )}

      {!loading && !error && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-800 dark:text-white">Recently Added Students</h2>
          </div>
          {data?.recentStudents?.length ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.recentStudents.map((student) => (
                <div key={student.studentId} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{student.fullName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{student.studentId}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-300">{student.class || '—'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{student.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">No students found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ReceptionistDashboard;
