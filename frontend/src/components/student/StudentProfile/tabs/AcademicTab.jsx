import { AcademicCapIcon } from '@heroicons/react/24/outline';
import CardSection from '../../../common/CardSection/CardSection';
import { InfoRow, EmptyState } from '../shared';
import { formatDate } from '../helpers';

const ENROLLMENT_SOURCE = {
  Admission: 'Admission',
  Promotion: 'Promotion',
  Correction: 'Correction',
  Reversal: 'Reversal',
};

const AcademicTab = ({ student }) => {
  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <CardSection title="Academic Information">
        <InfoRow label="Class" value={student.class} />
        <InfoRow label="Academic Year" value={student.academicYear} />
        <InfoRow label="Admission Number" value={student.admissionNumber} />
        <InfoRow label="Admission Date" value={formatDate(student.admissionDate)} />
        <InfoRow label="Current Status" value={student.status} />
      </CardSection>

      <CardSection title="Enrollment History">
        {enrollments.length === 0 ? (
          <div className="py-4">
            <EmptyState
              icon={AcademicCapIcon}
              title="No enrollment records available"
              message="Academic history for this student is not available yet."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {[...enrollments]
              .sort((a, b) => String(b.academicYear).localeCompare(String(a.academicYear)))
              .map((enrollment, index) => (
                <div
                  key={`${enrollment.academicYear}-${enrollment.class}-${index}`}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{enrollment.academicYear}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {enrollment.class} &middot; {enrollment.source ? ENROLLMENT_SOURCE[enrollment.source] || enrollment.source : '-'}
                      </p>
                    </div>
                    {enrollment.status && (
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {enrollment.status}
                      </span>
                    )}
                  </div>
                  {enrollment.enrolledAt && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      Enrolled on {formatDate(enrollment.enrolledAt)}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardSection>
    </div>
  );
};

export default AcademicTab;