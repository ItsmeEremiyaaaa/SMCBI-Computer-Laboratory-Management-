import { lazy, Suspense, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Box, Grid3x3 } from 'lucide-react';
import { useAuth } from '../auth';
import { useLabLive } from '../hooks/useLabLive';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import PcPanel from '../components/PcPanel';
import SeatGrid from '../components/SeatGrid';
import SceneBoundary from '../components/SceneBoundary';
import { Alert, Led, STATUS_LABEL, STATUSES } from '../components/ui';

const LabScene = lazy(() => import('../components/LabScene'));

const hasWebGL = (() => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
})();

export default function Labs3D() {
  const { profile } = useAuth();
  const { labId } = useParams();
  const labs = useLoad(() => api.listLabs());
  const lab = labs.data?.find((l) => l.id === labId) ?? labs.data?.[0];
  const { pcs, error } = useLabLive(lab?.id ?? '__none__');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'3d' | '2d'>(hasWebGL ? '3d' : '2d');
  const selected = pcs.find((p) => p.id === selectedId);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, pcs.filter((p) => p.shown === s).length]));
  const select = (id: string) => setSelectedId(id || null);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#dfe5ee]">
      {/* Floating top-left Lab Switcher & View Mode */}
      <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-line/60 bg-panel/90 p-1 shadow-md backdrop-blur">
        <nav className="flex flex-wrap gap-1" aria-label="Choose lab">
          {labs.data?.map((l) => (
            <NavLink key={l.id} to={`/labs/${l.id}`} onClick={() => setSelectedId(null)}
              className={() => `rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${l.id === lab?.id ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'}`}>
              {l.name.replace('Computer Laboratory', 'Lab')}
            </NavLink>
          ))}
        </nav>
        <div className="h-4 w-px bg-line" />
        <div className="flex gap-1" role="group" aria-label="View">
          <button onClick={() => setMode('3d')} disabled={!hasWebGL} aria-pressed={mode === '3d'}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${mode === '3d' ? 'bg-chalk text-ink font-semibold shadow-xs' : 'text-muted hover:text-ink'} disabled:opacity-40`}>
            <Box size={14} />3D</button>
          <button onClick={() => setMode('2d')} aria-pressed={mode === '2d'}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${mode === '2d' ? 'bg-chalk text-ink font-semibold shadow-xs' : 'text-muted hover:text-ink'}`}>
            <Grid3x3 size={14} />Floor plan</button>
        </div>
      </div>

      {(error || labs.error) && (
        <div className="absolute left-4 top-16 z-20 max-w-md">
          <Alert>{error || labs.error}</Alert>
        </div>
      )}

      {/* 3D Scene / 2D SeatGrid filling 100% of the screen */}
      <div className="h-full w-full">
        {lab && (mode === '3d'
          ? <SceneBoundary onError={() => setMode('2d')} fallback={<SeatGrid lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} />}>
              <Suspense fallback={<p className="p-6 text-sm text-muted">Loading 3D view…</p>}>
                <LabScene lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} />
              </Suspense>
            </SceneBoundary>
          : <div className="h-full w-full overflow-auto p-6 pt-20 pb-24"><SeatGrid lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} /></div>)}
      </div>

      {/* Status bar pills in bottom-left (above floating navigation) */}
      <ul className="pointer-events-none absolute bottom-20 left-4 z-20 flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-line/60 bg-panel/90 px-3.5 py-2 text-xs shadow-md backdrop-blur">
        {STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5 font-medium"><Led status={s} />{STATUS_LABEL[s]} <b className="font-semibold text-ink">{counts[s]}</b></li>
        ))}
      </ul>

      {/* Interaction hints in bottom-right */}
      {!selected && (
        <div className="pointer-events-none absolute bottom-20 right-4 z-20 hidden sm:flex items-center gap-2 rounded-xl border border-line/60 bg-panel/90 px-3.5 py-2 text-xs text-muted shadow-md backdrop-blur">
          <span>🖱️ Drag to rotate · Scroll to zoom · Click PC to inspect</span>
        </div>
      )}

      {/* Floating PC inspection drawer in top-right when a workstation is selected */}
      {selected && lab && (
        <aside className="absolute right-4 top-16 z-30 w-80 max-w-[calc(100%-2rem)] max-h-[calc(100%-6rem)] overflow-y-auto rounded-2xl border border-line bg-panel/95 shadow-2xl backdrop-blur transition-all">
          <PcPanel pc={selected} lab={lab} canEdit={profile?.role !== 'teacher'} onClose={() => setSelectedId(null)} />
        </aside>
      )}
    </div>
  );
}
