import { useEffect, useMemo, useState } from 'react';
import { dataApi } from '../api/data';
import { Button, Card, CardHeader, EmptyState, Skeleton } from './ui';

/** Admin tool: search linked demo accounts and remove any login link. */
export function AdminStudentLinks() {
  const [links, setLinks] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    dataApi('/demo-accounts/linked')
      .then((payload) => {
        if (active) setLinks(payload?.students ?? []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load linked accounts.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleLinks = useMemo(() => {
    const term = query.trim();
    const needle = term.toLowerCase();
    return needle
      ? links.filter(
          (link) =>
            String(link.externalId).includes(needle) || (link.name ?? '').toLowerCase().includes(needle),
        )
      : links;
  }, [links, query]);

  async function handleUnlink(externalId) {
    if (!window.confirm(`Unlink student ${externalId} from their account? They will need to link again.`)) return;

    setBusyId(externalId);
    setError('');
    try {
      await dataApi(`/demo-accounts/${externalId}/link`, { method: 'DELETE' });
      setLinks((current) => current.filter((link) => link.externalId !== externalId));
    } catch (err) {
      setError(err.message || 'Could not unlink account.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader title="Linked student accounts" description="Remove a link so a student can connect a different ID." />

      {error ? (
        <p role="alert" className="mb-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by student ID or name"
        aria-label="Search linked students by ID or name"
        className="mb-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <EmptyState title="No linked accounts">Students who connect their ID will appear here.</EmptyState>
      ) : visibleLinks.length === 0 ? (
        <p className="text-sm text-muted">No linked accounts match “{query}”.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="pb-3 pr-4 text-left font-medium">Student ID</th>
                <th scope="col" className="pb-3 pr-4 text-left font-medium">Name</th>
                <th scope="col" className="pb-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleLinks.map((link) => (
                <tr key={link.externalId} className="transition hover:bg-canvas">
                  <td className="py-3 pr-4 font-medium tabular-nums text-ink">{link.externalId}</td>
                  <td className="py-3 pr-4 text-ink">
                    {link.name ?? <span className="text-muted">Name unavailable</span>}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant="secondary"
                      disabled={busyId === link.externalId}
                      onClick={() => handleUnlink(link.externalId)}
                      aria-label={`Unlink student ${link.externalId}`}
                    >
                      {busyId === link.externalId ? 'Unlinking…' : 'Unlink'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}