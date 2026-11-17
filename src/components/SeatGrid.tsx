import { useEffect } from 'react';
import type { LivePc } from '../hooks/useLabLive';
import type { ClassSchedule, Lab } from '../lib/types';
import { Led, STATUS_LABEL } from './ui';

export interface SceneProps {
  lab: Lab;
  pcs: LivePc[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReady?: () => void;
  simulationMode?: 'in_session' | 'entering' | 'exiting' | 'empty';
  classInfo?: ClassSchedule | null;
}

// 2D floor plan: used when WebGL is unavailable or the viewer prefers it.
export default function SeatGrid({ lab, pcs, selectedId, onSelect, onReady }: SceneProps) {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return (
    <div className="grid h-full place-items-center overflow-auto p-4">
      <div className="w-full max-w-2xl">
        <div className="mx-auto mb-6 h-2 w-2/3 rounded-full bg-slate-300" title="Whiteboard" />
        <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${lab.cols}, minmax(0, 1fr))` }}>
          {pcs.map((pc) => (
            <button key={pc.id} onClick={() => onSelect(pc.id)} aria-label={`${pc.label}, ${STATUS_LABEL[pc.shown]}`}
              aria-pressed={pc.id === selectedId}
              style={{ gridRow: pc.row + 1, gridColumn: pc.col + 1 }}
              className={`flex flex-col items-center gap-1.5 rounded-md border bg-panel px-1 py-2 text-xs font-medium transition-colors hover:border-accent ${
                pc.id === selectedId ? 'border-accent ring-2 ring-accent/30' : 'border-line'}`}>
              <Led status={pc.shown} />
              <span className="font-cond">{pc.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
