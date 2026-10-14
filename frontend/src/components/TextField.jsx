import { useId } from 'react';

export function TextField({ label, error, ...inputProps }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        {...inputProps}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border bg-surface px-3 py-2 text-ink placeholder:text-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 ${error ? 'border-rose-500' : 'border-line'}`}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}