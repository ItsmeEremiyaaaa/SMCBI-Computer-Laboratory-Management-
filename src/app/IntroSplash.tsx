import { useEffect, useRef, useState, type CSSProperties } from 'react';

const KEY = 'comlab-intro-played';
const SIZE = 168;

function alreadyPlayed() {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

// A navy disc centred on (cx, cy) big enough to cover the screen. Its gradient is pinned to the
// viewport so it looks identical to a full-screen navy field until it starts shrinking.
function discStyle(cx: number, cy: number): CSSProperties {
  const r = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
  return {
    left: cx - r, top: cy - r, width: r * 2, height: r * 2,
    backgroundSize: `${innerWidth}px ${innerHeight}px`,
    backgroundPosition: `${r - cx}px ${r - cy}px`,
    backgroundRepeat: 'no-repeat',
  };
}

// Sign-in intro: the seal appears centred on a navy field, then flies into the sidebar logo
// while the field shrinks into a circle around it, revealing the dashboard.
// Animates only transform/opacity (GPU-composited) so it stays smooth while the page loads behind it.
// Plays once per browser session; skipped when the viewer prefers reduced motion.
export default function IntroSplash() {
  const [show, setShow] = useState(() =>
    !alreadyPlayed() && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches));
  const field = useRef<HTMLDivElement>(null);
  const disc = useRef<HTMLDivElement>(null);
  const seal = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!show) return;
    const done = () => {
      try { sessionStorage.setItem(KEY, '1'); } catch { /* private mode */ }
      setShow(false);
    };
    const f = field.current, c = disc.current, s = seal.current;
    if (!f || !c || !s || typeof s.animate !== 'function') return done();

    let cancelled = false;
    const run = async () => {
      await s.decode?.().catch(() => {}); // never start on a half-loaded seal

      // 1. seal fades and grows in
      await s.animate(
        [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 900, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'both' },
      ).finished;
      await new Promise((r) => setTimeout(r, 450));
      if (cancelled) return;

      // 2. seal flies to the sidebar logo while the navy disc shrinks around it
      const from = s.getBoundingClientRect();
      const target = document.querySelector('[data-intro-target]')?.getBoundingClientRect();
      const visible = !!target && target.width > 0;
      const cx = visible ? target.left + target.width / 2 : innerWidth / 2;
      const cy = visible ? target.top + target.height / 2 : innerHeight / 2;
      Object.assign(c.style, Object.fromEntries(Object.entries(discStyle(cx, cy)).map(([k, v]) => [k, typeof v === 'number' ? `${v}px` : v])));
      const r = c.offsetWidth / 2;
      const dx = cx - (from.left + from.width / 2);
      const dy = cy - (from.top + from.height / 2);
      const scale = visible ? target.width / from.width : 0.4;
      const timing = { duration: 1300, easing: 'cubic-bezier(.7, 0, .2, 1)', fill: 'forwards' as const };

      await Promise.all([
        s.animate(
          [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: visible ? 1 : 0 }],
          timing,
        ).finished,
        c.animate(
          [{ transform: 'scale(1)' }, { transform: `scale(${visible ? target.width / 2 / r : 0})` }],
          timing,
        ).finished,
      ]);
      if (cancelled) return;

      // 3. cross-fade onto the real sidebar logo underneath
      await f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: 'ease-out', fill: 'forwards' }).finished;
      if (!cancelled) done();
    };
    run().catch(done);
    // Hidden tabs don't run animations; never leave the navy screen up for long.
    const safety = setTimeout(done, 6000);
    return () => { cancelled = true; clearTimeout(safety); };
  }, [show]);

  if (!show) return null;
  return (
    <div ref={field} className="fixed inset-0 z-[100] overflow-hidden" aria-hidden onClick={() => setShow(false)}>
      <div ref={disc} className="navy-weave absolute rounded-full will-change-transform" style={discStyle(innerWidth / 2, innerHeight / 2)} />
      <div className="absolute inset-0 grid place-items-center">
        <img ref={seal} src="/smcbi-seal.webp" width={SIZE} height={SIZE} alt="" decoding="async"
          className="rounded-full bg-white p-1 opacity-0 will-change-transform shadow-[0_0_0_10px_rgb(255_255_255/0.08),0_20px_60px_-10px_rgb(0_0_0/0.45)]" />
      </div>
    </div>
  );
}
