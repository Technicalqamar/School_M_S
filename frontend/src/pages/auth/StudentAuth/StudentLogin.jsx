import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import authService from '../../../services/auth/auth.service';
import AuthLayout from '../../../components/Auth/AuthLayout';
import Input from '../../../components/common/Input/Input';
import Button from '../../../components/common/Button/Button';
import Alert from '../../../components/common/Alert/Alert';
import { toast } from 'react-hot-toast';
import { IdentificationIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const StudentLogin = () => {
  const [formData, setFormData] = useState({ studentId: '', password: '' });
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
    setLoading(true);
    setError('');

    try {
      const response = await authService.studentLogin(formData.studentId, formData.password);
      if (response.success) {
        const { user: userData, accessToken, refreshToken } = response;
        login(userData, userData.role, accessToken, refreshToken);
        toast.success('Login Successful');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please check your credentials.';
      const errMap = {
        'Student ID not found': 'studentId',
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
      role="student"
      title="Student Sign In"
      subtitle="Enter your credentials to access the student portal"
    >
      <Alert message={error} type="error" />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Student ID"
          name="studentId"
          type="text"
          required
          value={formData.studentId}
          onChange={handleChange}
          placeholder="STD-000001"
          icon={IdentificationIcon}
          error={fieldErrors.studentId}
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

export default StudentLogin;
