import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, ClipboardCheck, Wrench, X } from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { bookingsRepo } from '../../bookings/data/repository';
import { labsRepo } from '../../labs/data/repository';
import { reportsRepo } from '../../reports/data/repository';
import { scheduleRepo } from '../../schedule/data/repository';
import { useCleared } from '../../../shared/hooks/useCleared';
import { sectionIncludes } from '../../people/logic/rules';
import { classesOn } from '../../schedule/logic/rules';
import { manilaNow } from '../../../shared/time';
import { sectionOf } from '../../people/logic/rules';
import { fmtDate, fmtTime, useExclusive } from '../../../shared/ui/ui';

const SEEN_KEY = 'comlab-student-bell-seen';
const LAB_SHORT: Record<string, string> = { lab1: 'ComLab 1', lab2: 'ComLab 2', netlab: 'NetLab' };
const RECENT_DAYS = 14;

type Note = { id: string; at: string; group: 'today' | 'booking' | 'report'; title: string; sub: string; to: string; tone?: 'good' | 'bad' };

const lastSeen = () => { try { return localStorage.getItem(SEEN_KEY) ?? ''; } catch { return ''; } };
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const manilaIso = (date: string, time: string) => `${date}T${time}:00+08:00`;

// Builds a student's notifications from data that already exists (no notifications table):
// decided bookings, handled problem reports, and today's class/booking reminders.
export function studentNotes(input: {
  now: { date: string; time: string }; section: string | null; userId: string;
  bookings: { id: string; title: string; lab_id: string; pc_id: string | null; date: string; start_time: string; end_time: string; status: string; reviewed_at: string | null; admin_notes: string | null; requester_id: string; requester_name?: string; section?: string | null; created_at?: string }[];
  reports: { id: string; pc_id: string; problem: string; resolved_at: string | null; resolution: string | null; user_id: string }[];
  classes: { id: string; title: string; lab_id: string; start_time: string; end_time: string }[];
  pcLabel: (id: string) => string;
  /** PCs currently marked broken (updated_at = when) */
  brokenPcs?: { id: string; updated_at: string }[];
}): Note[] {
  const { now, section, userId, pcLabel } = input;
  const since = new Date(Date.now() - RECENT_DAYS * 864e5).toISOString();
  const t = minutes(now.time);
  const notes: Note[] = [];

  for (const c of input.classes) {
    if (section && !sectionIncludes(c.title.split(':')[0], section)) continue;
    if (!section) continue; // no linked record: we don't know which classes are theirs
    const s = minutes(c.start_time), e = minutes(c.end_time);
    if (t >= e || t < s - 60) continue;
    notes.push({ id: `cls-${c.id}-${now.date}`, at: manilaIso(now.date, c.start_time), group: 'today', to: '/',
      title: `${t >= s ? 'Class now' : 'Class soon'}: ${c.title.split(': ').slice(1).join(': ')}`,
      sub: `${fmtTime(c.start_time)}–${fmtTime(c.end_time)} · ${LAB_SHORT[c.lab_id] ?? c.lab_id} · scan your PC's QR code to check in` });
  }
  for (const r of input.bookings) {
    if (r.requester_id !== userId) continue;
    if (r.status === 'approved' && r.date === now.date && t < minutes(r.end_time)) {
      notes.push({ id: `bk-today-${r.id}`, at: manilaIso(r.date, r.start_time), group: 'today', to: '/',
        title: `Your NetLab booking today: ${r.title}`,
        sub: `${fmtTime(r.start_time)}–${fmtTime(r.end_time)} · ${r.pc_id ? pcLabel(r.pc_id) : LAB_SHORT[r.lab_id]} · check in when you sit down` });
    }
    if ((r.status === 'approved' || r.status === 'rejected' || r.status === 'cancelled') && r.reviewed_at && r.reviewed_at >= since) {
      notes.push({ id: `bk-${r.id}-${r.status}`, at: r.reviewed_at, group: 'booking', to: '/reservations', tone: r.status === 'approved' ? 'good' : 'bad',
        title: `Booking ${r.status}: ${r.title}`,
        sub: `${fmtDate(r.date)}, ${fmtTime(r.start_time)} · ${r.pc_id ? pcLabel(r.pc_id) : LAB_SHORT[r.lab_id]}${r.admin_notes ? ` · “${r.admin_notes}”` : ''}` });
    }
  }
  // a teacher booked a lab for their class
  for (const r of input.bookings) {
    if (!section || !sectionIncludes(r.section, section) || r.requester_id === userId) continue;
    if (r.date < now.date || (r.date === now.date && t >= minutes(r.end_time))) continue;
    const when = `${fmtDate(r.date)}, ${fmtTime(r.start_time)}–${fmtTime(r.end_time)} · ${LAB_SHORT[r.lab_id] ?? r.lab_id}`;
    const who = r.requester_name || 'Your teacher';
    if (r.status === 'approved' && r.date === now.date) {
      notes.push({ id: `sec-today-${r.id}`, at: manilaIso(r.date, r.start_time), group: 'today', to: '/calendar',
        title: `Today: ${r.title}`, sub: `${who} booked ${LAB_SHORT[r.lab_id] ?? r.lab_id} for your class · ${fmtTime(r.start_time)}–${fmtTime(r.end_time)}` });
    } else if (r.status === 'approved') {
      notes.push({ id: `sec-${r.id}-approved`, at: r.reviewed_at ?? r.created_at ?? manilaIso(r.date, r.start_time), group: 'booking', to: '/calendar', tone: 'good',
        title: `${who} booked a lab for your class`, sub: `${r.title} · ${when}` });
    } else if (r.status === 'cancelled') {
      notes.push({ id: `sec-${r.id}-cancelled`, at: r.reviewed_at ?? r.created_at ?? manilaIso(now.date, now.time), group: 'booking', to: '/calendar', tone: 'bad',
        title: `Lab booking for your class was cancelled`, sub: `${r.title} · ${when} · by ${who}${r.admin_notes ? ` · “${r.admin_notes}”` : ''}` });
    } else if (r.status === 'rejected') {
      notes.push({ id: `sec-${r.id}-rejected`, at: r.reviewed_at ?? r.created_at ?? manilaIso(now.date, now.time), group: 'booking', to: '/calendar', tone: 'bad',
        title: `Lab booking for your class was not approved`, sub: `${r.title} · ${when} · by ${who}${r.admin_notes ? ` · “${r.admin_notes}”` : ''}` });
    } else if (r.status === 'pending') {
      notes.push({ id: `sec-${r.id}-pending`, at: r.created_at ?? manilaIso(now.date, now.time), group: 'booking', to: '/calendar',
        title: `${who} requested a lab for your class`, sub: `${r.title} · ${when} · waiting for approval` });
    }
  }
  // a PC they booked broke: tell them before they walk to the lab
  for (const r of input.bookings) {
    const broke = r.pc_id && input.brokenPcs?.find((p) => p.id === r.pc_id);
    if (!broke || r.requester_id !== userId || (r.status !== 'approved' && r.status !== 'pending')) continue;
    if (r.date < now.date || (r.date === now.date && t >= minutes(r.end_time))) continue;
    notes.push({ id: `bk-broken-${r.id}-${broke.updated_at}`, at: broke.updated_at, group: 'booking', to: '/reservations?new=1&lab=netlab', tone: 'bad',
      title: `${pcLabel(r.pc_id!)} you booked is broken`,
      sub: `${r.title} · ${fmtDate(r.date)}, ${fmtTime(r.start_time)}. Tap to book another PC.` });
  }
  for (const r of input.reports) {
    if (r.user_id !== userId || !r.resolved_at || r.resolved_at < since) continue;
    if (r.resolution === 'fixed') {
      notes.push({
        id: `rp-fixed-${r.id}-${r.resolved_at}`,
        at: r.resolved_at,
        group: 'report',
        to: '/',
        tone: 'good',
        title: `Fixed: ${pcLabel(r.pc_id)} is ready to use!`,
        sub: `${r.problem}: The computer has been repaired and is now available for use.`,
      });
    } else {
      notes.push({
        id: `rp-${r.id}`,
        at: r.resolved_at,
        group: 'report',
        to: '/',
        tone: r.resolution === 'broken' ? 'good' : undefined,
        title: `Your report on ${pcLabel(r.pc_id)} was handled`,
        sub: r.resolution === 'broken' ? `${r.problem}: marked broken for repair. Thanks!` : `${r.problem}: checked, no problem found.`,
      });
    }
  }
  return notes.sort((a, b) => b.at.localeCompare(a.at));
}

