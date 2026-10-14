import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { toFormError } from '../lib/errors';
import { ROLE_HOME } from '../lib/roles';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student', hint: 'See your own predictions' },
  { value: 'instructor', label: 'Instructor', hint: 'Monitor your cohorts' },
];

/** Shown once to social sign-ups that did not choose a role. The choice is final. */
export function ChooseRolePage() {
  const { user, chooseRole, logout } = useAuth();
  const [role, setRole] = useState('student');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  if (!user) return <Navigate to="/login" replace />;
  if (!user.roleSelectionPending) return <Navigate to={ROLE_HOME[user.role]} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await chooseRole(role);
      // On success the pending flag clears and the redirect above sends the user to their dashboard.
    } catch (error) {
      setFormError(toFormError(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="One more step"
      subtitle="Choose how you will use the app. You can only set this once."
      footer={
        <button type="button" onClick={() => logout()} className="font-medium text-accent hover:underline">
          Sign out
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? (
          <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-300">
            {formError.message}
          </div>
        ) : null}

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-ink">I am a</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-lg border p-3 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${
                  role === option.value ? 'border-accent bg-accent-soft' : 'border-line hover:bg-accent-soft/60'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={option.value}
                  checked={role === option.value}
                  onChange={() => setRole(option.value)}
                  className="sr-only"
                />
                <span className="block font-medium text-ink">{option.label}</span>
                <span className="block text-muted">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-on-accent transition hover:bg-accent-strong disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </AuthLayout>
  );
}