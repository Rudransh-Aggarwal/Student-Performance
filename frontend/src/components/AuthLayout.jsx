import { SceneBackdrop } from './SceneBackdrop';
import { ThemeToggle } from './ThemeToggle';

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center bg-canvas p-4">
      <SceneBackdrop />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-accent font-display text-lg font-semibold text-on-accent"
          >
            S
          </span>
          <span className="font-display text-xl font-semibold text-ink">Student Performance</span>
        </div>
        <div className="rounded-xl border border-line bg-surface/85 p-8 shadow-sm backdrop-blur-md">
          <h1 className="font-display text-3xl text-ink">{title}</h1>
          <p className="mt-2 mb-6 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-muted">{footer}</p>
      </div>
    </main>
  );
}