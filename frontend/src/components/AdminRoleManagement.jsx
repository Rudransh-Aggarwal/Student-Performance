import { useEffect, useMemo, useState } from 'react';
import { auth } from '../lib/firebase';
import { listUsers, updateUserRole } from '../api/auth';
import { Card, CardHeader, EmptyState, Skeleton } from './ui';

const ASSIGNABLE_ROLES = ['student', 'instructor'];

/** Admin tool: change a student's or instructor's role. Admin accounts are shown read-only. */
export function AdminRoleManagement() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listUsers()
      .then((list) => {
        if (active) setUsers(list);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load users.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentUid = auth.currentUser?.uid;

  const visibleUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (user) => user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term),
    );
  }, [users, query]);

  async function handleRoleChange(user, nextRole) {
    if (nextRole === user.role) return;
    if (!window.confirm(`Change ${user.name} (${user.email}) from ${user.role} to ${nextRole}?`)) return;

    setBusyUid(user.firebaseUid);
    setError('');
    setMessage('');
    try {
      const updated = await updateUserRole(user.firebaseUid, nextRole);
      setUsers((current) =>
        current.map((row) =>
          row.firebaseUid === user.firebaseUid ? { ...row, role: updated.role } : row,
        ),
      );
      setMessage(`${user.name} is now ${updated.role}.`);
    } catch (err) {
      setError(err.message || 'Could not change role.');
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <Card>
      <CardHeader title="User roles" description="Change whether an account is a student or an instructor." />

      {error ? (
        <p role="alert" className="mb-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mb-4 text-sm text-emerald-800 dark:text-emerald-300">
          {message}
        </p>
      ) : null}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by name or email"
        aria-label="Search users"
        className="mb-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState title="No accounts found" />
      ) : visibleUsers.length === 0 ? (
        <p className="text-sm text-muted">No accounts match “{query}”.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="pb-3 pr-4 text-left font-medium">Name</th>
                <th scope="col" className="pb-3 pr-4 text-left font-medium">Email</th>
                <th scope="col" className="pb-3 text-right font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visibleUsers.map((user) => {
                const isSelf = user.firebaseUid === currentUid;
                const locked = user.role === 'admin' || isSelf;
                return (
                  <tr key={user.firebaseUid} className="transition hover:bg-canvas">
                    <td className="py-3 pr-4 font-medium text-ink">{user.name}</td>
                    <td className="py-3 pr-4 text-muted">{user.email}</td>
                    <td className="py-3 text-right">
                      {locked ? (
                        <span className="text-sm text-muted" title={isSelf ? 'You cannot change your own role' : 'Admin roles are fixed'}>
                          {user.role}
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          disabled={busyUid === user.firebaseUid}
                          onChange={(event) => handleRoleChange(user, event.target.value)}
                          aria-label={`Role for ${user.name}`}
                          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
                        >
                          {ASSIGNABLE_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
