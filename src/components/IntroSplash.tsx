import { useEffect, useRef, useState } from 'react';

const KEY = 'comlab-intro-played';
const SIZE = 168;

function alreadyPlayed() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

// Sign-in intro: the seal appears centred on a blue field, then flies into the sidebar
// logo while the blue field closes into a circle around it, revealing the dashboard.
// Plays once per browser session; skipped when the viewer prefers reduced motion.
export default function IntroSplash() {
  const [show, setShow] = useState(() =>
    !alreadyPlayed() && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));
  const field = useRef<HTMLDivElement>(null);
  const seal = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!show) return;
    const done = () => {
      try { sessionStorage.setItem(KEY, '1'); } catch { /* private mode */ }
      setShow(false);
    };
    const f = field.current, s = seal.current;
    if (!f || !s || typeof s.animate !== 'function') return done();

    let cancelled = false;
    const run = async () => {
      // 1. seal arrives smoothly with stately easing
      await s.animate(
        [{ opacity: 0, transform: 'scale(.65)' }, { opacity: 1, transform: 'scale(1.02)' }, { transform: 'scale(1)' }],
        { duration: 1000, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' },
      ).finished;
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;

      // 2. fly to the sidebar logo; the blue field closes into a circle around it
      const from = s.getBoundingClientRect();
      const target = document.querySelector('[data-intro-target]')?.getBoundingClientRect();
      const visible = target && target.width > 0;
      const cx = visible ? target.left + target.width / 2 : innerWidth / 2;
      const cy = visible ? target.top + target.height / 2 : innerHeight / 2;
      const dx = cx - (from.left + from.width / 2);
      const dy = cy - (from.top + from.height / 2);
      const scale = visible ? target.width / from.width : 0.4;
      const radius = Math.hypot(innerWidth, innerHeight);
      const timing = { duration: 1200, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: 'forwards' as const };

      await Promise.all([
        s.animate(
          [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: visible ? 1 : 0 }],
          timing,
        ).finished,
        f.animate(
          [{ clipPath: `circle(${radius}px at ${cx}px ${cy}px)` }, { clipPath: `circle(${visible ? target.width / 2 : 0}px at ${cx}px ${cy}px)` }],
          timing,
        ).finished,
      ]);
      if (!cancelled) done();
    };
    run().catch(done);
    // Hidden tabs don't run animations; never leave the blue screen up for long.
    const safety = setTimeout(done, 4200);
    return () => { cancelled = true; clearTimeout(safety); };
  }, [show]);

  if (!show) return null;
  return (
    <div ref={field} className="navy-weave fixed inset-0 z-[100] grid place-items-center" aria-hidden onClick={() => setShow(false)}>
      <div className="grid justify-items-center gap-5">
        <img ref={seal} src="/smcbi-seal.webp" width={SIZE} height={SIZE} alt=""
          className="rounded-full bg-white p-1 opacity-0 shadow-[0_0_0_10px_rgb(255_255_255/0.08),0_20px_60px_-10px_rgb(0_0_0/0.45)]" />
      </div>
    </div>
  );
}
