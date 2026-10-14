import { Link } from 'react-router-dom';
import { ROLE_LABEL } from '../lib/roles';
import { Button } from './ui';
import { ThemeToggle } from './ThemeToggle';
import { SceneBackdrop } from './SceneBackdrop';

export function AppShell({ user, onSignOut, children }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-canvas text-ink">
      <SceneBackdrop />

      <header className="sticky top-0 z-20 border-b border-line bg-surface/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-5">
            <Link to="/" className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-display text-base font-semibold text-on-accent"
              >
                S
              </span>
              <span className="font-display text-lg font-semibold text-ink">Student Performance</span>
            </Link>
            <Link to="/" className="hidden text-sm text-muted transition hover:text-ink sm:inline">
              Home
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-ink">{user.name}</p>
              <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
            </div>
            <ThemeToggle />
            <Button variant="secondary" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>

      <footer className="border-t border-line bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Student Performance · Capstone project</p>
          <p>Sample data from the Open University Learning Analytics Dataset (CC BY 4.0). Estimates are not grades.</p>
        </div>
      </footer>
    </div>
  );
}