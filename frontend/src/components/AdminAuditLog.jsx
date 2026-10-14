import { useEffect, useState } from 'react';
import { dataApi } from '../api/data';
import { Card, CardHeader, EmptyState, Skeleton } from './ui';

const ACTION_LABELS = {
  'demo_account.unlink': 'Unlinked student account',
  'user.role_change': 'Changed user role',
};

function describeTarget(entry) {
  if (entry.action === 'user.role_change') {
    return `${entry.targetName}: ${entry.previousRole} → ${entry.newRole}`;
  }
  return `Student ${entry.targetExternalId}`;
}

/** Admin view of recent privileged actions. Read-only. */
export function AdminAuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    dataApi('/admin/audit-log')
      .then((payload) => {
        if (active) setEntries(payload?.entries ?? []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load the audit log.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <CardHeader title="Audit log" description="Recent admin actions, newest first." />

      {error ? (
        <p role="alert" className="mb-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState title="No admin actions yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="pb-3 pr-4 text-left font-medium">When</th>
                <th scope="col" className="pb-3 pr-4 text-left font-medium">Admin</th>
                <th scope="col" className="pb-3 pr-4 text-left font-medium">Action</th>
                <th scope="col" className="pb-3 text-left font-medium">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {entries.map((entry) => (
                <tr key={entry._id} className="transition hover:bg-canvas">
                  <td className="py-3 pr-4 whitespace-nowrap text-muted">
                    <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                  </td>
                  <td className="py-3 pr-4 text-ink">{entry.actorName}</td>
                  <td className="py-3 pr-4 text-ink">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                  <td className="py-3 text-ink">{describeTarget(entry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}