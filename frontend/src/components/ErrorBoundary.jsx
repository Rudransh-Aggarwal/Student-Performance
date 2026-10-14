import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas p-6 text-center">
        <h1 className="font-display text-3xl text-ink">Something went wrong</h1>
        <p className="max-w-md text-sm text-muted">An unexpected error occurred. Reloading the page usually fixes it.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-on-accent transition hover:bg-accent-strong"
        >
          Reload
        </button>
      </main>
    );
  }
}