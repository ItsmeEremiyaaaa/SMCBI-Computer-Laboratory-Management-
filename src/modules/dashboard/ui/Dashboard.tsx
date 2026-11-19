import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CalendarDays, ClipboardList, MessageCircle, Monitor, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { useLabLive, type LivePc } from '../../labs/hooks/useLabLive';
import { useLoad } from '../../../shared/hooks/useLoad';
import { bookingsRepo } from '../../bookings/data/repository';
import { calendarRepo } from '../../calendar/data/repository';
import { dashboardRepo } from '../data/repository';
import { labsRepo } from '../../labs/data/repository';
import { scheduleRepo } from '../../schedule/data/repository';
import { classesOn } from '../../schedule/logic/rules';
import { isoWeekday, manilaNow } from '../../../shared/time';
import { usedHours } from '../../bookings/logic/rules';
import { useMessages } from '../../messages/hooks/useMessages';
import type { Reservation } from '../../../shared/data/types';
import { Button, Empty, fmtDate, fmtTime, Led, ResBadge, STATUS_COLOR, STATUS_LABEL, STATUSES } from '../../../shared/ui/ui';
import { CountUp } from '../../../shared/ui/CountUp';

const labDisplayName = (name: string) => {
  if (name.includes('1')) return 'Computer Laboratory 1';
  if (name.includes('2')) return 'Computer Laboratory 2';
  if (name.toLowerCase().includes('net')) return 'Networking Laboratory';
  return name;
};
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// PC status across all labs as a ring chart.
function StatusDonut({ pcs }: { pcs: LivePc[] }) {
  const total = pcs.length || 1;
  const r = 52, c = 2 * Math.PI * r;
  let offset = 0;
  const free = pcs.filter((p) => p.shown === 'free').length;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90" role="img" aria-label="PC status across all labs">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e8f0fb" strokeWidth="16" />
        {/* the segments are uncovered by a ring that draws itself clockwise */}
        <mask id="donut-sweep"><circle className="donut-sweep" cx="70" cy="70" r={r} fill="none" stroke="#fff" strokeWidth="18"
          strokeDasharray={c} style={{ ['--c' as string]: c }} /></mask>
        <g mask="url(#donut-sweep)">
        {STATUSES.map((s) => {
          const n = pcs.filter((p) => p.shown === s).length;
          const len = (n / total) * c;
          const el = n ? <circle key={s} cx="70" cy="70" r={r} fill="none" stroke={STATUS_COLOR[s]} strokeWidth="16"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} /> : null;
          offset += len;
          return el;
        })}
        </g>
        <text x="70" y="66" textAnchor="middle" className="fill-ink text-[22px] font-bold" transform="rotate(90 70 70)"><CountUp value={free} /></text>
        <text x="70" y="86" textAnchor="middle" className="fill-muted text-[10px]" transform="rotate(90 70 70)">free now</text>
      </svg>
      <ul className="grid flex-1 grid-cols-1 gap-2 text-sm">
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

