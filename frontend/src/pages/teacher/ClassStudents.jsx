import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Spinner from '../../components/common/Spinner/Spinner';
import CardSection from '../../components/common/CardSection/CardSection';
import SearchInput from '../../components/common/SearchInput/SearchInput';
import classStudentsService from '../../services/teacher/classStudents.service';

const EmptyState = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-12">
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

const ClassStudents = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const className = state?.className || 'Class';
  const subject = state?.subject || '';
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;

    const timer = setTimeout(() => {
      setIsLoading(true);
      setError('');

      classStudentsService
        .getClassStudents(classId, { search: search.trim() })
        .then((result) => {
          if (!mounted) return;
          setStudents(result.students);
        })
        .catch(() => {
          if (mounted) {
            const msg = 'Failed to load students';
            setError(msg);
          }
        })
        .finally(() => {
          if (mounted) setIsLoading(false);
        });
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [classId, search]);

  const handleBack = () => {
    navigate('/teacher/dashboard/my-classes');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {className}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {subject ? `${subject} · Students enrolled in this class.` : 'Students enrolled in this class.'}
          </p>
        </div>
      </div>

      {!error && students.length > 0 && (
        <div className="max-w-md">
          <SearchInput
            placeholder="Search by ID or name..."
            value={search}
            onChange={setSearch}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
          <Spinner size="lg" className="text-blue-600" />
          <p className="text-sm">Loading students...</p>
        </div>
      ) : error ? (
        <CardSection>
          <div className="flex items-center justify-center py-10">
            <EmptyState
              title="Something went wrong"
              description={error + '. Please try again.'}
            />
          </div>
        </CardSection>
      ) : students.length === 0 ? (
        <CardSection>
          <EmptyState
            title={search.trim() ? 'No matching students' : 'No students in this class'}
            description={
              search.trim()
                ? 'No students match your search. Try a different ID or name.'
                : 'Students assigned to this class will appear here.'
            }
          />
        </CardSection>
      ) : (
        <CardSection>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {students.map((student) => (
              <div
                key={student.studentId || student._id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    {student.studentImage ? (
                      <img
                        src={student.studentImage}
                        alt={student.fullName || 'Student'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {(student.fullName || 'S').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {student.fullName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {student.studentId}
                      {student.fatherName ? ` · ${student.fatherName}` : ''}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {student.status || 'Active'}
                </span>
              </div>
            ))}
          </div>
        </CardSection>
      )}
    </div>
  );
};

export default ClassStudents;