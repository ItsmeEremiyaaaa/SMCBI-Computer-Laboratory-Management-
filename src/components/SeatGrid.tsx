import { useEffect } from 'react';
import type { LivePc } from '../hooks/useLabLive';
import { LAYOUTS, islandSpines, labDoors, roomSize, seatPlacement } from '../lib/layouts';
import type { ClassSchedule, Lab, Student } from '../lib/types';
import type { SimMode } from './LabCharacters3D';
import { STATUS_COLOR, STATUS_LABEL, STATUSES } from './ui';

export interface SceneProps {
  lab: Lab;
  pcs: LivePc[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReady?: () => void;
  isOccupied?: boolean;
  classInfo?: ClassSchedule | null;
  simMode?: SimMode;
  teacherName?: string | null;
  phaseOffset?: number;
  phaseLength?: number;
  students?: Student[];
  onStudentSelect?: (s: Student, pcId: string) => void;
}

const WOOD = '#dcb385';
const FLOOR = '#f3f5f8';
const WALL = '#334155';

function Door({ wall, at, label, w, d }: { wall: 'left' | 'front' | 'back'; at: number; label: string; w: number; d: number }) {
  const r = 0.95; // door leaf width
  if (wall === 'left') {
    const x = -w / 2;
    return (
      <g>
        <rect x={x - 0.1} y={at - r / 2} width={0.2} height={r} fill={FLOOR} />
        <path d={`M${x} ${at - r / 2} L${x + r} ${at - r / 2} A${r} ${r} 0 0 1 ${x} ${at + r / 2}`} fill="none" stroke="#94a3b8" strokeWidth={0.03} />
        <text x={x - 0.3} y={at} transform={`rotate(-90 ${x - 0.3} ${at})`} textAnchor="middle" className="fill-slate-600" fontSize={0.26} fontWeight={700}>{label.toUpperCase()}</text>
      </g>
    );
  }
  const y = wall === 'front' ? -d / 2 : d / 2;
  const s = wall === 'front' ? 1 : -1; // direction into the room
  return (
    <g>
      <rect x={at - r / 2} y={y - 0.1} width={r} height={0.2} fill={FLOOR} />
      <path d={`M${at - r / 2} ${y} L${at - r / 2} ${y + s * r} A${r} ${r} 0 0 ${s > 0 ? 0 : 1} ${at + r / 2} ${y}`} fill="none" stroke="#94a3b8" strokeWidth={0.03} />
      <text x={at} y={y - s * 0.3} dominantBaseline="middle" textAnchor="middle" className="fill-slate-600" fontSize={0.26} fontWeight={700}>→ {label.toUpperCase()}</text>
    </g>
  );
}

// 2D floor plan: a to-scale top-down drawing of the room (same positions as the 3D view),
// used when WebGL is unavailable or the viewer picks "Floor plan". Front (whiteboard) at the top.
export default function SeatGrid({ lab, pcs, selectedId, onSelect, onReady }: SceneProps) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  const { w, d } = roomSize(lab);
  const pad = 0.75;
  const front = -d / 2;
  const spines = LAYOUTS[lab.id]?.island ? islandSpines(lab, pcs) : [];
  const counts = Object.fromEntries(STATUSES.map((s) => [s, pcs.filter((p) => p.shown === s).length]));

