import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HeroCanvas } from '../components/HeroCanvas';
import { LoginForm } from '../components/LoginForm';
import { TeamSection } from '../components/TeamSection';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { usePrefersReducedMotion } from '../hooks/useMediaQuery';
import { useScrollProgress } from '../hooks/useScrollProgress';
import { ROLE_HOME, ROLE_LABEL } from '../lib/roles';

const CHAPTERS = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'team', label: 'Team' },
  { id: 'sign-in', label: 'Sign in' },
];

const LAST = CHAPTERS.length - 1;

// Viewport heights of scrolling per chapter. Lower = faster movement between chapters.
const SCROLL_PER_CHAPTER_SVH = 90;

// Each step between two chapters is split into two parts:
// 1. Hold: the current chapter stays fully visible and still for the first HOLD_END of the step.
// 2. Transition: the current chapter fades out first, then the next one fades in.
//    They never overlap, so text from two chapters is never readable at the same time.
const HOLD_END = 0.6;
const SLIDE_PX = 40;

const CAPABILITIES = [
  {
    title: 'Students',
    text: 'See your own risk estimate and the weekly activity and assessment results behind it.',
  },
  {
    title: 'Instructors',
    text: 'Monitor cohorts for the modules assigned to you, with enrollment and risk breakdowns.',
  },
  {
    title: 'Admins',
    text: 'Assign modules to instructors and manage the accounts that use the system.',
  },
  {
    title: 'Sign-in',
    text: 'Sign in with email, Google, or GitHub. Each account carries a role that decides which dashboard opens.',
  },
];

function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Returns opacity and vertical offset (px) for one chapter, given the chapter cursor (0..LAST). */
function chapterStyle(index, cursor, reducedMotion) {
  const base = Math.min(Math.floor(cursor), LAST);
  const frac = base >= LAST ? 0 : cursor - base;

  if (index === base) {
    if (frac < HOLD_END) return { opacity: 1, offset: 0 };
    const s = (frac - HOLD_END) / (1 - HOLD_END);
    return {
      opacity: 1 - smoothstep(0, 0.5, s),
      offset: reducedMotion ? 0 : -s * SLIDE_PX,
    };
  }

  if (index === base + 1 && frac >= HOLD_END) {
    const s = (frac - HOLD_END) / (1 - HOLD_END);
    const reveal = smoothstep(0.5, 1, s);
    return {
      opacity: reveal,
      offset: reducedMotion ? 0 : (1 - reveal) * SLIDE_PX,
    };
  }

  return { opacity: 0, offset: 0 };
}

