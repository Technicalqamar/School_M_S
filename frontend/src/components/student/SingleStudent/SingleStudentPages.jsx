import { useOutletContext } from 'react-router-dom';
import OverviewTab from '../StudentProfile/tabs/OverviewTab';
import AcademicTab from '../StudentProfile/tabs/AcademicTab';
import DocumentsTab from '../StudentProfile/tabs/DocumentsTab';
import OtherInformationTab from '../StudentProfile/tabs/OtherInformationTab';
import SendStudentNotice from './SendStudentNotice';
import StudentFeesWorkspace from './StudentFeesWorkspace';
import StudentExamRecords from './StudentExamRecords';
import StudentAdmitCard from './StudentAdmitCard';

// Thin routed wrappers that reuse the existing, already-built student tab
// components. The Single Student Management workspace renders one of these per
// child route and hands them the selected student through the Outlet context,
// so the student context never has to be refetched or re-derived per page.

export const StudentOverviewPage = () => {
  const { student } = useOutletContext();
  return (
    <div className="space-y-6">
      <OverviewTab student={student} />
      <SendStudentNotice key={student?.studentId} student={student} />
    </div>
  );
};

export const StudentAcademicPage = () => {
  const { student, refresh } = useOutletContext();
  return <AcademicTab student={student} onUpdated={refresh} />;
};

export const StudentFeesPage = () => <StudentFeesWorkspace />;

export const StudentExamRecordsPage = () => <StudentExamRecords />;

export const StudentAdmitCardPage = () => <StudentAdmitCard />;

export const StudentDocumentsPage = () => {
  const { student } = useOutletContext();
  return <DocumentsTab documents={student?.documents} />;
};

export const StudentOtherPage = () => {
  const { student } = useOutletContext();
  return <OtherInformationTab student={student} />;
};
