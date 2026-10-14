import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_HOME } from '../lib/roles';
import { FullPageSpinner } from './FullPageSpinner';

function SessionUnavailable({ onRetry }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
      <h1 className="font-display text-3xl text-ink">We could not load your account</h1>
      <p className="max-w-md text-sm text-muted">The server is not responding. Check your connection and try again.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-on-accent transition hover:bg-accent-strong"
      >
        Try again
      </button>
    </main>
  );
}

export function ProtectedRoute({ roles }) {
  const { user, status, retrySession } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'error') return <SessionUnavailable onRetry={retrySession} />;
  if (!user) return <Navigate to="/" replace />;
  // Social sign-ups without a chosen role must pick one before using any dashboard.
  if (user.roleSelectionPending && location.pathname !== '/choose-role') {
    return <Navigate to="/choose-role" replace />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}