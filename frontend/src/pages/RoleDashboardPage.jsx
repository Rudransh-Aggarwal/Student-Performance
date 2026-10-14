import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataApi } from '../api/data';
import { predictStudentRisk } from '../api/ml';
import { AppShell } from '../components/AppShell';
import { AdminModuleAssignments } from '../components/AdminModuleAssignments';
import { AdminStudentLinks } from '../components/AdminStudentLinks';
import { AdminRoleManagement } from '../components/AdminRoleManagement';
import { AdminAuditLog } from '../components/AdminAuditLog';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ProgressBar,
  SegmentedBar,
  Skeleton,
  StatCard,
} from '../components/ui';

const BLURB = {
  student: 'See how your course is going at a glance.',
  instructor: 'Review enrolled students and outcomes for the modules you teach.',
  admin: 'Assign modules to instructors and keep the teaching plan up to date.',
};

const OUTCOME_TONE = { Distinction: 'emerald', Pass: 'emerald', Fail: 'red', Withdrawn: 'amber' };
const OUTCOME_RANK = { Distinction: 0, Pass: 1, Fail: 2, Withdrawn: 3 };
const OUTCOME_SEGMENTS = [
  { key: 'Distinction', label: 'Distinction', className: 'bg-accent' },
  { key: 'Pass', label: 'Pass', className: 'bg-accent/45' },
  { key: 'Fail', label: 'Fail', className: 'bg-rose-500 dark:bg-rose-400' },
  { key: 'Withdrawn', label: 'Withdrawn', className: 'bg-amber-400 dark:bg-amber-500' },
];

const STATUS_VIEW = {
  lower_risk: { headline: 'On track', tone: 'emerald', bar: 'emerald' },
  at_risk: { headline: 'Worth a check-in', tone: 'red', bar: 'red' },
  needs_data: { headline: 'Not enough data yet', tone: 'amber', bar: 'amber' },
  unavailable: { headline: 'Unavailable right now', tone: 'slate', bar: 'slate' },
};
const WAITING_VIEW = { headline: 'Waiting for your account', tone: 'slate', bar: 'slate' };

const SIGNAL_GUIDANCE = {
  assessment_score: {
    label: 'Assessment results',
    strong: 'Your assessment results are strong. Keep your current revision routine.',
    steady: 'Your assessment results are steady. Reviewing feedback on each assessment could lift them further.',
    weak: 'Assessment results are below the typical range. Review feedback on recent assessments and ask your instructor where to focus.',
  },
  engagement: {
    label: 'Course activity',
    strong: 'You engage with the course regularly. Keep it up.',
    steady: 'Course activity is moderate. Logging in and working through the material more often would help.',
    weak: 'Course activity is low. Aim for regular weekly sessions with the course material.',
  },
  completion_rate: {
    label: 'Assessments submitted',
    strong: 'You submit your assessments reliably.',
    steady: 'Most assessments are submitted. Submitting every one, even partial work, protects your results.',
    weak: 'Several assessments are not submitted. Submit what you can, and talk to your instructor about any that are outstanding.',
  },
};

function levelKey(value) {
  if (value >= 0.7) return 'strong';
  if (value >= 0.4) return 'steady';
  return 'weak';
}

function buildSummaryPoints(features) {
  const strengths = [];
  const improvements = [];
  const missing = [];
  if (!features) return { strengths, improvements, missing };

  for (const [key, guide] of Object.entries(SIGNAL_GUIDANCE)) {
    const value = features[key];
    if (value == null) {
      missing.push(guide.label);
      continue;
    }
    const level = levelKey(value);
    if (level === 'strong') {
      strengths.push({ key, label: guide.label, text: guide.strong });
    } else {
      improvements.push({ key, label: guide.label, text: guide[level], urgent: level === 'weak' });
    }
  }
  return { strengths, improvements, missing };
}

function overallLine(prediction) {
  if (prediction?.prediction === 'lower_risk') return 'Overall, you are on track.';
  if (prediction?.prediction === 'at_risk') return 'Overall, it may help to check in with your instructor.';
  return null;
}

const MISSING_PHRASES = {
  assessment_score: 'assessment results',
  engagement: 'course activity',
  completion_rate: 'assessment submissions',
};

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

