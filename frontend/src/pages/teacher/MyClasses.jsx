import { useState, useEffect, useMemo } from 'react';
import {
  BookOpenIcon,
  UserGroupIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import CardSection from '../../components/common/CardSection/CardSection';
import SearchInput from '../../components/common/SearchInput/SearchInput';
import Button from '../../components/common/Button/Button';
import Spinner from '../../components/common/Spinner/Spinner';
import myClassesService from '../../services/teacher/myClasses.service';

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-12">
    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
      <Icon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
    </div>
    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm">{description}</p>
  </div>
);

const MyClasses = () => {
  const navigate = useNavigate();
  const [myClasses, setMyClasses] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    myClassesService
      .getMyClasses()
      .then((result) => {
        if (!mounted) return;
        setMyClasses(result.myClasses);
      })
      .catch(() => {
        if (mounted) {
          const msg = 'Failed to load your classes';
          setError(msg);
          toast.error(msg);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredClasses = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return myClasses;

    return myClasses.filter(
      (item) =>
        (item.className || '').toLowerCase().includes(term) ||
        (item.subject || '').toLowerCase().includes(term),
    );
  }, [myClasses, search]);

  const handleViewStudents = (item) => {
    navigate(`/teacher/dashboard/my-classes/${item.classId}`, {
      state: { className: item.className, subject: item.subject },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Classes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Classes assigned to you with their subjects and student counts.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
          <Spinner size="lg" className="text-blue-600" />
          <p className="text-sm">Loading your classes...</p>
        </div>
      ) : (
        <>
          {error && (
            <CardSection>
              <div className="flex items-center justify-center py-10">
                <EmptyState
                  icon={BookOpenIcon}
                  title="Something went wrong"
                  description={error + '. Please try again.'}
                />
              </div>
            </CardSection>
          )}

          {!error && myClasses.length === 0 && (
            <CardSection>
              <EmptyState
                icon={BookOpenIcon}
                title="No classes assigned yet"
                description="Classes assigned to you by the admin will appear here with their subjects and student counts."
              />
            </CardSection>
          )}

          {!error && myClasses.length > 0 && (
            <>
              <div className="max-w-md">
                <SearchInput
                  placeholder="Search by class name or subject..."
                  value={search}
                  onChange={setSearch}
                />
              </div>

              {filteredClasses.length === 0 ? (
                <CardSection>
                  <EmptyState
                    icon={UserGroupIcon}
                    title="No matching classes"
                    description="No classes match your search. Try a different class name or subject."
                  />
                </CardSection>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredClasses.map((item) => (
                    <div
                      key={`${item.classId}-${item.subject}`}
                      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {item.className}
                        </h3>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                          {item.subject}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mb-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-center">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {item.totalStudents ?? '0'}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">Students</p>
                        </div>
                      </div>

                      <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleViewStudents(item)}
                        >
                          <EyeIcon className="mr-2 h-4 w-4" /> View Students
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MyClasses;