const GROUPS: { g: Note['group']; title: string; icon: React.ReactNode }[] = [
  { g: 'today', title: 'Today', icon: <CalendarClock size={15} /> },
  { g: 'booking', title: 'Bookings', icon: <ClipboardCheck size={15} /> },
  { g: 'report', title: 'Your problem reports', icon: <Wrench size={15} /> },
];

// A student's notifications, kept live; cleared ones are left out.
function useStudentNotes() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const { cleared, clear } = useCleared(profile?.id);
  const load = useCallback(async () => {
    if (!profile) return;
    const [bookings, reports, schedules, pcs] = await Promise.all([
      bookingsRepo.listReservations().catch(() => []),
      reportsRepo.listReports({ all: true }).catch(() => []),
      scheduleRepo.listSchedules().catch(() => []),
      labsRepo.listPcs().catch(() => []),
    ]);
    const now = manilaNow();
    setNotes(studentNotes({ now, section: sectionOf(profile.department, profile.course), userId: profile.id, bookings, reports,
      classes: classesOn(now.date, schedules), pcLabel: (id) => pcs.find((p) => p.id === id)?.label ?? id,
      brokenPcs: pcs.filter((p) => p.status === 'broken') }));
  }, [profile]);
  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);
  useEffect(() => bookingsRepo.subscribeReservations(() => { load(); }), [load]);
  useEffect(() => labsRepo.subscribePcs(null, () => { load(); }), [load]);
  return { notes: notes.filter((n) => !cleared.has(n.id)), clear };
}

