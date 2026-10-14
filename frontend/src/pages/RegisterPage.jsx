import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { OAuthSection } from '../components/OAuthSection';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { toFormError } from '../lib/errors';

const ROLE_OPTIONS = [
  { value: 'student', label: 'Student', hint: 'See your own predictions' },
  { value: 'instructor', label: 'Instructor', hint: 'Monitor your cohorts' },
];

export function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await register({ name, email, password, role });
      // On success PublicOnlyRoute redirects to the role's home page.
    } catch (error) {
      setFormError(toFormError(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Pick your role to get the right dashboard."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
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

        <TextField label="Full name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} error={formError?.fields.name} />
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} error={formError?.fields.email} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={formError?.fields.password}
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-on-accent transition hover:bg-accent-strong disabled:opacity-60"
        >
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <OAuthSection disabled={submitting} onError={setFormError} role={role} />
      <p className="mt-3 text-center text-xs text-muted">
        Google or GitHub accounts created here use the role selected above. Existing accounts keep their current role.
      </p>
    </AuthLayout>
  );
}