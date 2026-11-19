import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  CircleHelp,
  Grid3x3,
  MousePointerClick,
  Move3d,
  RotateCcw,
  Wrench,
  X,
  ZoomIn,
} from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { useLabLive } from '../hooks/useLabLive';
import { useLoad } from '../../../shared/hooks/useLoad';
import { bookingsRepo } from '../../bookings/data/repository';
import { labsRepo } from '../data/repository';
import { peopleRepo } from '../../people/data/repository';
import { scheduleRepo } from '../../schedule/data/repository';
import { manilaNow } from '../../../shared/time';
import { classesOn } from '../../schedule/logic/rules';
import PcPanel from './PcPanel';
import SeatGrid from './SeatGrid';
import SceneBoundary from './SceneBoundary';
import { Alert, Button, Led, Modal, STATUS_LABEL, STATUSES, askConfirm, useExclusive, toast } from '../../../shared/ui/ui';
import type { SimMode } from './LabCharacters3D';
import type { Student } from '../../../shared/data/types';
import { effectiveStatuses } from '../logic/status';
import { studentsInSection } from '../../people/logic/rules';

const LabScene = lazy(() => import('./LabScene'));

const hasWebGL = (() => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
})();

function labDisplayName(name?: string, id?: string) {
  if (id === 'lab1' || name?.includes('1')) return 'Computer Laboratory 1';
  if (id === 'lab2' || name?.includes('2')) return 'Computer Laboratory 2';
  if (id === 'netlab' || name?.toLowerCase().includes('netlab') || name?.toLowerCase().includes('networking')) return 'Networking Laboratory';
  return name ?? '';
}

