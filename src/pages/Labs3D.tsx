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
import { Alert, Led, PageHeader, STATUS_LABEL, STATUSES } from '../components/ui';

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
    <>
      <PageHeader title="Labs" sub="Live status of every PC. Click a PC to see details." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1" aria-label="Choose lab">
          {labs.data?.map((l) => (
            <NavLink key={l.id} to={`/labs/${l.id}`} onClick={() => setSelectedId(null)}
              className={() => `rounded-md px-3 py-1.5 text-sm font-medium ${l.id === lab?.id ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
              {l.name.replace('Computer Laboratory', 'Lab')}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex rounded-lg border border-line bg-panel p-1" role="group" aria-label="View">
          <button onClick={() => setMode('3d')} disabled={!hasWebGL} aria-pressed={mode === '3d'}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${mode === '3d' ? 'bg-chalk font-medium' : 'text-muted'} disabled:opacity-40`}>
            <Box size={16} />3D</button>
          <button onClick={() => setMode('2d')} aria-pressed={mode === '2d'}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${mode === '2d' ? 'bg-chalk font-medium' : 'text-muted'}`}>
            <Grid3x3 size={16} />Floor plan</button>
        </div>
      </div>

      {(error || labs.error) && <div className="mb-4"><Alert>{error || labs.error}</Alert></div>}

      <div className="relative flex-1 h-[calc(100vh-10.5rem)] min-h-[560px] w-full overflow-hidden rounded-2xl border border-line bg-[#dfe5ee] shadow-sm">
        {lab && (mode === '3d'
          ? <SceneBoundary onError={() => setMode('2d')} fallback={<SeatGrid lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} />}>
              <Suspense fallback={<p className="p-6 text-sm text-muted">Loading 3D view…</p>}>
                <LabScene lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} />
              </Suspense>
            </SceneBoundary>
          : <div className="h-full w-full overflow-auto p-4"><SeatGrid lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} /></div>)}

        {/* Status bar pills in bottom-left */}
        <ul className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-line/60 bg-panel/90 px-3.5 py-2 text-xs shadow-md backdrop-blur">
          {STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-1.5 font-medium"><Led status={s} />{STATUS_LABEL[s]} <b className="font-semibold text-ink">{counts[s]}</b></li>
          ))}
        </ul>

        {/* Interaction hints in bottom-right (hidden on small screens if selected panel is active) */}
        {!selected && (
          <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-2 rounded-xl border border-line/60 bg-panel/90 px-3.5 py-2 text-xs text-muted shadow-md backdrop-blur">
            <span>🖱️ Drag to rotate · Scroll to zoom · Click PC to inspect</span>
          </div>
        )}

        {/* Floating PC inspection drawer in top-right when a workstation is selected */}
        {selected && lab && (
          <aside className="absolute right-4 top-4 z-30 w-80 max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-line bg-panel/95 shadow-2xl backdrop-blur transition-all">
            <PcPanel pc={selected} lab={lab} canEdit={profile?.role !== 'teacher'} onClose={() => setSelectedId(null)} />
          </aside>
        )}
      </div>
    </>
  );
}
