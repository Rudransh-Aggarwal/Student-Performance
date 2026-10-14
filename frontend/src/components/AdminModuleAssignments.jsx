import { useEffect, useMemo, useState } from 'react';
import { dataApi } from '../api/data';
import { Card, CardHeader, EmptyState, Skeleton } from './ui';

export function AdminModuleAssignments() {
  const [instructors, setInstructors] = useState([]);
  const [moduleCodes, setModuleCodes] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [assigned, setAssigned] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadDirectory() {
      try {
        const [instructorPayload, modulePayload] = await Promise.all([
          dataApi('/admin/instructors'),
          dataApi('/modules'),
        ]);
        if (!active) return;
        setInstructors(instructorPayload?.instructors ?? []);
        setModuleCodes([...new Set((modulePayload?.modules ?? []).map((module) => module.code))].sort());
      } catch (err) {
        if (active) setError(err.message || 'Could not load instructors.');
      } finally {
        if (active) setLoadingList(false);
      }
    }

    void loadDirectory();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setAssigned([]);
      return undefined;
    }

    let active = true;
    setLoadingAssigned(true);
    setError('');
    setMessage('');

    dataApi(`/admin/instructors/${encodeURIComponent(selected.firebaseUid)}/modules`)
      .then((payload) => {
        if (active) setAssigned(payload?.moduleCodes ?? []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load assigned modules.');
      })
      .finally(() => {
        if (active) setLoadingAssigned(false);
      });

    return () => {
      active = false;
    };
  }, [selected]);

  const visibleInstructors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return instructors;
    return instructors.filter((instructor) =>
      `${instructor.name} ${instructor.email}`.toLowerCase().includes(query),
    );
  }, [instructors, search]);

  const availableCodes = useMemo(
    () => moduleCodes.filter((code) => !assigned.includes(code)),
    [moduleCodes, assigned],
  );

  async function assignModule(code) {
    if (!selected) return;
    setPendingCode(code);
    setError('');
    setMessage('');
    try {
      await dataApi('/admin/module-assignments', {
        method: 'POST',
        body: JSON.stringify({ instructorId: selected.firebaseUid, moduleCode: code }),
      });
      setAssigned((current) => [...current, code].sort());
      setMessage(`${code} assigned to ${selected.name}.`);
    } catch (err) {
      setError(err.message || 'Could not assign module.');
    } finally {
      setPendingCode('');
    }
  }

  async function removeModule(code) {
    if (!selected) return;
    setPendingCode(code);
    setError('');
    setMessage('');
    try {
      await dataApi(
        `/admin/module-assignments/${encodeURIComponent(selected.firebaseUid)}/${encodeURIComponent(code)}`,
        { method: 'DELETE' },
      );
      setAssigned((current) => current.filter((item) => item !== code));
      setMessage(`${code} removed from ${selected.name}.`);
    } catch (err) {
      setError(err.message || 'Could not remove module.');
    } finally {
      setPendingCode('');
    }
  }

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader title="Instructors" description="Pick someone to change which modules they teach." />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          aria-label="Search instructors"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
          {loadingList ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : visibleInstructors.length === 0 ? (
            <EmptyState title={instructors.length === 0 ? 'No instructors yet' : 'No matches'}>
              {instructors.length === 0
                ? 'Instructors appear here after they sign in once.'
                : 'Try a different name or email.'}
            </EmptyState>
          ) : (
            visibleInstructors.map((instructor) => {
              const isSelected = selected?.firebaseUid === instructor.firebaseUid;
              return (
                <button
                  key={instructor.firebaseUid}
                  type="button"
                  onClick={() => setSelected(instructor)}
                  aria-pressed={isSelected}
                  className={`w-full rounded-lg border p-3 text-left transition ${isSelected ? 'border-accent bg-accent-soft' : 'border-line hover:bg-accent-soft/60'}`}
                >
                  <p className="font-medium text-ink">{instructor.name}</p>
                  <p className="text-sm text-muted">{instructor.email}</p>
                </button>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        {selected ? (
          <>
            <CardHeader
              title={`Modules for ${selected.name}`}
              description="Assigning a module gives access to all of its presentations."
            />

            {message ? (
              <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">
                {message}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-300">
                {error}
              </p>
            ) : null}

            <h3 className="text-sm font-medium text-muted">Assigned</h3>
            {loadingAssigned ? (
              <Skeleton className="mt-3 h-8 w-40" />
            ) : assigned.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No modules assigned yet.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {assigned.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-2 rounded-full bg-accent-soft py-1 pl-3 pr-1.5 text-sm font-medium text-accent ring-1 ring-inset ring-accent/30"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => removeModule(code)}
                      disabled={pendingCode === code}
                      aria-label={`Remove ${code} from ${selected.name}`}
                      className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-accent/15 disabled:opacity-50"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </span>
                ))}
              </div>
            )}

            <h3 className="mt-6 text-sm font-medium text-muted">Available to add</h3>
            {loadingAssigned ? null : availableCodes.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Every module is already assigned.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {availableCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => assignModule(code)}
                    disabled={pendingCode === code}
                    className="rounded-full border border-line px-3 py-1 text-sm font-medium text-ink transition hover:border-accent hover:text-accent disabled:opacity-50"
                  >
                    Add {code}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <EmptyState title="No instructor selected">Choose an instructor on the left to manage their modules.</EmptyState>
        )}
      </Card>
    </div>
  );
}