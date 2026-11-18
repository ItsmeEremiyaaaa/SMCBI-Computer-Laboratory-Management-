import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Crest } from '../components/ui';
import { LAYOUTS, roomSize, seatPlacement, seatsFor } from '../lib/layouts';

type S = 'f' | 'i' | 'r' | 'b';
const COLOR: Record<S, string> = { f: '#22c55e', i: '#60a5fa', r: '#f59e0b', b: '#ef4444' };
const LABEL: Record<S, string> = { f: 'Free', i: 'In use', r: 'Reserved', b: 'Broken' };
const LABS = [
  { id: 'lab1', name: 'ComLab 1' },
  { id: 'lab2', name: 'ComLab 2' },
  { id: 'netlab', name: 'NetLab' },
];
// a believable mix: mostly in use or free, a few reserved, rarely broken
const pick = (): S => { const r = Math.random(); return r < 0.5 ? 'i' : r < 0.86 ? 'f' : r < 0.97 ? 'r' : 'b'; };
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Illustration only (nobody is signed in yet, so there is no live data): the real seat layouts
// of the three labs, with PCs changing status every second or so.
function useAnimatedSeats() {
  const seats = useMemo(() => LABS.map((l) => seatsFor(l.id)), []);
  const [state, setState] = useState(() => seats.map((s) => s.map(pick)));
  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => setState((cur) => cur.map((lab) => lab.map((v) => (Math.random() < 0.06 ? pick() : v)))), 1100);
    return () => clearInterval(t);
  }, []);
  return { seats, state };
}

function MiniLab({ id, seats, state }: { id: string; seats: ReturnType<typeof seatsFor>; state: S[] }) {
  const lab = { id, rows: LAYOUTS[id].rows, cols: LAYOUTS[id].cols };
  const { w, d } = roomSize(lab);
  return (
    <svg viewBox={`${-w / 2 - 0.3} ${-d / 2 - 0.3} ${w + 0.6} ${d + 0.6}`} className="h-full w-full" aria-hidden>
      <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.3} fill="rgb(255 255 255 / .06)" stroke="rgb(255 255 255 / .35)" strokeWidth={0.12} />
      <rect x={-1.6} y={-d / 2 + 0.15} width={3.2} height={0.14} rx={0.07} fill="rgb(255 255 255 / .45)" />
      {seats.map((s, i) => {
        const { pos, rot } = seatPlacement(lab, s.row, s.col);
        return (
          <g key={s.id} transform={`translate(${pos[0]} ${pos[2]}) rotate(${(-rot * 180) / Math.PI})`}>
            <rect x={-0.5} y={-0.32} width={1} height={0.62} rx={0.1} fill={COLOR[state[i]]} style={{ transition: 'fill .6s ease' }} />
            <circle cx={0} cy={0.6} r={0.17} fill="rgb(255 255 255 / .28)" />
          </g>
        );
      })}
    </svg>
  );
}

function ManilaClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t); }, []);
  const opts = { timeZone: 'Asia/Manila' } as const;
  return (
    <div>
      <p className="font-cond text-4xl font-semibold tabular-nums">{now.toLocaleTimeString('en-PH', { ...opts, hour: 'numeric', minute: '2-digit' })}</p>
      <p className="text-sm text-blue-200">{now.toLocaleDateString('en-PH', { ...opts, weekday: 'long', month: 'long', day: 'numeric' })} · Bansalan</p>
    </div>
  );
}

export default function AuthShell({ children }: { children: ReactNode }) {
  const { seats, state } = useAnimatedSeats();
  const counts = useMemo(() => {
    const all = state.flat();
    return (['f', 'i', 'r', 'b'] as S[]).map((s) => [s, all.filter((x) => x === s).length] as const);
  }, [state]);

  return (
    <div className="grid min-h-full lg:grid-cols-[1.15fr_1fr]">
      {/* Left: brand + live-looking lab maps (desktop) */}
      <div className="navy-weave relative hidden flex-col gap-8 overflow-hidden p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-sky-300/10 blur-3xl" aria-hidden />

        <div className="relative flex items-center gap-4">
          <Crest size={56} />
          <div>
            <p className="font-serif text-2xl font-semibold">ComLab Monitor</p>
            <p className="text-sm text-blue-200">St. Mary’s College of Bansalan, Inc. · College of Information Technology</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="max-w-lg font-serif text-4xl font-semibold leading-tight">Every PC, every lab, at a glance.</h2>
          <p className="mt-3 max-w-md text-blue-100/80">See which seats are free, book a NetLab PC, and check in to your seat by scanning its QR code.</p>
        </div>

        <div className="relative grid flex-1 grid-cols-3 items-end gap-4">
          {LABS.map((l, i) => (
            <figure key={l.id} className="flex h-full max-h-80 flex-col rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur-sm">
              <div className="min-h-0 flex-1"><MiniLab id={l.id} seats={seats[i]} state={state[i]} /></div>
              <figcaption className="mt-2 flex items-baseline justify-between text-sm">
                <span className="font-semibold">{l.name}</span>
                <span className="text-blue-200">{state[i].filter((s) => s === 'f').length}/{seats[i].length} free</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <ManilaClock />
          <ul className="flex flex-wrap gap-2 text-xs">
            {counts.map(([s, n]) => (
              <li key={s} className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">
                <span className="h-2 w-2 rounded-full" style={{ background: COLOR[s] }} />{LABEL[s]} <b className="tabular-nums">{n}</b>
              </li>
            ))}
            <li className="px-1 py-1 text-blue-200/70">Illustration</li>
          </ul>
        </div>
      </div>

      {/* Right: the form */}
      <div className="relative flex flex-col bg-chalk lg:bg-panel">
        {/* Mobile header with one animated lab */}
        <div className="navy-weave relative flex items-center gap-3 overflow-hidden px-5 pb-16 pt-6 text-white lg:hidden">
          <Crest size={44} />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl font-semibold">ComLab Monitor</p>
            <p className="truncate text-xs text-blue-200">St. Mary’s College of Bansalan, Inc.</p>
          </div>
          <div className="h-16 w-24 shrink-0 opacity-90"><MiniLab id="netlab" seats={seats[2]} state={state[2]} /></div>
        </div>
        <div className="-mt-10 flex flex-1 items-start justify-center px-4 pb-10 lg:mt-0 lg:items-center lg:p-10">
          <div className="w-full max-w-sm rounded-2xl bg-panel p-6 shadow-lg ring-1 ring-line/60 lg:p-0 lg:shadow-none lg:ring-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
