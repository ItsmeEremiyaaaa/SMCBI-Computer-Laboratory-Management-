import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '../auth';
import { useLabLive, type LivePc } from '../hooks/useLabLive';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import { manilaNow } from '../lib/seat';
import type { Lab } from '../lib/types';
import { Button, Empty, fmtDate, fmtTime, Led, PageHeader, Panel, ResBadge, STATUS_COLOR, STATUS_LABEL, STATUSES } from '../components/ui';

function LabTile({ lab, pcs }: { lab: Lab; pcs: LivePc[] }) {
  const mine = pcs.filter((p) => p.lab_id === lab.id).sort((a, b) => a.row - b.row || a.col - b.col);
  const free = mine.filter((p) => p.shown === 'free').length;
  return (
    <Link to={`/labs/${lab.id}`} className="group rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{lab.name.replace('Computer Laboratory', 'Lab')}</h3>
        <p className="text-sm text-muted"><b className="font-cond text-lg font-semibold text-ink">{free}</b> of {mine.length} free</p>
      </div>
      <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${lab.cols}, minmax(0, 1fr))` }} aria-hidden>
        {mine.map((p) => <span key={p.id} className="led !h-2.5 !w-full !rounded-sm" title={`${p.label}: ${STATUS_LABEL[p.shown]}`}
          style={{ color: STATUS_COLOR[p.shown] }} />)}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-3 text-xs text-muted">
        {STATUSES.filter((s) => s !== 'free').map((s) => (
          <span key={s} className="flex items-center gap-1"><Led status={s} className="!h-2 !w-2" />{mine.filter((p) => p.shown === s).length} {STATUS_LABEL[s].toLowerCase()}</span>
        ))}
      </p>
    </Link>
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
  const events = useLoad(() => api.listEvents());
  useEffect(() => api.subscribeReservations(() => { res.reload(); stats.reload(); }), [res.reload, stats.reload]);

  const labName = (id: string) => labs.data?.find((l) => l.id === id)?.name.replace('Computer Laboratory', 'Lab') ?? id;
  const all = res.data ?? [];
  const todays = all.filter((r) => r.date === today && r.status === 'approved').sort((a, b) => a.start_time.localeCompare(b.start_time));
  const pending = all.filter((r) => r.status === 'pending').sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const upcoming = all.filter((r) => r.date >= today && r.status === 'approved').sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
  const nextEvents = (events.data ?? []).filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date)).slice(0, 4);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader title="Overview" sub={`${greeting}, ${profile?.full_name.split(' ')[0]}. ${fmtDate(today)}.`}
        actions={<Link to="/reservations?new=1"><Button><Plus size={16} />Request a lab</Button></Link>} />

      {stats.data && (
        <dl className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
          {([
            ['Students', stats.data.students, isAdmin ? '/people/students' : null],
            ['Teachers', stats.data.teachers, isAdmin ? '/people/teachers' : null],
            ['Staff', stats.data.staff, isAdmin ? '/people/staff' : null],
            ['Courses', stats.data.courses, null],
            ['Pending requests', stats.data.pending, '/reservations?status=pending'],
          ] as const).map(([label, n, to]) => {
            const body = <><dt className="text-sm text-muted">{label}</dt><dd className="font-cond text-3xl font-semibold">{n}</dd></>;
            return to
              ? <Link key={label} to={to} className="bg-panel px-4 py-3 hover:bg-chalk">{body}</Link>
              : <div key={label} className="bg-panel px-4 py-3">{body}</div>;
          })}
        </dl>
      )}

      <section className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-free opacity-60" /><span className="relative h-2 w-2 rounded-full bg-free" /></span>
          Labs right now
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {labs.data?.map((l) => <LabTile key={l.id} lab={l} pcs={pcs} />)}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={isTeacher ? 'My upcoming bookings' : 'Today’s schedule'}
          actions={<Link to="/reservations" className="text-sm text-accent hover:underline">All reservations</Link>}>
          {(isTeacher ? upcoming : todays).length === 0 ? <Empty>{isTeacher ? 'No approved bookings yet.' : 'No classes booked for today.'}</Empty> : (
            <ul className="divide-y divide-line">
              {(isTeacher ? upcoming : todays).slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                  <div className="w-24 shrink-0 text-muted">{isTeacher && <p className="font-medium text-ink">{fmtDate(r.date)}</p>}{fmtTime(r.start_time)}<br />{fmtTime(r.end_time)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="truncate text-muted">{labName(r.lab_id)}, {r.pc_id ? pcs.find((p) => p.id === r.pc_id)?.label : 'whole lab'}{!isTeacher && `. ${r.requester_name}`}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={isTeacher ? 'My pending requests' : 'Waiting for approval'}
          actions={pending.length > 0 && <Link to="/reservations?status=pending" className="text-sm text-accent hover:underline">Review all</Link>}>
          {pending.length === 0 ? <Empty>Nothing waiting. You’re all caught up.</Empty> : (
            <ul className="divide-y divide-line">
              {pending.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="truncate text-muted">{fmtDate(r.date)}, {fmtTime(r.start_time)}. {labName(r.lab_id)}{!isTeacher && `. ${r.requester_name}`}</p>
                  </div>
                  {isAdmin ? (
                    <Link to="/reservations?status=pending"><Button size="sm" variant="ghost">Review</Button></Link>
                  ) : <ResBadge status={r.status} />}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Coming up" className="lg:col-span-2"
          actions={<Link to="/calendar" className="text-sm text-accent hover:underline">Calendar</Link>}>
          {nextEvents.length === 0 ? <Empty>No upcoming events.</Empty> : (
            <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
              {nextEvents.map((e) => (
                <li key={e.id} className="flex gap-3 px-4 py-3 text-sm">
                  <span className="font-cond w-14 shrink-0 text-center"><span className="block text-xs text-muted">{fmtDate(e.event_date).split(' ')[1]}</span><span className="text-xl font-semibold">{e.event_date.slice(8)}</span></span>
                  <div><p className="font-medium">{e.title}</p><p className="capitalize text-muted">{e.event_type}, {fmtTime(e.event_time)}</p></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
