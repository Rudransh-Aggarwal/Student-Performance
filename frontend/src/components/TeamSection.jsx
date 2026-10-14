import { useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/useMediaQuery';

// Edit photo and linkedin per member. Put photo files in frontend/public/team/.
const MEMBERS = [
  {
    name: 'Rudransh',
    role: 'Frontend developer',
    photo: '/team/rudransh.jpeg',
    linkedin: 'https://www.linkedin.com/in/rudransh-aggarwal-65781a398',
  },
  {
    name: 'Diwas',
    role: 'Backend developer',
    photo: '/team/diwas.jpeg',
    linkedin: 'https://www.linkedin.com/in/diwasupadhyay?utm_source=share_via&utm_content=profile&utm_medium=member_ios',
  },
  {
    name: 'Utkarsh',
    role: 'Backend developer',
    photo: '/team/utkarsh.jpeg',
    linkedin: 'https://www.linkedin.com/in/utkarsh-singh-a9204z/',
  },
  {
    name: 'Ishan',
    role: 'ML engineer and data scientist',
    photo: '/team/ishan.png',
    linkedin: 'https://www.linkedin.com/in/ishan-sharma-279b59253',
  },
];

const STACK_HEIGHT = '24rem';
const GAP = '0.75rem';
// Three squares and two gaps fill the stack height exactly.
const SQUARE = `calc((${STACK_HEIGHT} - 2 * ${GAP}) / 3)`;

export function TeamSection() {
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const count = MEMBERS.length;

  const transition = reducedMotion
    ? 'none'
    : 'left 700ms ease-in-out, top 700ms ease-in-out, width 700ms ease-in-out, height 700ms ease-in-out';

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-center">
      <div>
        <h2 className="font-sans text-4xl font-semibold text-ink">MEET THE TEAM</h2>
        <p className="mt-6 max-w-md text-muted">
          Meet the minds who brought this vision to life through thoughtful design, development, and collaboration.
        </p>

        <div className="mt-10 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveIndex((index) => (index - 1 + count) % count)}
            aria-label="Previous member"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition hover:border-accent hover:text-accent"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveIndex((index) => (index + 1) % count)}
            aria-label="Next member"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition hover:border-accent hover:text-accent"
          >
            <span aria-hidden="true">›</span>
          </button>
          <span className="text-sm tabular-nums text-muted" aria-live="polite">
            {String(activeIndex + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div
        className="relative w-full"
        style={{ height: STACK_HEIGHT, '--gap': GAP, '--square': SQUARE }}
      >
        {MEMBERS.map((member, index) => {
          // 0 = expanded card; 1..count-1 = collapsed squares, stacked in cycling order after it.
          const offset = (index - activeIndex + count) % count;
          const isActive = offset === 0;
          const slot = offset - 1;

          const position = isActive
            ? {
                left: 0,
                top: 0,
                width: 'calc(100% - var(--square) - var(--gap))',
                height: '100%',
              }
            : {
                left: 'calc(100% - var(--square))',
                top: `calc(${slot} * (var(--square) + var(--gap)))`,
                width: 'var(--square)',
                height: 'var(--square)',
              };

          return (
            <article
              key={member.name}
              className="absolute overflow-hidden rounded-xl border border-line bg-surface/85 backdrop-blur-md"
              style={{ ...position, transition }}
            >
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-expanded={isActive}
                aria-label={isActive ? member.name : `Show ${member.name}`}
                className="absolute inset-0 z-0 h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
              >
                <img src={member.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/30 to-transparent"
                  />
                ) : null}
              </button>

              <div
                className={`absolute inset-x-0 bottom-0 z-10 p-6 ${
                  reducedMotion ? '' : 'transition-opacity duration-500 delay-200'
                } ${isActive ? 'opacity-100' : 'invisible opacity-0'}`}
              >
                <h3 className="font-display text-3xl text-ink">{member.name}</h3>
                <p className="mt-1 text-sm text-muted">{member.role}</p>
                <a
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={isActive ? 0 : -1}
                  aria-label={`${member.name} on LinkedIn`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
                >
                  LinkedIn ↗
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}