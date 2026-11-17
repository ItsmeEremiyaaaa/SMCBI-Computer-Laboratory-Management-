import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  Box,
  Compass,
  Grid3x3,
  MousePointerClick,
  Move3d,
  RotateCcw,
  ZoomIn,
} from 'lucide-react';
import { useAuth } from '../auth';
import { useLabLive } from '../hooks/useLabLive';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import { isoWeekday, manilaNow } from '../lib/seat';
import PcPanel from '../components/PcPanel';
import SeatGrid from '../components/SeatGrid';
import SceneBoundary from '../components/SceneBoundary';
import { Alert, Button, Led, Modal, STATUS_LABEL, STATUSES } from '../components/ui';
import type { SimMode } from '../components/LabCharacters3D';

const LabScene = lazy(() => import('../components/LabScene'));

const hasWebGL = (() => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
})();

function labDisplayName(name?: string, id?: string) {
  if (id === 'lab1' || name?.includes('1')) return 'Computer Laboratory 1';
  if (id === 'lab2' || name?.includes('2')) return 'Computer Laboratory 2';
  if (id === 'netlab' || name?.toLowerCase().includes('netlab') || name?.toLowerCase().includes('networking')) return 'Networking Laboratory';
  return name ?? '';
}

// Centered SMCBI Loading Animation with smooth circular reveal transition matching the web intro
function LabLoadingOverlay({ labName, ready }: { labName?: string; ready: boolean }) {
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready) {
      setVisible(true);
      return;
    }

    const container = containerRef.current;
    const seal = sealRef.current;
    if (!container || typeof container.animate !== 'function') {
      const timer = setTimeout(() => setVisible(false), 600);
      return () => clearTimeout(timer);
    }

    const radius = Math.hypot(window.innerWidth, window.innerHeight);
    const timing = { duration: 950, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: 'forwards' as const };

    const anim = Promise.all([
      container.animate(
        [
          { clipPath: `circle(${radius}px at 50% 50%)` },
          { clipPath: `circle(0px at 50% 50%)` },
        ],
        timing,
      ).finished,
      seal
        ? seal.animate(
            [
              { transform: 'scale(1)', opacity: 1 },
              { transform: 'scale(0.55)', opacity: 0 },
            ],
            timing,
          ).finished
        : Promise.resolve(),
    ]);

    anim.then(() => setVisible(false)).catch(() => setVisible(false));
  }, [ready]);

  if (!visible && ready) return null;

  return (
    <div
      ref={containerRef}
      className="navy-weave fixed inset-0 z-50 flex flex-col items-center justify-center text-white"
      aria-label="Loading 3D Laboratory"
    >
      <div ref={sealRef} className="relative flex flex-col items-center justify-center">
        {/* Animated Glow Rings & Centered SMCBI Seal */}
        <div className="relative flex items-center justify-center">
          <span className="absolute h-36 w-36 rounded-full bg-blue-400/20 animate-ping duration-1000 opacity-50" />
          <div className="relative grid h-24 w-24 place-items-center rounded-full bg-white p-1.5 shadow-[0_0_0_8px_rgba(255,255,255,0.1),0_20px_50px_rgba(0,0,0,0.5)]">
            <img
              src="/smcbi-seal.webp"
              width={82}
              height={82}
              alt="SMCBI Seal"
              className="rounded-full select-none"
            />
          </div>
        </div>

        {/* Institution and Loading Status Text */}
        <div className="mt-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">St. Mary's College of Bansalan</p>
          <h2 className="mt-1 font-cond text-2xl font-bold tracking-tight text-white">
            {labName ? labDisplayName(labName) : 'Loading Laboratory'}
          </h2>
          <p className="mt-2 flex items-center justify-center gap-2 text-xs text-blue-200/80">
            <span>Rendering 3D Environment</span>
            <span className="inline-flex gap-1">
              <span className="h-1 w-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1 w-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1 w-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </p>
        </div>

        {/* Subtle Progress Bar */}
        <div className="mt-4 h-1 w-44 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-full rounded-full bg-blue-300 animate-pulse" />
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
  const select = (id: string) => setSelectedId(id || null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Realtime Laboratory Schedule & Classroom Monitoring
  const schedules = useLoad(() => api.listSchedules());
  const [userSimOverride, setUserSimOverride] = useState<SimMode | null>(null);

  const today = manilaNow();
  const dow = isoWeekday(today.date);
  const labSchedules = useMemo(() => {
    if (!schedules.data || !lab) return [];
    return schedules.data
      .filter((s) => s.lab_id === lab.id && s.starts_on <= today.date && today.date <= s.ends_on && s.day_of_week === dow)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules.data, lab?.id, today.date, dow]);

  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const nowMin = toMin(today.time);

  // Active ongoing class schedule
  const activeClassSchedule = labSchedules.find((s) => toMin(s.start_time) <= nowMin && nowMin < toMin(s.end_time)) ?? null;
  // Upcoming class starting in the next 10 minutes (students arriving / walking in)
  const upcomingClassSchedule = labSchedules.find((s) => toMin(s.start_time) - 10 <= nowMin && nowMin < toMin(s.start_time)) ?? null;

  const activeBooking = pcs.find(
    (p) =>
      p.current &&
      p.current.lab_id === lab?.id &&
      (p.current.purpose === 'Laboratory class' ||
        p.current.purpose === 'Regular class' ||
        p.current.id.startsWith('class-') ||
        p.current.pc_id === null)
  )?.current ?? null;

  // Real-time automatic timetable synchronization:
  // - Upcoming class (10 mins before): students walking in 1-by-1 and 2-by-2
  // - In Session: ALL STUDENTS ARE ALREADY SEATED (does NOT loop or restart on navigation!)
  // - Final 5 mins of class: students dismiss and walk out
  // - No class: lab empty and available
  const liveSimMode: SimMode = useMemo(() => {
    if (upcomingClassSchedule) return 'walk_in';
    if (activeClassSchedule) {
      if (toMin(activeClassSchedule.end_time) - 5 <= nowMin && nowMin < toMin(activeClassSchedule.end_time)) {
        return 'walk_out';
      }
      return 'in_session';
    }
    if (activeBooking) return 'in_session';
    return 'empty';
  }, [upcomingClassSchedule, activeClassSchedule, activeBooking, nowMin]);

  const effectiveSimMode: SimMode = userSimOverride ?? liveSimMode;
  const isClassInSession = effectiveSimMode === 'walk_in' || effectiveSimMode === 'in_session';

  const activeClassDetails = activeClassSchedule
    ? {
        section: activeClassSchedule.section,
        subject: activeClassSchedule.subject,
        instructor: activeClassSchedule.instructor,
      }
    : upcomingClassSchedule
    ? {
        section: upcomingClassSchedule.section,
        subject: upcomingClassSchedule.subject,
        instructor: upcomingClassSchedule.instructor,
      }
    : activeBooking
    ? {
        section: activeBooking.title.split('—')[1]?.trim() || activeBooking.title.split(':')[0]?.trim() || 'Class Session',
        subject: activeBooking.title.split('—')[0]?.trim() || activeBooking.title.split(':')[1]?.trim() || 'Laboratory Class',
        instructor: activeBooking.requester_name,
      }
    : null;

  const teacherName = activeClassDetails?.instructor ?? null;

  // When class is in session, the comlab workstations are actively In Use!
  const displayedPcs = useMemo(() => {
    if (isClassInSession) {
      return pcs.map((p) => (p.shown === 'broken' ? p : { ...p, shown: 'in_use' as const }));
    }
    if (effectiveSimMode === 'empty' || effectiveSimMode === 'walk_out') {
      return pcs.map((p) => (p.shown === 'broken' ? p : { ...p, shown: 'free' as const }));
    }
    return pcs;
  }, [pcs, isClassInSession, effectiveSimMode]);

  const selected = displayedPcs.find((p) => p.id === selectedId);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, displayedPcs.filter((p) => p.shown === s).length]));

  // Awareness modal: automatically display on first visit (persists in localStorage)
  useEffect(() => {
    try {
      if (!localStorage.getItem('comlab-3d-guide-seen')) {
        setShowGuideModal(true);
      }
    } catch { /* private mode */ }
  }, []);

  const dismissGuide = () => {
    try {
      localStorage.setItem('comlab-3d-guide-seen', '1');
    } catch { /* private mode */ }
    setShowGuideModal(false);
  };

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
              {labDisplayName(l.name, l.id)}
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

      {/* Realtime Laboratory Monitoring Pill */}
      <div className="absolute left-4 top-16 z-20 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2.5 rounded-xl border border-line/60 bg-panel/95 px-3 py-1.5 shadow-md backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          {upcomingClassSchedule ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
              <span className="font-semibold text-ink">
                Students Arriving: {upcomingClassSchedule.section} · {upcomingClassSchedule.subject} (Starts {upcomingClassSchedule.start_time})
              </span>
              {upcomingClassSchedule.instructor && (
                <span className="hidden text-muted md:inline">({upcomingClassSchedule.instructor})</span>
              )}
            </>
          ) : isClassInSession ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
              </span>
              <span className="font-semibold text-ink">
                Class in Session: {activeClassDetails ? `${activeClassDetails.section} · ${activeClassDetails.subject}` : 'Laboratory In Use'}
              </span>
              {activeClassDetails?.instructor && (
                <span className="hidden text-muted md:inline">({activeClassDetails.instructor})</span>
              )}
            </>
          ) : (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="font-semibold text-ink">Laboratory Available</span>
              <span className="text-muted text-[11px]">(No active class scheduled)</span>
            </>
          )}
        </div>

        <div className="hidden h-3.5 w-px bg-line sm:block" />

        {/* Quality of Life Animated Simulation Controls */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setUserSimOverride('walk_in')}
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
              effectiveSimMode === 'walk_in' && userSimOverride !== null
                ? 'bg-accent text-white shadow-xs font-semibold'
                : 'text-muted hover:bg-chalk hover:text-ink'
            }`}
            title="Simulate students entering 1 by 1 and 2 by 2 and sitting at workstations"
          >
            <span>🚶</span>
            <span>Simulate Walk In</span>
          </button>

          <button
            onClick={() => setUserSimOverride('in_session')}
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
              effectiveSimMode === 'in_session' && userSimOverride !== null
                ? 'bg-accent text-white shadow-xs font-semibold'
                : 'text-muted hover:bg-chalk hover:text-ink'
            }`}
            title="Simulate active class with all students seated working"
          >
            <span>💻</span>
            <span>Simulate In Session</span>
          </button>

          <button
            onClick={() => setUserSimOverride('walk_out')}
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
              effectiveSimMode === 'walk_out' && userSimOverride !== null
                ? 'bg-accent text-white shadow-xs font-semibold'
                : 'text-muted hover:bg-chalk hover:text-ink'
            }`}
            title="Simulate class dismissal: students leave 1 by 1 and 2 by 2"
          >
            <span>🚪</span>
            <span>Simulate Dismissal</span>
          </button>

          <button
            onClick={() => setUserSimOverride('empty')}
            className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition-all ${
              effectiveSimMode === 'empty' && userSimOverride !== null
                ? 'bg-accent text-white shadow-xs font-semibold'
                : 'text-muted hover:bg-chalk hover:text-ink'
            }`}
            title="Simulate empty laboratory with workstations available"
          >
            <span>🟢</span>
            <span>Empty</span>
          </button>

          {userSimOverride !== null && (
            <button
              onClick={() => setUserSimOverride(null)}
              className="ml-0.5 rounded-lg border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent hover:text-white transition-all shadow-xs"
              title="Reset to real Philippine Manila timetable (auto-syncs students and single teacher)"
            >
              ⏱️ Reset to Realtime
            </button>
          )}
        </div>
      </div>

      {(error || labs.error) && (
        <div className="absolute left-4 top-28 z-20 max-w-md">
          <Alert>{error || labs.error}</Alert>
        </div>
      )}

      {/* 3D Scene / 2D SeatGrid filling 100% of the screen with smooth fade-in reveal */}
      <div className={`h-full w-full transition-opacity duration-500 ease-out ${sceneReady ? 'opacity-100' : 'opacity-0'}`}>
        {lab && (mode === '3d'
          ? <SceneBoundary onError={() => setMode('2d')} fallback={<SeatGrid lab={lab} pcs={displayedPcs} selectedId={selectedId} onSelect={select} onReady={() => setSceneReady(true)} isOccupied={isClassInSession} classInfo={activeClassSchedule} simMode={effectiveSimMode} teacherName={teacherName} />}>
              <Suspense fallback={<LabLoadingOverlay labName={lab.name} ready={false} />}>
                <LabScene
                  key={userSimOverride ? `${lab.id}-${userSimOverride}` : lab.id}
                  lab={lab}
                  pcs={displayedPcs}
                  selectedId={selectedId}
                  onSelect={select}
                  onReady={() => setSceneReady(true)}
                  isOccupied={isClassInSession}
                  simMode={effectiveSimMode}
                  teacherName={teacherName}
                />
              </Suspense>
            </SceneBoundary>
          : <div className="h-full w-full overflow-auto p-6 pt-28 pb-24"><SeatGrid lab={lab} pcs={displayedPcs} selectedId={selectedId} onSelect={select} onReady={() => setSceneReady(true)} isOccupied={isClassInSession} classInfo={activeClassSchedule} simMode={effectiveSimMode} teacherName={teacherName} /></div>)}
      </div>

      {/* Status bar pills in bottom-left (above floating navigation) */}
      <ul className="pointer-events-none absolute bottom-20 left-4 z-20 flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-line/60 bg-panel/90 px-3.5 py-2 text-xs shadow-md backdrop-blur">
        {STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5 font-medium"><Led status={s} />{STATUS_LABEL[s]} <b className="font-semibold text-ink">{counts[s]}</b></li>
        ))}
      </ul>

      {/* 3D Navigation Guide Trigger Button in bottom-right */}
      {!selected && (
        <button
          onClick={() => setShowGuideModal(true)}
          className="absolute bottom-20 right-4 z-20 flex items-center gap-2 rounded-xl border border-line/70 bg-panel/95 px-3.5 py-2 text-xs font-medium text-ink shadow-md backdrop-blur transition-all hover:bg-chalk hover:border-line hover:shadow-lg active:scale-95"
          aria-label="3D Controls Guide"
        >
          <Compass size={15} className="text-accent" />
          <span>3D Controls Guide</span>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-accent-soft text-[10px] font-bold text-accent">?</span>
        </button>
      )}

      {/* Floating PC inspection drawer in top-right when a workstation is selected */}
      {selected && lab && (
        <aside className="absolute right-4 top-16 z-30 w-80 max-w-[calc(100%-2rem)] max-h-[calc(100%-6rem)] overflow-y-auto rounded-2xl border border-line bg-panel/95 shadow-2xl backdrop-blur transition-all">
          <PcPanel pc={selected} lab={lab} canEdit={profile?.role !== 'teacher'} onClose={() => setSelectedId(null)} />
        </aside>
      )}

      {/* 3D Navigation & Controls Awareness Modal */}
      <Modal
        open={showGuideModal}
        title="3D Laboratory Controls & Navigation"
        onClose={dismissGuide}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Explore the SMCBI Computer Laboratory in real-time 3D. Here are the controls to interact with the environment:
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Rotate */}
            <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-chalk/60 p-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
                <Move3d size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Rotate & Orbit</p>
                <p className="mt-0.5 text-xs text-muted leading-relaxed">
                  Click and drag with your mouse (or swipe on touch screens) to rotate and view from any angle.
                </p>
              </div>
            </div>

            {/* Zoom */}
            <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-chalk/60 p-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                <ZoomIn size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Zoom In & Out</p>
                <p className="mt-0.5 text-xs text-muted leading-relaxed">
                  Scroll your mouse wheel (or pinch to zoom on touchpads/mobile) to inspect workstations closer.
                </p>
              </div>
            </div>

            {/* Click PC */}
            <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-chalk/60 p-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700">
                <MousePointerClick size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Inspect Workstation</p>
                <p className="mt-0.5 text-xs text-muted leading-relaxed">
                  Click any PC monitor to view live status, occupant, or report/update broken hardware.
                </p>
              </div>
            </div>

            {/* Reset / Floor Pan */}
            <div className="flex items-start gap-3 rounded-xl border border-line/60 bg-chalk/60 p-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple-100 text-purple-700">
                <RotateCcw size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Floor Click & Pan</p>
                <p className="mt-0.5 text-xs text-muted leading-relaxed">
                  Click anywhere on the open floor to clear the selected workstation. Right-click drag to pan the camera.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span className="text-xs text-muted">You can reopen this anytime using the 3D Controls button.</span>
            <Button variant="primary" onClick={dismissGuide}>
              Got it, let's explore
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
