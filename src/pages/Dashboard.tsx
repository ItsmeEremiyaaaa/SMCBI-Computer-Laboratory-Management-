import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CalendarDays, ClipboardList, Hourglass, Monitor, MonitorCheck, MonitorSmartphone, Plus, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../auth';
import { useLabLive, type LivePc } from '../hooks/useLabLive';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import { classesOn, isoWeekday, manilaNow } from '../lib/seat';
import type { Lab, Reservation } from '../lib/types';
import { Button, Empty, fmtDate, fmtTime, Led, Panel, ResBadge, STATUS_COLOR, STATUS_LABEL, STATUSES } from '../components/ui';

const short = (name: string) => name.replace('Computer Laboratory', 'Lab');
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const hours = (r: Reservation) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return (m(r.end_time) - m(r.start_time)) / 60;
};

function StatCard({ icon: Icon, label, value, note, to }: { icon: LucideIcon; label: string; value: ReactNode; note: string; to?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={18} strokeWidth={2} /></span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </>
  );
  return to
    ? <Link to={to} className="card block p-5 transition-transform hover:-translate-y-0.5">{body}</Link>
    : <div className="card p-5">{body}</div>;
}

function LabTile({ lab, pcs }: { lab: Lab; pcs: LivePc[] }) {
  const mine = pcs.filter((p) => p.lab_id === lab.id).sort((a, b) => a.row - b.row || a.col - b.col);
  const free = mine.filter((p) => p.shown === 'free').length;
  const inUse = mine.filter((p) => p.shown === 'in_use').length;
  const reserved = mine.filter((p) => p.shown === 'reserved').length;
  const broken = mine.filter((p) => p.shown === 'broken').length;
  const pct = mine.length ? Math.round((free / mine.length) * 100) : 0;
  return (
    <Link to={`/labs/${lab.id}`} className="card group flex flex-col justify-between p-5 transition-all hover:-translate-y-1 hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white">
              <Monitor size={20} strokeWidth={2} />
            </span>
            <div>
              <h3 className="font-semibold text-ink transition-colors group-hover:text-accent">{short(lab.name)}</h3>
              <p className="text-xs text-muted">{mine.length} workstations total</p>
            </div>
          </div>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">{free} free</span>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-chalk/80 p-2.5 text-center">
          <div className="rounded-lg bg-panel/70 py-1.5 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Free</p>
            <p className="text-base font-bold text-free">{free}</p>
          </div>
          <div className="rounded-lg bg-panel/70 py-1.5 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">In Use</p>
            <p className="text-base font-bold text-accent">{inUse}</p>
          </div>
          <div className="rounded-lg bg-panel/70 py-1.5 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Reserved</p>
            <p className="text-base font-bold text-amber-500">{reserved}</p>
          </div>
          <div className="rounded-lg bg-panel/70 py-1.5 shadow-sm">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Broken</p>
            <p className="text-base font-bold text-rose-500">{broken}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>Availability</span>
            <span className="font-semibold text-ink">{pct}% available</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-accent-soft" aria-label={`${pct}% free`}>
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3 text-xs font-medium text-accent">
        <span>View lab in 3D visual</span>
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

// PC status across all labs as a ring chart.
function StatusDonut({ pcs }: { pcs: LivePc[] }) {
  const total = pcs.length || 1;
  const r = 52, c = 2 * Math.PI * r;
  let offset = 0;
  const free = pcs.filter((p) => p.shown === 'free').length;
  return (
    <div className="flex flex-wrap items-center gap-6 px-5 pb-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90" role="img" aria-label="PC status across all labs">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e8f0fb" strokeWidth="16" />
        {STATUSES.map((s) => {
          const n = pcs.filter((p) => p.shown === s).length;
          const len = (n / total) * c;
          const el = n ? <circle key={s} cx="70" cy="70" r={r} fill="none" stroke={STATUS_COLOR[s]} strokeWidth="16"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} /> : null;
          offset += len;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="rotate-90 fill-ink text-[22px] font-bold" transform="rotate(90 70 70)">{free}</text>
        <text x="70" y="86" textAnchor="middle" className="fill-muted text-[10px]" transform="rotate(90 70 70)">free now</text>
      </svg>
      <ul className="grid flex-1 gap-2 text-sm">
        {STATUSES.map((s) => {
          const n = pcs.filter((p) => p.shown === s).length;
          return (
            <li key={s} className="flex items-center gap-2">
              <Led status={s} />
              <span className="flex-1 text-muted">{STATUS_LABEL[s]}</span>
              <b className="font-semibold">{n}</b>
              <span className="w-10 text-right text-xs text-muted">{Math.round((n / total) * 100)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Hours each lab is booked this week (classes + approved bookings), as bars.
function WeekUsage({ labs, booked }: { labs: Lab[]; booked: Record<string, number> }) {
  const max = Math.max(1, ...labs.map((l) => booked[l.id] ?? 0));
  return (
    <ul className="grid gap-4 px-5 pb-5">
      {labs.map((l) => {
        const h = booked[l.id] ?? 0;
        return (
          <li key={l.id}>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-medium">{short(l.name)}</span>
              <span className="text-muted"><b className="font-semibold text-ink">{h}</b> hrs</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-accent-soft">
              <div className="h-full rounded-full bg-gradient-to-r from-accent to-gold" style={{ width: `${(h / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';
  const isAdmin = profile?.role === 'admin';
  const today = manilaNow().date;
  const labs = useLoad(() => api.listLabs());
  const { pcs } = useLabLive(null);
  const stats = useLoad(() => (isTeacher ? Promise.resolve(null) : api.stats()), [isTeacher]);
  const res = useLoad(() => api.listReservations({ mine: isTeacher }), [isTeacher]);
  const allApproved = useLoad(() => api.listReservations({ status: 'approved' }));
  const classes = useLoad(() => api.listSchedules());
  const events = useLoad(() => api.listEvents());
  useEffect(() => api.subscribeReservations(() => { res.reload(); stats.reload(); allApproved.reload(); }), [res.reload, stats.reload, allApproved.reload]);

  const labName = (id: string) => short(labs.data?.find((l) => l.id === id)?.name ?? id);
  const pcLabel = (id: string | null) => (id ? pcs.find((p) => p.id === id)?.label : 'whole lab');
  const all = res.data ?? [];
  const todays = [...(allApproved.data ?? []).filter((r) => r.date === today), ...classesOn(today, classes.data ?? [])]
    .filter((r) => !isTeacher || r.requester_id === profile?.id || r.id.startsWith('class-'))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const pending = all.filter((r) => r.status === 'pending').sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const nextEvents = (events.data ?? []).filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date)).slice(0, 4);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const monday = addDays(today, 1 - isoWeekday(today));
  const booked: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    for (const r of [...(allApproved.data ?? []).filter((x) => x.date === d), ...classesOn(d, classes.data ?? [])])
      booked[r.lab_id] = (booked[r.lab_id] ?? 0) + hours(r);
  }

  const free = pcs.filter((p) => p.shown === 'free').length;
  const inUse = pcs.filter((p) => p.shown === 'in_use' || p.shown === 'reserved').length;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Overview</h1>
          <p className="mt-1 text-sm text-muted">{greeting}, {profile?.full_name.split(' ')[0]}. Here’s the lab picture for {fmtDate(today)}.</p>
        </div>
        <Link to="/reservations?new=1"><Button><Plus size={16} />Request a lab</Button></Link>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={MonitorCheck} label="PCs free now" value={<>{free}<span className="text-lg font-semibold text-muted">/{pcs.length}</span></>} note="Across all three labs" to="/labs" />
        <StatCard icon={MonitorSmartphone} label="In use or reserved" value={inUse} note="Students, classes and bookings" to="/labs" />
        <StatCard icon={CalendarClock} label="Classes today" value={classesOn(today, classes.data ?? []).length} note="From the weekly class schedule" to="/schedule" />
        {isTeacher
          ? <StatCard icon={Hourglass} label="My pending requests" value={pending.length} note="Waiting for the lab admin" to="/reservations?status=pending" />
          : <StatCard icon={Hourglass} label="Pending requests" value={stats.data?.pending ?? 0} note="Need a decision" to="/reservations?status=pending" />}
      </div>

      <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink">
        <Monitor className="text-accent" size={18} />
        Labs right now
      </h2>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {labs.data?.map((l) => <LabTile key={l.id} lab={l} pcs={pcs} />)}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="PC status" icon={MonitorCheck}><StatusDonut pcs={pcs} /></Panel>
        <Panel title="Lab usage this week" icon={ClipboardList}
          actions={<span className="text-xs text-muted">{fmtDate(monday)} to {fmtDate(addDays(monday, 6))}</span>}>
          {labs.data && <WeekUsage labs={labs.data} booked={booked} />}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Today’s schedule" icon={CalendarClock}
          actions={<Link to="/schedule" className="text-sm font-medium text-accent hover:underline">Class schedule</Link>}>
          {todays.length === 0 ? <Empty>No classes or bookings in the labs today.</Empty> : (
            <ul className="grid gap-2 px-5 pb-5">
              {todays.slice(0, 7).map((r) => (
                <li key={r.id} className="flex items-center gap-4 rounded-xl bg-chalk/70 px-3 py-2.5 text-sm">
                  <div className="w-20 shrink-0 font-cond font-semibold text-accent">{fmtTime(r.start_time)}<br /><span className="font-normal text-muted">{fmtTime(r.end_time)}</span></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="truncate text-muted">{labName(r.lab_id)}, {pcLabel(r.pc_id)}. {r.requester_name}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={isTeacher ? 'My pending requests' : 'Waiting for approval'} icon={Hourglass}
          actions={pending.length > 0 && <Link to="/reservations?status=pending" className="text-sm font-medium text-accent hover:underline">Review all</Link>}>
          {pending.length === 0 ? <Empty>Nothing waiting. You’re all caught up.</Empty> : (
            <ul className="grid gap-2 px-5 pb-5">
              {pending.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl bg-chalk/70 px-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="truncate text-muted">{fmtDate(r.date)}, {fmtTime(r.start_time)}. {labName(r.lab_id)}{!isTeacher && `. ${r.requester_name}`}</p>
                  </div>
                  {isAdmin ? <Link to="/reservations?status=pending"><Button size="sm" variant="ghost">Review</Button></Link> : <ResBadge status={r.status} />}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Coming up" icon={CalendarDays} className="lg:col-span-2"
          actions={<Link to="/calendar" className="text-sm font-medium text-accent hover:underline">Calendar</Link>}>
          {nextEvents.length === 0 ? <Empty>No upcoming events.</Empty> : (
            <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4">
              {nextEvents.map((e) => (
                <li key={e.id} className="flex gap-3 rounded-xl bg-chalk/70 p-3 text-sm">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-center leading-none text-white">
                    <span><span className="block text-[10px] uppercase opacity-80">{fmtDate(e.event_date).split(' ')[1]}</span><span className="text-lg font-bold">{e.event_date.slice(8)}</span></span>
                  </span>
                  <div className="min-w-0"><p className="truncate font-medium">{e.title}</p><p className="capitalize text-muted">{e.event_type}, {fmtTime(e.event_time)}</p></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {isAdmin && stats.data && (
          <Panel title="People" icon={Users} className="lg:col-span-2"
            actions={<Link to="/people/teachers" className="text-sm font-medium text-accent hover:underline">Manage</Link>}>
            <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
              {([['Students', stats.data.students, '/people/students'], ['Teachers', stats.data.teachers, '/people/teachers'],
                ['Staff', stats.data.staff, '/people/staff'], ['New sign-ups', stats.data.pendingTeachers, '/people/teachers']] as const).map(([label, n, to]) => (
                <Link key={label} to={to} className="rounded-xl bg-chalk/70 p-3 hover:bg-accent-soft">
                  <p className="text-xs text-muted">{label}</p><p className="text-2xl font-bold">{n}</p>
                </Link>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
