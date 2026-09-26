import CardSection from '../../../common/CardSection/CardSection';
import { InfoRow } from '../shared';
import { formatDate } from '../helpers';

const OverviewTab = ({ student }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <CardSection title="Personal Information">
      <InfoRow label="Student ID" value={student.studentId} />
      <InfoRow label="Full Name" value={student.fullName} />
      <InfoRow label="Father's Name" value={student.fatherName} />
      <InfoRow label="Gender" value={student.gender} />
      <InfoRow label="Date of Birth" value={formatDate(student.dateOfBirth)} />
    </CardSection>

    <CardSection title="Contact Information">
      <InfoRow label="Parent Phone" value={student.fatherPhone} />
      <InfoRow label="Alternate Phone" value={student.alternatePhone} />
      <InfoRow label="City" value={student.city} />
      <InfoRow label="Address" value={student.address} />
      <InfoRow label="Current Status" value={student.status} />
    </CardSection>
  </div>
);

export default OverviewTab;