import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import authService from '../../../services/auth/auth.service';
import { getWrongRoleIdMessage } from '../../../utils/wrongRoleId';
import AuthLayout from '../../../components/Auth/AuthLayout';
import Input from '../../../components/common/Input/Input';
import Button from '../../../components/common/Button/Button';
import Alert from '../../../components/common/Alert/Alert';
import { toast } from 'react-hot-toast';
import { IdentificationIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const ReceptionistLogin = () => {
  const [formData, setFormData] = useState({ receptionistId: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const { user, role, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      navigate('/', { replace: true });
    }
  }, [user, role, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: '' });
    }
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // UX guard: a student/teacher ID typed into the receptionist form is
    // rejected here, before any request reaches the backend.
    const wrongRoleMessage = getWrongRoleIdMessage(formData.receptionistId, 'receptionist');
    if (wrongRoleMessage) {
      setError(wrongRoleMessage);
      setFieldErrors({});
      toast.error(wrongRoleMessage);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authService.receptionistLogin(
        formData.receptionistId,
        formData.password,
      );
      if (response.success) {
        const { user: userData, accessToken, refreshToken } = response;
        login(userData, userData.role, accessToken, refreshToken);
        toast.success('Login Successful');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please check your credentials.';
      const errMap = {
        'Receptionist ID not found': 'receptionistId',
        'Incorrect password': 'password',
      };
      const targetField = errMap[message];
      if (targetField) {
        setFieldErrors({ [targetField]: message });
        setError('');
      } else {
        setError(message);
        setFieldErrors({});
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      role="receptionist"
      title="Receptionist Sign In"
      subtitle="Enter your credentials to access the receptionist portal"
    >
      <Alert message={error} type="error" />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Receptionist ID"
          name="receptionistId"
          type="text"
          required
          value={formData.receptionistId}
          onChange={handleChange}
          placeholder="REC-000001"
          icon={IdentificationIcon}
          error={fieldErrors.receptionistId}
        />

        <Input
          label="Password"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          icon={LockClosedIcon}
          error={fieldErrors.password}
        />

        <Button type="submit" loading={loading}>
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ReceptionistLogin;
