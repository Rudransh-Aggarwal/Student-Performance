import { useEffect, useRef } from 'react';
import { HeroCanvas } from './HeroCanvas';

/**
 * Fixed 3D wave field behind app pages (same scene as the landing page).
 * Scrolling the page drives the waves, the same way chapter scrolling does on the landing page.
 */
export function SceneBackdrop() {
  const progressRef = useRef(0);

  useEffect(() => {
    function update() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <HeroCanvas progressRef={progressRef} />
      <div className="absolute inset-0 bg-canvas/55" />
    </div>
  );
}