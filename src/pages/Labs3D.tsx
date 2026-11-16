import { lazy, Suspense, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Box, Grid3x3 } from 'lucide-react';
import { useAuth } from '../auth';
import { useLabLive } from '../hooks/useLabLive';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import PcPanel from '../components/PcPanel';
import SeatGrid from '../components/SeatGrid';
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

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="relative h-[62vh] min-h-[380px] overflow-hidden rounded-lg border border-line bg-[#dfe5ee]">
          {lab && (mode === '3d'
            ? <Suspense fallback={<p className="p-6 text-sm text-muted">Loading 3D view…</p>}>
                <LabScene lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} />
              </Suspense>
            : <SeatGrid lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} />)}
          <ul className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-panel/90 px-3 py-2 text-sm shadow-sm backdrop-blur">
            {STATUSES.map((s) => (
              <li key={s} className="flex items-center gap-1.5"><Led status={s} />{STATUS_LABEL[s]} <b className="font-semibold">{counts[s]}</b></li>
            ))}
          </ul>
        </div>

        <aside className="rounded-lg border border-line bg-panel">
          {selected && lab ? (
            <PcPanel pc={selected} lab={lab} canEdit={profile?.role !== 'teacher'} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="p-4 text-sm text-muted">
              <p className="font-medium text-ink">{lab?.name}</p>
              <p className="mt-1">{pcs.length} PCs. Select one to {profile?.role === 'teacher' ? 'see who is using it or reserve it' : 'update its status'}.</p>
              <p className="mt-4">Drag to rotate, scroll or pinch to zoom.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
