import { useState } from 'react';
import { OAuthSection } from './OAuthSection';
import { TextField } from './TextField';
import { useAuth } from '../context/AuthContext';
import { toFormError } from '../lib/errors';

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await login(email, password);
    } catch (error) {
      setFormError(toFormError(error));
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formError ? (
          <div role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-300">
            {formError.message}
          </div>
        ) : null}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={formError?.fields.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
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
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <OAuthSection disabled={submitting} onError={setFormError} />
    </>
  );
}