const labShortName = (name?: string, id?: string) =>
  ({ 'Computer Laboratory 1': 'ComLab 1', 'Computer Laboratory 2': 'ComLab 2', 'Networking Laboratory': 'NetLab' } as Record<string, string>)[labDisplayName(name, id)] ?? name ?? '';

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
  const labs = useLoad(() => labsRepo.listLabs());
  const lab = labs.data?.find((l) => l.id === labId) ?? labs.data?.[0];
  const { pcs, error } = useLabLive(lab?.id ?? '__none__');
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get('pc'));
  const [maintBusy, setMaintBusy] = useState(false);
  const [maintError, setMaintError] = useState<string | null>(null);
  // links from notifications: /labs/lab1?pc=<id> opens that PC's card
  useEffect(() => {
    const pc = params.get('pc');
    if (!pc) return;
    setSelectedId(pc);
    setParams((p) => { p.delete('pc'); return p; }, { replace: true });
  }, [params, setParams]);
  const [mode, setMode] = useState<'3d' | '2d'>('2d'); // floor plan by default; 3D is one click away
  const [sceneReady, setSceneReady] = useState(false);
  const select = (id: string) => { setSelectedId(id || null); setStudentPick(null); };
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Realtime Laboratory Schedule & Classroom Monitoring
  const schedules = useLoad(() => scheduleRepo.listSchedules());
  const students = useLoad(() => peopleRepo.listStudents().catch(() => [] as Student[])); // teachers can't read students; avatars stay anonymous
  const [studentPick, setStudentPick] = useState<{ s: Student; pcId: string } | null>(null);

  const today = manilaNow();
  // class meetings that really happen in this lab today: one-day changes apply (cancelled / activity only
  // are left out, a moved meeting counts at its new time and lab)
  useEffect(() => bookingsRepo.subscribeReservations(schedules.reload), [schedules.reload]);
  const labSchedules = useMemo(() => {
    if (!schedules.data || !lab) return [];
    return classesOn(today.date, schedules.data)
      .filter((m) => m.lab_id === lab.id)
      .map((m) => ({ ...schedules.data!.find((s) => s.id === m.schedule_id)!, lab_id: m.lab_id, start_time: m.start_time, end_time: m.end_time }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [schedules.data, lab?.id, today.date]);

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

  const effectiveSimMode = liveSimMode;

  // Realtime position inside the arrival window (10 min before class) or dismissal window (last 5 min),
  // so opening the page mid-way shows exactly who has already arrived / left.
  const phase = effectiveSimMode === 'walk_in' && upcomingClassSchedule
    ? { start: toMin(upcomingClassSchedule.start_time) - 10, length: 600 }
    : effectiveSimMode === 'walk_out' && activeClassSchedule
      ? { start: toMin(activeClassSchedule.end_time) - 5, length: 300 }
      : null;
  const phaseOffset = phase ? Math.max(0, (nowMin - phase.start) * 60 + new Date().getSeconds()) : 0;

  // Enrolled students of the class in this lab, e.g. "BSIT 1A" → BSIT · 1st Year · section A.
  const classSection = (activeClassSchedule ?? upcomingClassSchedule)?.section ?? null;
  const classStudents = useMemo(() => {
    const list = studentsInSection(students.data ?? [], classSection);
    return list.length ? list : undefined;
  }, [classSection, students.data]);
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
  // Students checked in by QR count as using their PC; refreshed every 30 s.
  const checkIns = useLoad(() => (lab ? labsRepo.listCheckIns(lab.id).catch(() => []) : Promise.resolve([])), [lab?.id]);
  useEffect(() => { const t = setInterval(checkIns.reload, 30_000); return () => clearInterval(t); }, [checkIns.reload]);
  const checkedIn = useMemo(() => new Set((checkIns.data ?? []).map((c) => c.pc_id)), [checkIns.data]);

  // Approved single-PC bookings still to come (later today or any later day): "booked later" markers.
  const approvedAll = useLoad(() => bookingsRepo.listReservations({ status: 'approved' }), [lab?.id]);
  useEffect(() => bookingsRepo.subscribeReservations(approvedAll.reload), [approvedAll.reload]);
  const bookedLater = useMemo(() => {
    const now = manilaNow();
    return new Set((approvedAll.data ?? []).filter((r) => r.pc_id && r.lab_id === lab?.id
      && (r.date > now.date || (r.date === now.date && now.time < r.start_time))).map((r) => r.pc_id!));
  }, [approvedAll.data, lab?.id]);

  // One rule for every view (see effectiveStatuses): a PC is In use only when someone sits at it.
  const displayedPcs = useMemo(
    () => effectiveStatuses(pcs, effectiveSimMode, classStudents?.length ?? null, checkedIn),
    [pcs, effectiveSimMode, classStudents, checkedIn],
  );

  // keep showing the PC while the live list briefly reloads (otherwise the card would close after an action)
  const lastSelected = useRef<(typeof displayedPcs)[number] | undefined>(undefined);
  const selected = displayedPcs.find((p) => p.id === selectedId) ?? (lastSelected.current?.id === selectedId ? lastSelected.current : undefined);
  lastSelected.current = selected;
  useExclusive(!!selected, () => setSelectedId(null));
  useExclusive(!!studentPick, () => setStudentPick(null));
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
    const safety = setTimeout(() => setSceneReady(true), 6000); // last resort only; normally the scene reports ready once settled
    return () => clearTimeout(safety);
  }, [lab?.id, mode]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#dfe5ee]">
      {/* Centered SMCBI Loading Animation Overlay */}
      <LabLoadingOverlay labName={lab?.name} ready={sceneReady} />

      {/* Top toolbar: lab + view switcher, then live class status, PC counts and simulation controls */}
      <div className="absolute left-[3.75rem] md:left-[var(--labs-left,1rem)] top-4 z-20 flex max-w-[calc(100%-5rem)] flex-col items-start gap-2 transition-[left] duration-200 md:max-w-[calc(100%-var(--labs-left,1rem)-5rem)]">
        <div className="flex max-w-[calc(100vw-9.5rem)] flex-wrap items-center gap-1 rounded-2xl bg-slate-900/80 sm:max-w-none p-1 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md">
          <nav className="flex min-w-0 max-w-full gap-1 overflow-x-auto" aria-label="Choose lab">
            {labs.data?.map((l) => (
              <NavLink key={l.id} to={`/labs/${l.id}`} onClick={() => setSelectedId(null)}
                title={labDisplayName(l.name, l.id)}
                className={() => `shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all sm:px-3.5 ${l.id === lab?.id ? 'bg-white text-slate-900 shadow' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                {labShortName(l.name, l.id)}
              </NavLink>
            ))}
          </nav>
          <div className="mx-1 h-5 w-px bg-white/20" />
          <div className="flex gap-1" role="group" aria-label="View">
            {([['3d', Box, '3D'], ['2d', Grid3x3, 'Floor plan']] as const).map(([m, Icon, label]) => (
              <button key={m} onClick={() => setMode(m)} disabled={m === '3d' && !hasWebGL} aria-pressed={mode === m}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 ${mode === m ? 'bg-accent text-white shadow' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line/60 bg-panel/95 px-3 py-2 shadow-lg backdrop-blur-md">
          {/* Class status */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              {(upcomingClassSchedule || isClassInSession) && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${upcomingClassSchedule ? 'bg-amber-400' : 'bg-blue-400'}`} />
              )}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${upcomingClassSchedule ? 'bg-amber-500' : isClassInSession ? 'bg-blue-500' : 'bg-emerald-500'}`} />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                {upcomingClassSchedule ? `Students arriving · starts ${upcomingClassSchedule.start_time}` : isClassInSession ? 'Class in session' : 'Available'}
              </p>
              <p className="truncate text-xs font-semibold text-ink">
                {upcomingClassSchedule
                  ? `${upcomingClassSchedule.section} · ${upcomingClassSchedule.subject}`
                  : isClassInSession
                    ? (activeClassDetails ? `${activeClassDetails.section} · ${activeClassDetails.subject}` : 'Laboratory in use')
                    : 'No active class scheduled'}
                {(upcomingClassSchedule ?? activeClassDetails)?.instructor && (
                  <span className="font-normal text-muted"> — {(upcomingClassSchedule ?? activeClassDetails)?.instructor}</span>
                )}
              </p>
            </div>
          </div>

          <div className="hidden h-7 w-px bg-line sm:block" />

          {/* Live workstation counts */}
          <ul className="flex flex-wrap items-center gap-1.5 text-xs">
            {STATUSES.map((s) => (
              <li key={s} title={STATUS_LABEL[s]} className="flex items-center gap-1.5 rounded-full bg-chalk px-2.5 py-1 font-medium text-muted">
                <Led status={s} />
                <span className="hidden md:inline">{STATUS_LABEL[s]}</span>
                <b className="font-semibold text-ink">{counts[s]}</b>
              </li>
            ))}
          </ul>

          <div className="hidden h-7 w-px bg-line sm:block" />

          {/* 3D Controls Guide (+ whole-lab maintenance for admin/staff) */}
          <div className="flex flex-wrap items-center gap-1">
            {(profile?.role === 'admin' || profile?.role === 'staff') && lab && (() => {
              const inMaint = pcs.filter((p) => p.status === 'maintenance');
              const on = inMaint.length > 0;
              const toggle = () => askConfirm(on
                ? { title: `End maintenance in ${lab.name}?`, message: `${inMaint.length} PCs go back to Free and can be used again.`, confirmLabel: 'End maintenance' }
                : { title: `Put ${lab.name} under maintenance?`, message: 'Every PC (except broken ones) is set to Maintenance, so nobody can use or book it until you end maintenance.', confirmLabel: 'Start maintenance' })
                .then(async (ok) => {
                  if (!ok) return;
                  setMaintBusy(true); setMaintError(null);
                  try {
                    await Promise.all(on
                      ? inMaint.map((p) => labsRepo.setPcStatus(p.id, 'free', null))
                      : pcs.filter((p) => p.status !== 'broken' && p.status !== 'maintenance').map((p) => labsRepo.setPcStatus(p.id, 'maintenance', 'Lab maintenance')));
                    toast(on ? 'Maintenance ended' : 'Lab under maintenance', on ? `${lab.name}: PCs are back to Free` : `${lab.name}: PCs can't be used or booked`);
                  } catch (e) { setMaintError((e as Error).message); } finally { setMaintBusy(false); }
                });
              return (
                <button onClick={toggle} disabled={maintBusy} aria-pressed={on}
                  title={on ? 'Put every PC in this lab back to Free' : 'Set every PC in this lab to Maintenance'}
                  className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-60 ${
                    on ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100'}`}>
                  <Wrench size={14} />{maintBusy ? 'Updating…' : on ? `End maintenance (${inMaint.length})` : 'Lab maintenance'}
                </button>
              );
            })()}
            <button
              onClick={() => setShowGuideModal(true)}
              aria-label="3D Controls Guide"
              title="Open 3D Navigation & Controls Guide"
              className="flex items-center gap-1.5 rounded-xl border border-line/80 bg-chalk/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm transition-all hover:bg-chalk hover:text-accent active:scale-95"
            >
              <CircleHelp size={14} className="text-accent" />
              <span>3D Controls Guide</span>
            </button>
          </div>
        </div>
      </div>

      {maintError && <div className="absolute left-1/2 top-40 z-30 w-[min(90vw,28rem)] -translate-x-1/2"><Alert>{maintError}</Alert></div>}
      {(error || labs.error) && (
        <div className="absolute left-[3.75rem] md:left-[var(--labs-left,1rem)] top-36 z-20 max-w-md">
          <Alert>{error || labs.error}</Alert>
        </div>
      )}

      {/* 3D Scene / 2D SeatGrid filling 100% of the screen with smooth fade-in reveal */}
      <div className={`h-full w-full transition-opacity duration-500 ease-out ${sceneReady ? 'opacity-100' : 'opacity-0'}`}>
        {lab && (mode === '3d'
          ? <SceneBoundary onError={() => setMode('2d')} fallback={<SeatGrid lab={lab} pcs={displayedPcs} selectedId={selectedId} onSelect={select} onReady={() => setSceneReady(true)} isOccupied={isClassInSession} classInfo={activeClassSchedule} simMode={effectiveSimMode} teacherName={teacherName} />}>
              <Suspense fallback={<LabLoadingOverlay labName={lab.name} ready={false} />}>
                <LabScene
                  key={lab.id}
                  lab={lab}
                  pcs={displayedPcs}
                  selectedId={selectedId}
                  onSelect={select}
                  onReady={() => setSceneReady(true)}
                  isOccupied={isClassInSession}
                  simMode={effectiveSimMode}
                  teacherName={teacherName}
                  phaseOffset={phaseOffset}
                  phaseLength={phase?.length}
                  students={classStudents}
                  onStudentSelect={(s, pcId) => { setSelectedId(null); setStudentPick({ s, pcId }); }}
                />
              </Suspense>
            </SceneBoundary>
          : <div className="h-full w-full overflow-auto px-3 pb-8 pt-44 sm:p-6 sm:pt-36 md:pl-[calc(var(--labs-left,1rem)+1rem)]"><SeatGrid lab={lab} pcs={displayedPcs} selectedId={selectedId} onSelect={select} onReady={() => setSceneReady(true)} isOccupied={isClassInSession} classInfo={activeClassSchedule} simMode={effectiveSimMode} teacherName={teacherName} bookedLater={bookedLater} /></div>)}
      </div>



      {/* Student card when an avatar is clicked */}
      {studentPick && !selected && (
        <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto rounded-t-2xl border border-line bg-panel shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:z-30 sm:w-80 sm:max-h-[calc(100%-6rem)] sm:rounded-2xl sm:bg-panel/95 sm:backdrop-blur p-4">
          <div className="mx-auto -mt-1 mb-3 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">
                {studentPick.s.full_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{studentPick.s.full_name}</p>
                <p className="font-cond text-sm text-muted">{studentPick.s.student_id}</p>
              </div>
            </div>
            <button onClick={() => setStudentPick(null)} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-chalk hover:text-ink"><X size={16} /></button>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
            {([
              ['Course', studentPick.s.course],
              ['Year', studentPick.s.year_level],
              ['Section', studentPick.s.section],
              ['Sex', studentPick.s.sex ?? '—'],
              ['Status', studentPick.s.status ?? 'Enrolled'],
              ['Seat', displayedPcs.find((p) => p.id === studentPick.pcId)?.label ?? studentPick.pcId],
            ] as const).map(([k, v]) => (
              <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt><dd className="font-medium text-ink">{v}</dd></div>
            ))}
            <div className="col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Email</dt><dd className="truncate font-medium text-ink">{studentPick.s.email}</dd></div>
          </dl>
        </aside>
      )}

      {/* Floating PC inspection drawer in top-right when a workstation is selected */}
      {selected && lab && (
        <aside className="fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto rounded-t-2xl border border-line bg-panel shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-20 sm:z-30 sm:w-80 sm:max-h-[calc(100%-6rem)] sm:rounded-2xl sm:bg-panel/95 sm:backdrop-blur">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          <PcPanel pc={selected} lab={lab} canEdit={profile?.role === 'admin' || profile?.role === 'staff'} onClose={() => setSelectedId(null)} />
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
