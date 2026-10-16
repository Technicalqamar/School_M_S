import { useState } from 'react';
import { AcademicCapIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import CardSection from '../../../common/CardSection/CardSection';
import EditStudentModal from '../../../common/EditStudentModal/EditStudentModal';
import { InfoRow, EmptyState } from '../shared';
import { formatDate } from '../helpers';
import { useAuth } from '../../../../contexts/AuthContext';
import { hasReceptionistActionAccess } from '../../../../constants/receptionistPermissions';
import studentService from '../../../../services/student/student.service';

const ENROLLMENT_SOURCE = {
  Admission: 'Admission',
  Promotion: 'Promotion',
  Correction: 'Correction',
  Reversal: 'Reversal',
};

// Renders the read-only academic detail for the selected student and exposes the
// single, existing "Edit Student Information" workflow. Editing reuses the
// shared EditStudentModal + studentService.updateStudent (the same path the All
// Students list uses), and refreshes the workspace afterwards so every surface -
// header, Overview, Academic - shows the saved values. Immutable/system fields
// (Student ID, admission number) are never part of the edit form, and class /
// academic year changes stay inside the backend's normal update validation.
const AcademicTab = ({ student, onUpdated }) => {
  const { user } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const enrollments = Array.isArray(student.enrollments) ? student.enrollments : [];
  const canEdit = hasReceptionistActionAccess(user, 'student-management', 'student-edit');

  // The modal closes itself after a successful save; here we just persist through
  // the existing authorized endpoint and refresh the selected-student context.
  const handleSave = async (studentId, formData) => {
    await studentService.updateStudent(studentId, formData);
    if (typeof onUpdated === 'function') {
      await onUpdated();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Academic</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Academic details for {student.fullName} ({student.studentId})
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="self-start inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all cursor-pointer"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit Student Information
          </button>
        )}
      </div>

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

      {/* Mounted only while open and keyed by the student, so the form always
          seeds from the currently selected student (never a previously viewed
          one) and reloads the saved values the next time it is opened. */}
      {canEdit && isEditOpen && (
        <EditStudentModal
          key={student.studentId}
          student={student}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default AcademicTab;