export function LandingPage() {
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();

  const containerRef = useRef(null);
  const progressRef = useRef(0);
  const chapterRefs = useRef([]);
  const activeRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [promptVisible, setPromptVisible] = useState(false);

  // Runs on every animation frame and writes styles straight to the DOM.
  // React state only changes when the nearest chapter changes.
  const applyChapters = useCallback(
    (value) => {
      const cursor = value * LAST;
      chapterRefs.current.forEach((node, index) => {
        if (!node) return;
        const { opacity, offset } = chapterStyle(index, cursor, reducedMotion);
        node.style.opacity = opacity.toFixed(3);
        node.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
        node.style.visibility = opacity > 0 ? 'visible' : 'hidden';
        node.style.pointerEvents = opacity > 0.6 ? 'auto' : 'none';
      });

      const nearest = Math.round(cursor);
      if (nearest !== activeRef.current) {
        activeRef.current = nearest;
        setActiveIndex(nearest);
      }
    },
    [reducedMotion],
  );

  useScrollProgress(containerRef, progressRef, applyChapters);

  const goToChapter = useCallback(
    (index) => {
      const container = containerRef.current;
      if (!container) return;
      const scrollable = Math.max(container.offsetHeight - window.innerHeight, 0);
      const top = container.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: top + (index / LAST) * scrollable,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    },
    [reducedMotion],
  );

  function openDashboard() {
    if (status === 'loading') return;
    if (user) {
      navigate(ROLE_HOME[user.role]);
      return;
    }
    setPromptVisible(true);
    goToChapter(LAST);
  }

  function setChapterRef(index) {
    return (node) => {
      chapterRefs.current[index] = node;
    };
  }

  function renderChapter(id) {
    switch (id) {
      case 'home':
        return (
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Capstone project</p>
            <h1 className="mt-4 font-display text-[clamp(3rem,9vw,8rem)] leading-[0.95] text-ink">
              Student
              <br />
              Performance
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted sm:text-lg">
              Early signals of where students may need support, drawn from learning activity and assessment data.
            </p>
            <button type="button" onClick={() => goToChapter(1)} className="mt-10 text-sm text-accent hover:underline">
              Scroll to explore ↓
            </button>
          </div>
        );

      case 'about':
        return (
          <div className="max-w-3xl">
            <h2 className="font-sans text-4xl font-semibold text-ink">About the project</h2>
            <p className="mt-6 text-muted">
              An intelligent student performance prediction system built as a capstone project. 
              It uses sampled records from the Open University Learning Analytics Dataset (OULAD) to flag students who may need support. 
              Students see their own outlook and improvement points, instructors see the outcomes for their assigned modules, and admins manage module assignments and accounts.
            </p>
            <p className="mt-4 text-muted">
              The risk estimate is a prototype: a logistic regression model (risk-v2) trained on sampled OULAD outcomes, using assessment scores and engagement.
              It estimates end-of-course results, not early warning, and it has not been externally validated. 
              The system runs locally with Docker Compose or Kubernetes (minikube).
            </p>
            <ul className="mt-10 divide-y divide-line border-y border-line">
              {CAPABILITIES.map((item) => (
                <li key={item.title} className="grid gap-2 py-6 sm:grid-cols-[10rem_1fr]">
                  <h3 className="font-display text-xl text-ink">{item.title}</h3>
                  <p className="text-sm text-muted">{item.text}</p>
                </li>
              ))}
            </ul>
          </div>
        );

      case 'team':
        return <TeamSection />;

      case 'sign-in':
        return (
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="font-sans text-4xl font-semibold text-ink">
                {user ? `Welcome, ${user.name}` : 'Sign in to continue'}
              </h2>
              <p className="mt-6 text-muted">
                {user
                  ? 'Your account is active. Open your dashboard to see the data for your role.'
                  : 'Dashboards hold student data, so they are only available after you sign in.'}
              </p>
              <button type="button" onClick={() => goToChapter(0)} className="mt-10 text-sm text-accent hover:underline">
                Back to top ↑
              </button>
            </div>
            <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
              {status === 'loading' ? (
                <p className="text-sm text-muted" role="status">
                  Checking your session…
                </p>
              ) : user ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted">
                    Signed in as <span className="font-medium text-ink">{user.name}</span> ({ROLE_LABEL[user.role]})
                  </p>
                  <Link
                    to={ROLE_HOME[user.role]}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2 font-medium text-on-accent transition hover:bg-accent-strong"
                  >
                    Open dashboard
                  </Link>
                </div>
              ) : (
                <>
                  {promptVisible ? (
                    <p role="status" className="mb-6 rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">
                      Sign in or create an account to open your dashboard.
                    </p>
                  ) : null}
                  <LoginForm />
                  <p className="mt-6 text-center text-sm text-muted">
                    New here?{' '}
                    <Link to="/register" className="font-medium text-accent hover:underline">
                      Create an account
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="bg-canvas text-ink">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur">
        <nav aria-label="Primary" className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => goToChapter(0)} className="flex items-center gap-2 sm:gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-accent font-display text-base font-semibold text-on-accent"
            >
              S
            </span>
            <span className="hidden font-display text-lg font-semibold text-ink sm:inline">Student Performance</span>
          </button>
          <div className="flex items-center gap-0.5 sm:gap-2">
            {[
              { label: 'Home', index: 0 },
              { label: 'About', index: 1 },
              { label: 'Team', index: 2 },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => goToChapter(item.index)}
                aria-current={activeIndex === item.index ? 'true' : undefined}
                className="rounded-md px-2 py-2 text-xs text-muted transition hover:text-ink sm:px-3 sm:text-sm"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={openDashboard}
              className="rounded-md px-2 py-2 text-xs text-muted transition hover:text-ink sm:px-3 sm:text-sm"
            >
              Dashboard
            </button>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <nav aria-label="Chapters" className="fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 sm:flex">
        {CHAPTERS.map((chapter, index) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => goToChapter(index)}
            aria-label={chapter.label}
            aria-current={activeIndex === index ? 'true' : undefined}
            className={`h-2.5 w-2.5 rounded-full border border-accent transition ${
              activeIndex === index ? 'bg-accent' : 'bg-transparent hover:bg-accent-soft'
            }`}
          />
        ))}
      </nav>

      <div ref={containerRef} style={{ height: `${CHAPTERS.length * SCROLL_PER_CHAPTER_SVH}svh` }}>
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden grain">
          <HeroCanvas progressRef={progressRef} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-canvas/45" />

          {CHAPTERS.map((chapter, index) => (
            <section
              key={chapter.id}
              ref={setChapterRef(index)}
              aria-label={chapter.label}
              className="absolute inset-0 flex items-center overflow-y-auto px-4 pb-8 pt-24 will-change-[opacity,transform] sm:px-6"
            >
              <div className="mx-auto w-full max-w-6xl">{renderChapter(chapter.id)}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}