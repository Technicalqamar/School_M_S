import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../../contexts/AuthContext';
import {
  hasAnyReceptionistModuleAccess,
  hasModuleAccess,
} from '../../../constants/receptionistPermissions';
import StudentFeeDetails from '../../feeManagement/StudentFeeDetails/StudentFeeDetails';
import CollectFee from '../../feeManagement/CollectFee/CollectFee';
import SendFeeReminder from './SendFeeReminder';
import { EmptyState } from '../StudentProfile/shared';

// The Single Student Management "Fees" page.
//
// It does not introduce a second fee system: it reuses the existing fee
// components end to end. `StudentFeeDetails` (the project's per-student fee view)
// is handed the already-selected student so it skips its own search, and the
// project's one and only `CollectFee` component is rendered in embedded mode,
// pre-pointed at the same student. Because the collection flow lives in one
// place, fee types, discounts, arrears and receipt rules stay identical to the
// main Fee module. The workspace only adds the shared student context plus a
// refresh so the dues and payment history update immediately after a payment.
const StudentFeesWorkspace = () => {
  const { student } = useOutletContext();
  const { user } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  // Viewing fee information (structures, dues, receipts) needs a fee-management
  // grant; the backend re-checks every call. Collecting needs the collect-fee
  // grant specifically.
  const canViewFees = hasAnyReceptionistModuleAccess(user, 'fee-management');
  const canCollect = hasModuleAccess(user, 'fee-management', 'collect-fee');
  const canRemind = hasModuleAccess(user, 'fee-management', 'reminders');

  if (!student) return null;

  if (!canViewFees) {
    return (
      <EmptyState
        icon={BanknotesIcon}
        title="Fee information is not available"
        message="Your account does not have access to fee management for this student."
      />
    );
  }

  return (
    <div className="space-y-6">
      <StudentFeeDetails
        key={`${student._id || student.studentId || 'student'}-${reloadKey}`}
        student={student}
      />

      {canCollect && (
        <CollectFee
          preselectedStudent={student}
          onDataChange={() => setReloadKey((key) => key + 1)}
        />
      )}

      {canRemind && (
        <SendFeeReminder
          key={`reminder-${student._id || student.studentId || 'student'}-${reloadKey}`}
          student={student}
        />
      )}
    </div>
  );
};

export default StudentFeesWorkspace;