  return (
    <div className="flex min-h-full w-full items-center justify-center">
      <figure className="w-full max-w-5xl rounded-2xl bg-panel p-3 shadow-lg ring-1 ring-line/60 sm:p-5">
        <svg viewBox={`${-w / 2 - pad} ${-d / 2 - pad} ${w + pad * 2} ${d + pad * 2}`} role="group" aria-label={`${lab.name} floor plan`}
          className="mx-auto block h-auto max-h-[calc(100vh-17rem)] w-full select-none">
          <defs>
            <pattern id="fp-tiles" width={0.6} height={0.6} patternUnits="userSpaceOnUse">
              <rect width={0.6} height={0.6} fill={FLOOR} />
              <path d="M0.6 0H0V0.6" fill="none" stroke="#dfe4ea" strokeWidth={0.02} />
            </pattern>
          </defs>

          {/* Floor, walls and windows */}
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="url(#fp-tiles)" />
          <rect x={-w / 2} y={-d / 2} width={w} height={d} fill="none" stroke={WALL} strokeWidth={0.16} strokeLinejoin="round" />
          {[-1, 1].map((side) => (
            <line key={side} x1={(side * w) / 2} y1={front + 1.2} x2={(side * w) / 2} y2={d / 2 - 0.4}
              stroke="#93c5fd" strokeWidth={0.07} strokeDasharray="1.6 0.25" />
          ))}

          {/* Whiteboard and teacher's desk */}
          <rect x={-1.75} y={front + 0.06} width={3.5} height={0.1} rx={0.03} fill="#64748b" />
          <text x={0} y={front + 0.42} textAnchor="middle" className="fill-slate-500" fontSize={0.2} fontWeight={700} letterSpacing={0.04}>WHITEBOARD</text>
          <rect x={-0.75} y={front + 1.05} width={1.5} height={0.7} rx={0.06} fill={WOOD} stroke="#b88b5a" strokeWidth={0.03} />
          <text x={0} y={front + 1.45} textAnchor="middle" dominantBaseline="middle" className="fill-amber-950" fontSize={0.2} fontWeight={600}>Teacher</text>

          {labDoors(lab).map((door) => <Door key={door.label} {...door} w={w} d={d} />)}

          {/* Island dividers */}
          {spines.map((s) => <rect key={s.x} x={s.x - 0.05} y={s.z0} width={0.1} height={s.z1 - s.z0} rx={0.03} fill="#cbd5e1" />)}

          {/* Workstations: desk, monitor in the status colour, chair (with a student when in use) */}
          {pcs.map((pc) => {
            const { pos, rot } = seatPlacement(lab, pc.row, pc.col);
            const [x, , z] = pos;
            const color = STATUS_COLOR[pc.shown];
            const sel = pc.id === selectedId;
            return (
              <g key={pc.id} role="button" tabIndex={0} aria-pressed={sel} aria-label={`${pc.label}, ${STATUS_LABEL[pc.shown]}`}
                onClick={() => onSelect(pc.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(pc.id))}
                className="group cursor-pointer outline-none">
                <title>{`${pc.label} · ${STATUS_LABEL[pc.shown]}`}</title>
                <g transform={`translate(${x} ${z}) rotate(${(-rot * 180) / Math.PI})`}>
                  {sel && <rect x={-0.66} y={-0.48} width={1.32} height={1.42} rx={0.14} fill="none" stroke="#1f5fbf" strokeWidth={0.07} />}
                  <rect x={-0.55} y={-0.36} width={1.1} height={0.68} rx={0.05} fill={WOOD} stroke={sel ? '#1f5fbf' : '#b88b5a'} strokeWidth={0.03}
                    className="transition-[filter] group-hover:brightness-95 group-focus-visible:brightness-90" />
                  <rect x={-0.32} y={-0.27} width={0.64} height={0.09} rx={0.03} fill={color} />
                  {pc.shown === 'broken' && <path d="M-0.12 -0.3 L0.12 -0.15 M0.12 -0.3 L-0.12 -0.15" stroke="#7f1d1d" strokeWidth={0.03} />}
                  <circle cx={0} cy={0.62} r={0.21} fill="#e4e4e7" stroke="#71717a" strokeWidth={0.03} />
                  {pc.shown === 'in_use' && <circle cx={0} cy={0.6} r={0.13} fill="#2b1d14" />}
                </g>
                <text x={x} y={z - 0.02} textAnchor="middle" dominantBaseline="middle" fontSize={0.19} fontWeight={700} className="pointer-events-none fill-amber-950">
                  {pc.label.replace('PC-', '')}
                </text>
              </g>
            );
          })}
        </svg>

        <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-line pt-3 text-xs text-muted">
          {STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-full" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]} <b className="text-ink">{counts[s]}</b>
            </span>
          ))}
          <span className="hidden h-3 w-px bg-line sm:block" />
          <span className="flex items-center gap-1.5"><span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-zinc-200 ring-1 ring-zinc-500"><span className="h-2 w-2 rounded-full bg-[#2b1d14]" /></span>Student seated</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-5 rounded-full bg-blue-300" />Windows</span>
          <span>Click a desk for details</span>
        </figcaption>
      </figure>
    </div>
  );
}