function StudentSnapshot({ prediction, features, loading }) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const view = prediction ? (STATUS_VIEW[prediction.prediction] ?? STATUS_VIEW.unavailable) : WAITING_VIEW;
  const percent = prediction?.risk_score != null ? Math.round(prediction.risk_score * 100) : null;
  const showMessage = prediction?.prediction === 'needs_data' || prediction?.prediction === 'unavailable';
  const overall = overallLine(prediction);
  const { strengths, improvements, missing } = buildSummaryPoints(features);

  return (
    <div className="space-y-6">
      <div>
        <Badge tone={view.tone}>{view.headline}</Badge>
        {overall ? <p className="mt-3 text-base text-ink">{overall}</p> : null}
        {showMessage && prediction?.message ? <p className="mt-3 text-sm text-muted">{prediction.message}</p> : null}
        {percent !== null ? (
          <div className="mt-4">
            <ProgressBar value={percent} tone={view.bar} label="Overall outlook" />
          </div>
        ) : null}
      </div>

      {features ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-medium text-ink">Strengths</h3>
            {strengths.length ? (
              <ul className="space-y-3">
                {strengths.map((item) => (
                  <li key={item.key} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink">{item.label}</span>
                      <Badge tone="emerald">Strong</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">{item.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No strong areas yet. Each area below can be built up.</p>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-ink">To improve</h3>
            {improvements.length ? (
              <ul className="space-y-3">
                {improvements.map((item) => (
                  <li key={item.key} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink">{item.label}</span>
                      <Badge tone={item.urgent ? 'amber' : 'accent'}>{item.urgent ? 'Needs attention' : 'Could improve'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">{item.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing to improve right now. Keep it up.</p>
            )}
          </div>
        </div>
      ) : null}

      {missing.length ? (
        <p className="text-sm text-muted">Not enough data yet for: {missing.join(', ')}.</p>
      ) : null}

      <details className="rounded-lg bg-canvas p-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink">How is this worked out?</summary>
        <p className="mt-2 text-muted">
          It combines your assessment results and course activity into a rough guide. It is not a grade and is not final.
          Talk to your instructor for the full picture.
        </p>
      </details>
    </div>
  );
}

function SortHeader({ label, sortKey, activeKey, direction, onSort }) {
  const isActive = activeKey === sortKey;
  let ariaSort = 'none';
  if (isActive) ariaSort = direction === 'asc' ? 'ascending' : 'descending';

  return (
    <th scope="col" aria-sort={ariaSort} className="pb-3 pr-4 text-left font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 rounded transition hover:text-ink ${isActive ? 'text-ink' : 'text-muted'}`}
      >
        {label}
        <span aria-hidden="true" className="text-xs">
          {isActive ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

export function RoleDashboardPage() {
  const { user, logout } = useAuth();
  const [modules, setModules] = useState([]);
  const [student, setStudent] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [moduleSearch, setModuleSearch] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState(null);
  const [sortKey, setSortKey] = useState('student');
  const [sortDir, setSortDir] = useState('asc');
  const [linkExternalId, setLinkExternalId] = useState('');
  const [linking, setLinking] = useState(false);
  const [availableIds, setAvailableIds] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [idQuery, setIdQuery] = useState('');
  const [idMenuOpen, setIdMenuOpen] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [features, setFeatures] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadVisibleModules() {
    const payload = await dataApi('/modules');
    const allModules = payload?.modules ?? [];
    if (user?.role !== 'instructor') return allModules;
    const assigned = await dataApi('/instructor/me/modules');
    const codes = new Set(assigned?.moduleCodes ?? []);
    return allModules.filter((module) => codes.has(module.code));
  }

  useEffect(() => {
    if (!user) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        if (user.role === 'student') {
          const [studentPayload, modulePayload] = await Promise.all([
            dataApi('/demo-accounts/me').catch((err) => {
              if (err.status === 404) return null;
              throw err;
            }),
            dataApi('/demo-accounts/me/modules').catch((err) => {
              if (err.status === 404) return { modules: [] };
              throw err;
            }),
          ]);
          if (!active) return;
          setStudent(studentPayload?.student ?? null);
          setModules(modulePayload?.modules ?? []);
        } else {
          const nextModules = await loadVisibleModules();
          if (!active) return;
          setModules(nextModules);
          setSelectedModule((current) => current ?? nextModules[0] ?? null);
        }
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Could not load dashboard data.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'student' || student) return;

    let active = true;
    setLoadingAvailable(true);
    dataApi('/demo-accounts/available')
      .then((payload) => {
        if (active) setAvailableIds(payload?.externalIds ?? []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load student IDs.');
      })
      .finally(() => {
        if (active) setLoadingAvailable(false);
      });

    return () => {
      active = false;
    };
  }, [user, student]);

  useEffect(() => {
    if (!user || user.role !== 'student') return;
    if (!student) {
      setPrediction(null);
      setFeatures(null);
      return;
    }

    let active = true;
    setPredictionLoading(true);

    async function runPrediction() {
      try {
        const studentData = await dataApi('/demo-accounts/me/prediction-features');
        const nextFeatures = studentData.features;
        if (active) setFeatures(nextFeatures);

        const missingFeatures = Object.entries(nextFeatures)
          .filter(([, value]) => value === null)
          .map(([name]) => MISSING_PHRASES[name] ?? 'more information');

        if (missingFeatures.length) {
          if (active) {
            setPrediction({
              prediction: 'needs_data',
              risk_score: null,
              message: `We need more ${missingFeatures.join(' and ')} before we can give you an outlook.`,
            });
          }
          return;
        }

        const result = await predictStudentRisk({ studentId: studentData.studentId, features: nextFeatures });
        if (active) setPrediction(result);
      } catch (err) {
        if (active) {
          setPrediction({ prediction: 'unavailable', risk_score: null, message: err.message || 'Prediction unavailable.' });
        }
      } finally {
        if (active) setPredictionLoading(false);
      }
    }

    void runPrediction();
    return () => {
      active = false;
    };
  }, [user, student]);

  useEffect(() => {
    if (!user || user.role !== 'instructor' || !selectedModule) return;

    let active = true;

    async function loadEnrollments() {
      setLoadingEnrollments(true);
      setEnrollments([]);
      setOutcomeFilter(null);
      const path = `/modules/${encodeURIComponent(selectedModule.code)}/${encodeURIComponent(selectedModule.presentation)}/enrollments`;
      try {
        const payload = await dataApi(path);
        if (active) setEnrollments(payload?.enrollments ?? []);
      } catch (err) {
        if (active) setError(err.message || 'Could not load cohort data.');
      } finally {
        if (active) setLoadingEnrollments(false);
      }
    }

    void loadEnrollments();
    return () => {
      active = false;
    };
  }, [user, selectedModule]);

  const filteredModules = useMemo(() => {
    const query = moduleSearch.trim().toLowerCase();
    if (!query) return modules;
    return modules.filter((module) => `${module.code} ${module.presentation}`.toLowerCase().includes(query));
  }, [modules, moduleSearch]);

  const idMatches = useMemo(() => {
    const query = idQuery.trim();
    const pool = query ? availableIds.filter((id) => String(id).includes(query)) : availableIds;
    return pool.slice(0, 20);
  }, [availableIds, idQuery]);

  const outcomeCounts = useMemo(() => {
    const counts = { Distinction: 0, Pass: 0, Fail: 0, Withdrawn: 0 };
    for (const enrollment of enrollments) {
      if (enrollment.finalResult in counts) counts[enrollment.finalResult] += 1;
    }
    return counts;
  }, [enrollments]);

  const visibleEnrollments = useMemo(() => {
    const filtered = outcomeFilter ? enrollments.filter((item) => item.finalResult === outcomeFilter) : enrollments;
    const direction = sortDir === 'asc' ? 1 : -1;

    function valueOf(row) {
      switch (sortKey) {
        case 'outcome':
          return OUTCOME_RANK[row.finalResult] ?? 99;
        case 'credits':
          return row.studiedCredits ?? 0;
        case 'registered':
          return row.registeredDay ?? 0;
        default:
          return row.student?.externalId ?? row.studentId ?? 0;
      }
    }

    return [...filtered].sort((a, b) => (valueOf(a) - valueOf(b)) * direction);
  }, [enrollments, outcomeFilter, sortKey, sortDir]);

  if (!user) return null;

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function handleIdQueryChange(event) {
    const digits = event.target.value.replace(/\D/g, '');
    setIdQuery(digits);
    setIdMenuOpen(true);
    setLinkExternalId(availableIds.includes(Number(digits)) ? digits : '');
  }

  function selectId(id) {
    setIdQuery(String(id));
    setLinkExternalId(String(id));
    setIdMenuOpen(false);
  }

  async function handleLinkDemoAccount(event) {
    event.preventDefault();
    setLinking(true);
    setError('');
    try {
      const payload = await dataApi('/demo-accounts/link', {
        method: 'POST',
        body: JSON.stringify({ externalId: Number(linkExternalId) }),
      });
      setStudent(payload?.student ?? null);
      setLinkExternalId('');
    } catch (err) {
      setError(err.message || 'Could not link demo account.');
    } finally {
      setLinking(false);
    }
  }

  const isStudent = user.role === 'student';
  const isInstructor = user.role === 'instructor';
  const isAdmin = user.role === 'admin';

  const passedCount = outcomeCounts.Pass + outcomeCounts.Distinction;
  const passRate =
    selectedModule && enrollments.length ? `${Math.round((passedCount / enrollments.length) * 100)}%` : '—';

  let stats = [];
  if (isInstructor) {
    stats = [
      { label: 'Your modules', value: String(modules.length) },
      { label: 'Students in cohort', value: selectedModule ? String(enrollments.length) : '—' },
      { label: 'Pass rate', value: passRate, hint: 'Pass or distinction, out of everyone enrolled' },
    ];
  } else if (isAdmin) {
    stats = [
      { label: 'Modules available', value: String(modules.length) },
      { label: 'Access', value: 'Full', hint: 'Manage modules and instructors' },
    ];
  }

  const outcomeSegments = OUTCOME_SEGMENTS.map((segment) => ({ ...segment, value: outcomeCounts[segment.key] }));

  const firstName = user.name?.split(' ')[0] ?? '';

  return (
    <AppShell user={user} onSignOut={() => void logout()}>
      {isStudent ? (
        <div className="mb-10">
          <p className="text-sm font-medium text-accent">Your learning snapshot</p>
          <h1 className="mt-1 font-display text-4xl text-ink">{firstName ? `Hi, ${firstName}` : 'Welcome back'}</h1>
          <p className="mt-3 max-w-2xl text-muted">{BLURB.student}</p>
        </div>
      ) : (
        <div className="mb-10">
          <p className="text-sm font-medium capitalize text-accent">{user.role} dashboard</p>
          <h1 className="mt-1 font-display text-4xl text-ink">Welcome back, {user.name}</h1>
          <p className="mt-3 max-w-2xl text-muted">{BLURB[user.role]}</p>
        </div>
      )}

      {error ? (
        <div role="alert" className="mb-8 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {stats.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      ) : null}

      {isStudent ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader title="Your outlook" description="A simple view of how your course is going." />
            {student ? (
              <StudentSnapshot prediction={prediction} features={features} loading={predictionLoading} />
            ) : (
              <form onSubmit={handleLinkDemoAccount} className="space-y-4">
                <div className="relative">
                  <label htmlFor="demo-student-id" className="block text-sm font-medium text-ink">
                    Your student ID
                  </label>
                  <input
                    id="demo-student-id"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={idMenuOpen}
                    aria-controls="demo-student-id-list"
                    aria-autocomplete="list"
                    value={idQuery}
                    onChange={handleIdQueryChange}
                    onFocus={() => setIdMenuOpen(true)}
                    onBlur={() => setIdMenuOpen(false)}
                    disabled={loadingAvailable}
                    placeholder={loadingAvailable ? 'Loading IDs…' : 'Type to search your ID'}
                    className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
                  />
                  {idMenuOpen && !loadingAvailable ? (
                    <ul
                      id="demo-student-id-list"
                      role="listbox"
                      className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
                    >
                      {idMatches.length ? (
                        idMatches.map((id) => (
                          <li key={id} role="option" aria-selected={String(id) === linkExternalId}>
                            <button
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectId(id);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm tabular-nums text-ink hover:bg-accent-soft ${String(id) === linkExternalId ? 'bg-accent-soft' : ''}`}
                            >
                              {id}
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="px-3 py-2 text-sm text-muted">
                          {availableIds.length ? 'No matching IDs' : 'No IDs available to link'}
                        </li>
                      )}
                    </ul>
                  ) : null}
                </div>
                <p className="text-sm text-muted">Choose the ID that matches your course records to see your outlook.</p>
                <Button type="submit" disabled={linking || !linkExternalId.trim()} className="w-full">
                  {linking ? 'Connecting…' : 'Connect my account'}
                </Button>
              </form>
            )}
          </Card>

          <Card>
            <CardHeader title="Your courses" />
            {loading ? (
              <ListSkeleton />
            ) : modules.length === 0 ? (
              <EmptyState title="No courses yet">Your courses will appear here once they are added.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {modules.map((module) => (
                  <li
                    key={`${module.code}-${module.presentation ?? 'unknown'}`}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="font-medium text-ink">{module.code}</span>
                    <span className="text-sm text-muted">{module.presentation ?? ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {isInstructor ? (
        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader title="Your modules" description="Select a module to see its enrolled students." />
            <input
              type="search"
              value={moduleSearch}
              onChange={(event) => setModuleSearch(event.target.value)}
              placeholder="Search by module code"
              aria-label="Search modules"
              className="mb-4 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {loading ? (
              <ListSkeleton />
            ) : modules.length === 0 ? (
              <EmptyState title="No modules assigned yet">
                An administrator assigns modules to your account. They will appear here.
              </EmptyState>
            ) : filteredModules.length === 0 ? (
              <p className="text-sm text-muted">No modules match “{moduleSearch}”.</p>
            ) : (
              <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {filteredModules.map((module) => {
                  const isSelected =
                    selectedModule?.code === module.code && selectedModule?.presentation === module.presentation;
                  return (
                    <button
                      key={`${module.code}-${module.presentation ?? 'unknown'}`}
                      type="button"
                      onClick={() => setSelectedModule(module)}
                      aria-pressed={isSelected}
                      className={`w-full rounded-lg border p-3 text-left transition ${isSelected ? 'border-accent bg-accent-soft' : 'border-line hover:bg-accent-soft/60'}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-ink">{module.code}</p>
                          <p className="text-sm text-muted">{module.presentation ?? 'Presentation'}</p>
                        </div>
                        <span className="text-sm tabular-nums text-muted">{module.lengthDays ?? 'n/a'} days</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={selectedModule ? `${selectedModule.code} · ${selectedModule.presentation}` : 'Enrollments'}
              description={selectedModule ? `${enrollments.length} enrolled students` : 'No module selected.'}
            />

            {selectedModule && enrollments.length > 0 && !loadingEnrollments ? (
              <div className="mb-6">
                <SegmentedBar segments={outcomeSegments} activeKey={outcomeFilter} onSelect={setOutcomeFilter} />
              </div>
            ) : null}

            {outcomeFilter && !loadingEnrollments ? (
              <div className="mb-3 flex items-center justify-between text-sm text-muted">
                <span>
                  Showing {visibleEnrollments.length} of {enrollments.length} students
                </span>
                <Button variant="ghost" onClick={() => setOutcomeFilter(null)} className="px-2 py-1">
                  Clear filter
                </Button>
              </div>
            ) : null}

            {loadingEnrollments ? (
              <ListSkeleton />
            ) : !selectedModule ? (
              <EmptyState title="Select a module">Choose one of your modules to view its cohort.</EmptyState>
            ) : enrollments.length === 0 ? (
              <EmptyState title="No enrollment data">There are no students recorded for this cohort yet.</EmptyState>
            ) : visibleEnrollments.length === 0 ? (
              <EmptyState title="No students with this outcome">Clear the filter to see everyone.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-line text-muted">
                    <tr>
                      <SortHeader label="Student" sortKey="student" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <SortHeader label="Outcome" sortKey="outcome" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <SortHeader label="Credits" sortKey="credits" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <SortHeader label="Registered (day)" sortKey="registered" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visibleEnrollments.map((enrollment) => (
                      <tr
                        key={`${enrollment.studentId}-${enrollment.moduleCode}-${enrollment.presentation}`}
                        className="transition hover:bg-canvas"
                      >
                        <td className="py-3 pr-4 font-medium tabular-nums text-ink">
                          {enrollment.student?.externalId ?? enrollment.studentId}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={OUTCOME_TONE[enrollment.finalResult] ?? 'slate'}>{enrollment.finalResult}</Badge>
                        </td>
                        <td className="py-3 pr-4 tabular-nums text-muted">{enrollment.studiedCredits}</td>
                        <td className="py-3 pr-4 tabular-nums text-muted">{enrollment.registeredDay ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="mt-10 space-y-10">
          <AdminModuleAssignments />
          <AdminStudentLinks />
          <AdminRoleManagement />
          <AdminAuditLog />
        </div>
      ) : null}
    </AppShell>
  );
}