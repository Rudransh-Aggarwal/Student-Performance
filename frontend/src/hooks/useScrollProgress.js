import { useEffect } from 'react';

// Fraction of the remaining distance covered per frame. Lower values feel smoother and slower.
const EASE = 0.1;
const EPSILON = 0.0005;

/**
 * Maps the scroll position of `containerRef` to a 0..1 progress value.
 * The value eases toward the scroll target every animation frame, so the chapters and the
 * background glide instead of jumping with each scroll event.
 * `progressRef` receives the eased value; `onChange` is called on every frame that changes it.
 * `onChange` must be stable (wrap it in useCallback).
 */
export function useScrollProgress(containerRef, progressRef, onChange) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let target = 0;
    let frame = 0;

    const readTarget = () => {
      const rect = container.getBoundingClientRect();
      const scrollable = Math.max(container.offsetHeight - window.innerHeight, 1);
      target = Math.min(Math.max(-rect.top / scrollable, 0), 1);
    };

    const tick = () => {
      const current = progressRef.current;
      const next = current + (target - current) * EASE;
      const settled = Math.abs(target - next) < EPSILON;

      progressRef.current = settled ? target : next;
      onChange?.(progressRef.current);

      frame = settled ? 0 : requestAnimationFrame(tick);
    };

    const start = () => {
      readTarget();
      if (!frame) frame = requestAnimationFrame(tick);
    };

    start();
    window.addEventListener('scroll', start, { passive: true });
    window.addEventListener('resize', start);

    return () => {
      window.removeEventListener('scroll', start);
      window.removeEventListener('resize', start);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    };
  }, [containerRef, progressRef, onChange]);
}