/** The list itself: used in the bell's dropdown and on the Notifications page. */
export function StudentNotesList({ page = false, seen = '', onNavigate }: { page?: boolean; seen?: string; onNavigate?: () => void }) {
  const { notes, clear } = useStudentNotes();
  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <p className="font-semibold">Notifications</p>
        {notes.length > 0 && (
          <button type="button" onClick={() => clear(notes.map((n) => n.id))} className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-chalk hover:text-ink">Clear all</button>
        )}
      </div>
      <div className={page ? '' : 'max-h-[60vh] overflow-y-auto'}>
        {notes.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">Nothing new. Booking decisions and reminders show up here.</p>}
        {GROUPS.map(({ g, title, icon }) => {
          const list = notes.filter((n) => n.group === g);
          return list.length > 0 && (
            <section key={g} className="border-b border-line last:border-b-0">
              <p className="flex items-center gap-2 bg-chalk/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{icon}{title}</p>
              <ul>
                {list.map((n) => (
                  <li key={n.id} className="relative">
                    <Link to={n.to} onClick={onNavigate} className="flex gap-2.5 py-2.5 pl-4 pr-10 hover:bg-chalk">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.at > seen || g === 'today' ? (n.tone === 'bad' ? 'bg-red-500' : n.tone === 'good' ? 'bg-emerald-500' : 'bg-accent') : 'bg-transparent'}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{n.title}</span>
                        <span className="block text-xs text-muted">{n.sub}</span>
                      </span>
                    </Link>
                    <button type="button" onClick={() => clear([n.id])} aria-label={`Clear notification: ${n.title}`} title="Clear"
                      className="absolute right-2 top-2 rounded p-1 text-muted hover:bg-panel hover:text-ink"><X size={14} /></button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {!page && <Link to="/inbox" onClick={onNavigate} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-accent hover:bg-chalk">Open all notifications</Link>}
    </>
  );
}

export default function StudentBell() {
  const [open, setOpen] = useState(false);
  const { notes } = useStudentNotes();
  const [seen, setSeen] = useState(lastSeen);
  useExclusive(open, () => setOpen(false));
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  // reminders for today always count; other items count until the bell is opened
  const unread = notes.filter((n) => n.group === 'today' || n.at > seen).length;
  function toggle() {
    if (!open) {
      const t = new Date().toISOString();
      try { localStorage.setItem(SEEN_KEY, t); } catch { /* private mode */ }
      setTimeout(() => setSeen(t), 1500); // keep "new" dots visible while the panel opens
    }
    setOpen(!open);
  }

  return (
    <div ref={box} className="pointer-events-auto relative">
      <button onClick={toggle} aria-expanded={open} aria-label={`Notifications, ${unread} new`}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-muted shadow-sm hover:text-ink">
        <Bell size={20} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-broken px-1 text-[11px] font-semibold text-white">{unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem]">
          <StudentNotesList seen={seen} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
