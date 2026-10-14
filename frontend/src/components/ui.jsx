const BUTTON_VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong',
  secondary: 'border border-line bg-surface text-ink hover:bg-accent-soft',
  ghost: 'text-muted hover:bg-accent-soft hover:text-ink',
};

export function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = '', as: Tag = 'section', ...props }) {
  return <Tag className={`rounded-xl border border-line bg-surface/85 p-5 shadow-sm backdrop-blur-sm ${className}`} {...props} />;
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-sans text-xl font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const BADGE_TONES = {
  accent: 'bg-accent-soft text-accent ring-accent/30',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/30',
  amber: 'bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/30',
  red: 'bg-rose-50 text-rose-800 ring-rose-600/20 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/30',
  slate: 'bg-canvas text-muted ring-line',
};

export function Badge({ tone = 'slate', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-line ${className}`} aria-hidden="true" />;
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children ? <p className="mt-1 text-sm text-muted">{children}</p> : null}
    </div>
  );
}

const BAR_TONES = {
  accent: 'bg-accent',
  emerald: 'bg-emerald-500 dark:bg-emerald-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  red: 'bg-rose-500 dark:bg-rose-400',
  slate: 'bg-muted/50',
};

export function ProgressBar({ value, tone = 'accent', label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-line"
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${BAR_TONES[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

/** Stacked outcome bar that doubles as a filter. Segments and legend are buttons, so keyboard users can filter too. */
export function SegmentedBar({ segments, activeKey, onSelect }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return null;

  return (
    <div>
      <div role="group" aria-label="Outcome distribution" className="flex h-3 w-full overflow-hidden rounded-full bg-line">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => {
            const isActive = activeKey === segment.key;
            const dimmed = activeKey && !isActive;
            return (
              <button
                key={segment.key}
                type="button"
                onClick={() => onSelect(isActive ? null : segment.key)}
                aria-pressed={isActive}
                aria-label={`${segment.label}: ${segment.value}`}
                title={`${segment.label}: ${segment.value}`}
                style={{ width: `${(segment.value / total) * 100}%` }}
                className={`h-full animate-grow transition-opacity ${segment.className} ${dimmed ? 'opacity-30' : ''}`}
              />
            );
          })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {segments.map((segment) => {
          const isActive = activeKey === segment.key;
          return (
            <li key={segment.key}>
              <button
                type="button"
                onClick={() => onSelect(isActive ? null : segment.key)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${isActive ? 'border-accent bg-accent-soft text-ink' : 'border-line text-muted hover:text-ink'}`}
              >
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${segment.className}`} />
                {segment.label}
                <span className="tabular-nums font-medium text-ink">{segment.value}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}