export default function Dashboard() {
  const { profile } = useAuth();
  const isTeacher = profile?.role === 'teacher';
  const isAdmin = profile?.role === 'admin';
  const today = manilaNow().date;
  const labs = useLoad(() => labsRepo.listLabs());
  const { pcs } = useLabLive(null);
  const stats = useLoad(() => (isTeacher ? Promise.resolve(null) : dashboardRepo.stats()), [isTeacher]);
  const res = useLoad(() => bookingsRepo.listReservations({ mine: isTeacher }), [isTeacher]);
  const allApproved = useLoad(() => bookingsRepo.listReservations({ status: 'approved' }));
  const monday = addDays(today, 1 - isoWeekday(today));
  const allBookings = useLoad(() => bookingsRepo.listReservations());
  const weekCheckIns = useLoad(() => labsRepo.listCheckIns(undefined, monday).catch(() => []), [monday]);
  const classes = useLoad(() => scheduleRepo.listSchedules());
  const events = useLoad(() => calendarRepo.listEvents());
  const { unread: unreadMsg } = useMessages();
  useEffect(() => bookingsRepo.subscribeReservations(() => { res.reload(); stats.reload(); allApproved.reload(); classes.reload(); }), [res.reload, stats.reload, allApproved.reload, classes.reload]);

  const labName = (id: string) => labDisplayName(labs.data?.find((l) => l.id === id)?.name ?? id);
  const pcLabel = (id: string | null) => (id ? pcs.find((p) => p.id === id)?.label : 'whole lab');
  const all = res.data ?? [];
  // Approved bookings still to come (later today or any later day), soonest first.
  const nowT = manilaNow();
  const upcoming = (allApproved.data ?? []).filter((r) => r.date > today || (r.date === today && nowT.time < r.start_time))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

  const todays = [...(allApproved.data ?? []).filter((r) => r.date === today), ...classesOn(today, classes.data ?? [])]
    .filter((r) => !isTeacher || r.requester_id === profile?.id || r.id.startsWith('class-'))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const pending = all.filter((r) => r.status === 'pending').sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const nextEvents = (events.data ?? []).filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date)).slice(0, 4);

  // Usage this week = time actually used so far: classes under way or done, bookings only if checked in.
  const week: Reservation[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    week.push(...(allBookings.data ?? []).filter((x) => x.date === d), ...classesOn(d, classes.data ?? []));
  }
  const booked = usedHours(week, weekCheckIns.data ?? [], manilaNow());

  const free = pcs.filter((p) => p.shown === 'free').length;
  const classesToday = classesOn(today, classes.data ?? []).length;
  const first = profile?.full_name.split(' ')[0] ?? '';
  const waiting = isTeacher ? pending.length : stats.data?.pending ?? pending.length;
  const totalHours = Object.values(booked).reduce((a, b) => a + b, 0);
  const week7 = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const laterToday = todays.filter((r) => r.end_time > nowT.time);
  const nextEvent = nextEvents[0];
  // headline words blur in one after another
  const words = (text: string, from = 0) => text.split(' ').map((w, i) => (
    <span key={i} className="hero-word" style={{ ['--i' as string]: from + i }}>{w}&nbsp;</span>
  ));

  return (
    <>
      {/* 1 · greeting + quick actions */}
      <section className="relative mb-8 grid items-center gap-6 xl:grid-cols-[minmax(0,27rem)_1fr]">
        {/* soft floating dots behind the greeting */}
        <span aria-hidden className="float-dot pointer-events-none absolute -left-3 top-2 h-3 w-3 rounded-full bg-accent/25" />
        <span aria-hidden className="float-dot pointer-events-none absolute left-88 top-6 h-2 w-2 rounded-full bg-amber-400/60 [animation-delay:-2s]" />
        <span aria-hidden className="float-dot pointer-events-none absolute bottom-0 left-40 h-6 w-6 rounded-full border-2 border-accent/20 [animation-delay:-4s]" />
        <div className="relative">
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl">
            <span className="sr-only">Overview. </span>
            {words(`Hi, ${first}!`)}<br />{words("What's happening in the labs today?", 2)}
          </h1>
          <p className="mt-4 max-w-md text-muted">
            {fmtDate(today)} · <b className="font-semibold text-ink">{classesToday}</b> class{classesToday === 1 ? '' : 'es'} today,{' '}
            <b className="font-semibold text-ink">{free}</b> of {pcs.length} PCs free right now
            {waiting > 0 && <>, <b className="font-semibold text-ink">{waiting}</b> request{waiting === 1 ? '' : 's'} waiting</>}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <ActionTile to="/labs" icon={Monitor} title="Open the labs" sub="3D view and floor plan, live" />
          <ActionTile to="/reservations" icon={ClipboardList} title="Reservations" sub={waiting > 0 ? `${waiting} pending request${waiting > 1 ? 's' : ''}` : 'View all bookings'} badge={waiting || undefined} />
          <ActionTile to="/schedule" icon={CalendarClock} title="Class schedule" sub="Weekly classes by semester" />
          <ActionTile to="/messages" icon={MessageCircle} title="Messages" sub={unreadMsg ? `${unreadMsg} unread` : 'Chat with the lab office'} badge={unreadMsg} />
        </div>
      </section>

      {/* 2 · approvals · upcoming bookings · this week */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="card p-5">
          <CardHead title={isTeacher ? 'My pending requests' : 'Waiting for approval'} to={pending.length ? '/reservations?status=pending' : undefined} link="Review all" />
          {pending.length === 0 ? <Empty>Nothing waiting. You're all caught up.</Empty> : (
            <ul className="grid gap-3">
              {pending.slice(0, 3).map((r) => (
                <li key={r.id} className="rounded-2xl border border-line bg-panel p-3.5 shadow-sm">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">{r.title}<span className="h-1.5 w-1.5 rounded-full bg-amber-500" /></p>
                  <p className="mt-0.5 truncate text-xs text-muted">{isTeacher ? labName(r.lab_id) : r.requester_name} · {pcLabel(r.pc_id)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="flex items-center gap-1"><CalendarDays size={13} />{fmtDate(r.date)}, {fmtTime(r.start_time)}–{fmtTime(r.end_time)}</span>
                    {isAdmin ? <Link to="/reservations?status=pending" className="font-semibold text-accent hover:underline">Review</Link> : <ResBadge status={r.status} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card flex flex-col p-5">
          <CardHead title="Upcoming bookings" to="/reservations?status=approved" link="All bookings" />
          {upcoming.length === 0 ? <Empty>No approved bookings coming up.</Empty> : (
            <ul className="grid gap-3">
              {upcoming.slice(0, 2).map((r) => (
                <li key={r.id} className="rounded-2xl border border-line bg-panel p-3.5 shadow-sm">
                  <p className="text-xs"><span className="font-semibold text-accent">{labName(r.lab_id)}</span> <span className="text-muted">{pcLabel(r.pc_id)}</span></p>
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{r.title}</p>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${r.date === today ? 'bg-rose-50 text-rose-600' : 'bg-chalk text-muted'}`}>
                      {r.date === today ? 'Today' : fmtDate(r.date)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">{fmtTime(r.start_time)}–{fmtTime(r.end_time)}</span>
                    <span className="truncate text-muted">{r.requester_name}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <CardHead title={new Date(`${today}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })} to="/calendar" link="Calendar" />
          <div className="grid grid-cols-7 text-center text-[11px] text-muted">
            {week7.map((d) => (
              <Link key={d} to="/calendar" className="grid justify-items-center gap-1.5 py-1">
                <span>{new Date(`${d}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)}</span>
                <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${d === today ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'text-ink'}`}>{Number(d.slice(8))}</span>
              </Link>
            ))}
          </div>
          {laterToday.length === 0 ? <p className="mt-4 text-sm text-muted">Nothing else in the labs today.</p> : (
            <ul className="mt-3 grid gap-1">
              {laterToday.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <p className="flex items-center gap-2 text-[11px] font-medium text-muted">{fmtTime(r.start_time)}–{fmtTime(r.end_time)}<span className="h-px flex-1 bg-line" /></p>
                  <div className="flex items-center gap-3 py-1.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chalk text-accent">{r.id.startsWith('class-') ? <Users size={16} /> : <CalendarClock size={16} />}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{r.title}</p><p className="truncate text-xs text-muted">{labName(r.lab_id)} · {r.requester_name}</p></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 3 · labs right now · lab time this week · PC status + next event */}
      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,.8fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <CardHead title="Labs right now" to="/labs" link="Open the labs" />
          <ul className="grid gap-1">
            {labs.data?.map((l) => {
              const mine = pcs.filter((p) => p.lab_id === l.id);
              const lf = mine.filter((p) => p.shown === 'free').length;
              const used = mine.filter((p) => p.shown === 'in_use' || p.shown === 'reserved').length;
              const pct = mine.length ? Math.round((lf / mine.length) * 100) : 0;
              const later = upcoming.filter((r) => r.lab_id === l.id).length;
              return (
                <li key={l.id}>
                  <Link to={`/labs/${l.id}`} className="grid grid-cols-[minmax(0,1.7fr)_3.5rem_minmax(0,1.2fr)_auto] items-center gap-3 sm:gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-chalk">
                    <div className="min-w-0"><p className="font-medium leading-tight text-ink">{labName(l.id)}</p><p className="text-xs text-muted">{mine.length} PCs{later > 0 && ` · ${later} booking${later > 1 ? 's' : ''} ahead`}</p></div>
                    <div><p className="text-[11px] text-muted">In use</p><p className="font-semibold text-ink">{used}</p></div>
                    <div className="flex items-center gap-3">
                      <span className="w-10 text-sm font-semibold text-ink">{pct}%</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent-soft"><div className="bar-grow h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium text-accent">{lf} free <ArrowRight size={13} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="lift relative flex flex-col overflow-hidden rounded-[1.75rem] bg-linear-to-b from-rail-2 to-rail p-6 text-center text-white shadow-xl shadow-rail/30 animate-[rise_.6s_cubic-bezier(.2,.8,.2,1)_.2s_both]">
          <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/5" />
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><ClipboardList size={26} /></span>
          <p className="mt-4 text-sm text-blue-100">Lab time used this week</p>
          <p className="text-5xl font-bold tracking-tight"><CountUp value={Math.round(totalHours * 10) / 10} decimals={totalHours % 1 ? 1 : 0} /><span className="text-2xl"> h</span></p>
          <ul className="mt-4 grid gap-1 text-left text-xs text-blue-100">
            {labs.data?.map((l) => <li key={l.id} className="flex justify-between"><span>{labName(l.id)}</span><b className="text-white">{Math.round((booked[l.id] ?? 0) * 10) / 10} h</b></li>)}
          </ul>
          <Link to="/calendar" className="mx-auto mt-5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-rail shadow-lg transition-transform hover:scale-105">Open the calendar</Link>
        </section>

        <div className="grid gap-5">
          <section className="card p-5">
            <CardHead title="PC status" to="/labs" link="Labs" />
            <StatusDonut pcs={pcs} />
          </section>
          <section className="card p-5">
            <CardHead title="Next event" to="/calendar" link="Calendar" />
            {nextEvent ? (
              <>
                <p className="flex items-center gap-2 text-sm text-muted"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{fmtDate(nextEvent.event_date)} at {fmtTime(nextEvent.event_time)}</p>
                <p className="mt-2 font-semibold text-ink">{nextEvent.title}</p>
                {nextEvent.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{nextEvent.description}</p>}
                <div className="mt-3 flex gap-2">
                  <Link to="/calendar"><Button size="sm" variant="ghost">See the day</Button></Link>
                  <Link to="/reservations?new=1"><Button size="sm">Book a lab</Button></Link>
                </div>
              </>
            ) : <Empty>No upcoming events.</Empty>}
          </section>
        </div>
      </div>

      {isAdmin && stats.data && (
        <section className="card p-5">
          <CardHead title="People" to="/people/teachers" link="Manage" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['Students', stats.data.students, '/people/students'], ['Teachers', stats.data.teachers, '/people/teachers'],
              ['Staff', stats.data.staff, '/people/staff'], ['New sign-ups', stats.data.pendingTeachers, '/people/teachers']] as const).map(([label, n, to]) => (
              <Link key={label} to={to} className="rounded-2xl bg-chalk/70 p-4 transition-colors hover:bg-accent-soft">
                <p className="text-xs text-muted">{label}</p><p className="text-2xl font-bold"><CountUp value={n} /></p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// a quick-action tile: big icon, title, one line
function ActionTile({ to, icon: Icon, title, sub, badge }: { to: string; icon: LucideIcon; title: string; sub: string; badge?: number }) {
  return (
    <Link to={to} className="card lift group relative flex min-h-44 flex-col justify-between p-4">
      {badge ? <span className="absolute right-3 top-3 grid h-5 min-w-5 place-items-center rounded-full bg-broken px-1 text-[10px] font-bold text-white">{badge}</span> : null}
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
        <Icon size={30} strokeWidth={1.75} className="bob-on-hover" />
      </span>
      <span><span className="block text-sm font-semibold text-ink">{title}</span><span className="block text-xs text-muted">{sub}</span></span>
    </Link>
  );
}

function CardHead({ title, to, link }: { title: string; to?: string; link?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {to && link && <Link to={to} className="text-sm font-medium text-muted hover:text-accent">{link}</Link>}
    </div>
  );
}
