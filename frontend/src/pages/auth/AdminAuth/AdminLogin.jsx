import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import authService from '../../../services/auth/auth.service';
import AuthLayout from '../../../components/Auth/AuthLayout';
import Input from '../../../components/common/Input/Input';
import Button from '../../../components/common/Button/Button';
import Alert from '../../../components/common/Alert/Alert';
import { toast } from 'react-hot-toast';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const AdminLogin = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
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
      const response = await authService.adminLogin(formData.email, formData.password);
      if (response.success) {
        const { user: userData, accessToken, refreshToken } = response;
        login(userData, userData.role, accessToken, refreshToken);
        toast.success('Login Successful');
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please check your credentials.';
      const errMap = {
        'Email not found': 'email',
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
      title="Admin Sign In"
      subtitle="Enter your credentials to access the admin dashboard"
    >
      <Alert message={error} type="error" />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Email Address"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          placeholder="admin@school.com"
          icon={EnvelopeIcon}
          error={fieldErrors.email}
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

        <div className="flex items-center justify-end">
          <Link
            to="/admin/forgot-password"
            className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" loading={loading}>
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
};

export default AdminLogin;
