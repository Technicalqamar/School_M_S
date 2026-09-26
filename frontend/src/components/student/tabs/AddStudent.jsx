import { useTranslation } from '../../../hooks/useLocalization';
import AddStudentForm from '../../../pages/admin/AddStudentForm';

const AddStudent = ({ onSuccess }) => {
  return <AddStudentForm onSuccess={onSuccess} />;
};

export default AddStudent;
