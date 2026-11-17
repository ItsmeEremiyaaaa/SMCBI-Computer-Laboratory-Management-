import { lazy, Suspense, useEffect, useState } from 'react';
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

// Centered SMCBI Loading Animation with pulsing glow, rotating ring and smooth reveal
function LabLoadingOverlay({ labName, ready }: { labName?: string; ready: boolean }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (ready) {
      const timer = setTimeout(() => setVisible(false), 550);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [ready]);

  if (!visible && ready) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#dfe5ee] transition-all duration-500 ease-out ${
        ready ? 'pointer-events-none opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      aria-label="Loading 3D Laboratory"
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Animated Glow Rings & Orbit around the centered SMCBI Seal */}
        <div className="relative flex items-center justify-center">
          <span className="absolute h-28 w-28 rounded-full bg-accent/25 animate-ping duration-1000 opacity-60" />
          <div className="absolute h-24 w-24 rounded-full border-2 border-accent/20 border-t-accent animate-spin duration-1000" />
          {/* Centered SMCBI Logo */}
          <div className="relative grid h-20 w-20 place-items-center rounded-full bg-white p-1 shadow-2xl ring-4 ring-white/90">
            <img
              src="/smcbi-seal.webp"
              width={68}
              height={68}
              alt="SMCBI Logo"
              className="rounded-full select-none"
            />
          </div>
        </div>

        {/* Institution and Loading Status Text */}
        <div className="mt-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">St. Mary's College of Bansalan</p>
          <h2 className="mt-1 font-cond text-2xl font-bold tracking-tight text-ink">
            {labName ? labName.replace('Computer Laboratory', 'ComLab') : 'Loading Laboratory'}
          </h2>
          <p className="mt-1.5 flex items-center justify-center gap-2 text-xs text-muted">
            <span>Rendering 3D Environment</span>
            <span className="inline-flex gap-1">
              <span className="h-1 w-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1 w-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1 w-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </p>
        </div>

        {/* Subtle Progress Bar */}
        <div className="mt-4 h-1 w-44 overflow-hidden rounded-full bg-accent-soft">
          <div className="h-full w-full rounded-full bg-accent animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function Labs3D() {
  const { profile } = useAuth();
  const { labId } = useParams();
  const labs = useLoad(() => api.listLabs());
  const lab = labs.data?.find((l) => l.id === labId) ?? labs.data?.[0];
  const { pcs, error } = useLabLive(lab?.id ?? '__none__');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'3d' | '2d'>(hasWebGL ? '3d' : '2d');
  const [sceneReady, setSceneReady] = useState(false);
  const selected = pcs.find((p) => p.id === selectedId);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, pcs.filter((p) => p.shown === s).length]));
  const select = (id: string) => setSelectedId(id || null);

  // Trigger loading screen on lab or view mode change
  useEffect(() => {
    setSceneReady(false);
    // Safety timer: automatically unveil if render takes longer than 2.2s
    const safety = setTimeout(() => setSceneReady(true), 2200);
    return () => clearTimeout(safety);
  }, [lab?.id, mode]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#dfe5ee]">
      {/* Centered SMCBI Loading Animation Overlay */}
      <LabLoadingOverlay labName={lab?.name} ready={sceneReady} />

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

      {/* 3D Scene / 2D SeatGrid filling 100% of the screen with smooth fade-in reveal */}
      <div className={`h-full w-full transition-opacity duration-500 ease-out ${sceneReady ? 'opacity-100' : 'opacity-0'}`}>
        {lab && (mode === '3d'
          ? <SceneBoundary onError={() => setMode('2d')} fallback={<SeatGrid lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} onReady={() => setSceneReady(true)} />}>
              <Suspense fallback={<LabLoadingOverlay labName={lab.name} ready={false} />}>
                <LabScene lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} onReady={() => setSceneReady(true)} />
              </Suspense>
            </SceneBoundary>
          : <div className="h-full w-full overflow-auto p-6 pt-20 pb-24"><SeatGrid lab={lab} pcs={pcs} selectedId={selectedId} onSelect={select} onReady={() => setSceneReady(true)} /></div>)}
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
