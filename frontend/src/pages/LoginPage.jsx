import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see your performance insights."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}