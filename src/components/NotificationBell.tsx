import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ClipboardList, MonitorX, TriangleAlert, UserPlus } from 'lucide-react';
import { useAuth } from '../auth';
import { api } from '../lib/api';
import type { Pc, PcReport, Profile, Reservation } from '../lib/types';
import { fmtDate, fmtTime } from './ui';

const LAB_SHORT: Record<string, string> = { lab1: 'ComLab 1', lab2: 'ComLab 2', netlab: 'NetLab' };
const peopleTab = (p: Profile) => (p.role === 'student' ? 'accounts' : p.role === 'staff' ? 'staff' : 'teachers');

// Bell for admin/staff: one panel grouping what needs attention, each item linking to where it's handled.
export default function NotificationBell({ count, className = '' }: { count: number; className?: string }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ accounts: Profile[]; reports: PcReport[]; requests: Reservation[]; broken: Pc[]; pcs: Pc[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => Promise.all([
    isAdmin ? api.listProfiles().then((ps) => ps.filter((p) => !p.approved && !p.archived_at)) : Promise.resolve([]),
    api.listReservations({ status: 'pending' }),
    api.listPcs(),
    api.listReports().catch(() => []),
  ]).then(([accounts, requests, pcs, reports]) => setData({ accounts, reports, requests, pcs, broken: pcs.filter((p) => p.status === 'broken') }))
    .catch(() => setData({ accounts: [], reports: [], requests: [], broken: [], pcs: [] }));
  // Handle an item right here; the badge count refreshes through the reservations subscription.
  async function act(id: string, fn: () => Promise<void>) {
    setBusy(id); setError(null);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  useEffect(() => {
    if (!open) return;
    load();
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open, isAdmin]);

  const done = () => setOpen(false);
  const empty = data && !data.accounts.length && !data.reports.length && !data.requests.length && !data.broken.length;
  const pcLabel = (id: string) => data?.pcs.find((p) => p.id === id)?.label ?? id;

  return (
    <div ref={box} className={`pointer-events-auto relative ${className}`}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Notifications, ${count} need attention`}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-muted shadow-sm hover:text-ink">
        <Bell size={20} />
        {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-broken px-1 text-[11px] font-semibold text-white">{count}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[22rem]">
          <p className="border-b border-line px-4 py-3 font-semibold">Needs attention</p>
          {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
          <div className="max-h-[70vh] overflow-y-auto">
            {!data && <p className="px-4 py-6 text-center text-sm text-muted">Loading…</p>}
            {empty && <p className="px-4 py-6 text-center text-sm text-muted">All caught up.</p>}

            {!!data?.accounts.length && (
              <Section icon={<UserPlus size={15} />} title="Accounts waiting for approval" n={data.accounts.length}>
                {data.accounts.map((p) => (
                  <Item key={p.id} to={`/people/${peopleTab(p)}`} onClick={done}
                    title={p.full_name} sub={<><span className="capitalize">{p.role}</span> · {p.email}</>}
                    actions={<>
                      <Act busy={busy === p.id} onClick={() => act(p.id, () => api.updateProfile(p.id, { approved: true }))}>Approve</Act>
                      <Act busy={busy === p.id} quiet onClick={() => act(p.id, () => api.setAccountArchived(p.id, true))}>Archive</Act>
                    </>} />
                ))}
              </Section>
            )}
            {!!data?.reports.length && (
              <Section icon={<TriangleAlert size={15} />} title="Problem reports" n={data.reports.length}>
                {data.reports.map((r) => (
                  <Item key={r.id} to={`/labs/${r.lab_id}`} onClick={done} title={`${LAB_SHORT[r.lab_id] ?? r.lab_id} · ${pcLabel(r.pc_id)}: ${r.problem}`}
                    sub={`${r.user_name}${r.note ? ' · ' + r.note : ''}`}
                    actions={<>
                      <Act busy={busy === r.id} danger onClick={() => act(r.id, () => api.resolveReport(r.id, 'broken'))}>Mark broken</Act>
                      <Act busy={busy === r.id} quiet onClick={() => act(r.id, () => api.resolveReport(r.id, 'dismissed'))}>Dismiss</Act>
                    </>} />
                ))}
              </Section>
            )}
            {!!data?.requests.length && (
              <Section icon={<ClipboardList size={15} />} title="Booking requests" n={data.requests.length}>
                {data.requests.slice(0, 6).map((r) => (
                  <Item key={r.id} to="/reservations?status=pending" onClick={done} title={r.title}
                    sub={`${r.requester_name} · ${LAB_SHORT[r.lab_id] ?? r.lab_id} · ${fmtDate(r.date)} ${fmtTime(r.start_time)}`}
                    actions={isAdmin && <>
                      <Act busy={busy === r.id} onClick={() => act(r.id, () => api.reviewReservation(r.id, 'approved'))}>Approve</Act>
                      <Act busy={busy === r.id} quiet onClick={() => act(r.id, () => api.reviewReservation(r.id, 'rejected'))}>Reject</Act>
                    </>} />
                ))}
                {data.requests.length > 6 && <Item to="/reservations?status=pending" onClick={done} title={`See all ${data.requests.length} requests`} />}
              </Section>
            )}
            {!!data?.broken.length && (
              <Section icon={<MonitorX size={15} />} title="Broken PCs" n={data.broken.length}>
                {data.broken.map((p) => (
                  <Item key={p.id} to={`/labs/${p.lab_id}`} onClick={done} title={`${LAB_SHORT[p.lab_id] ?? p.lab_id} · ${p.label}`} sub={p.note ?? 'No note'} />
                ))}
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, n, children }: { icon: React.ReactNode; title: string; n: number; children: React.ReactNode }) {
  return (
    <section className="border-b border-line last:border-b-0">
      <p className="flex items-center gap-2 bg-chalk/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}{title}<span className="ml-auto rounded-full bg-panel px-2 py-0.5 text-ink">{n}</span>
      </p>
      <ul>{children}</ul>
    </section>
  );
}

function Item({ to, title, sub, onClick, actions }:
  { to: string; title: string; sub?: React.ReactNode; onClick: () => void; actions?: React.ReactNode }) {
  return (
    <li className="px-4 py-2.5 hover:bg-chalk">
      <Link to={to} onClick={onClick} className="block">
        <p className="truncate text-sm font-medium">{title}</p>
        {sub && <p className="truncate text-xs text-muted">{sub}</p>}
      </Link>
      {actions && <div className="mt-1.5 flex gap-1.5">{actions}</div>}
    </li>
  );
}

function Act({ children, onClick, busy, quiet, danger }:
  { children: React.ReactNode; onClick: () => void; busy?: boolean; quiet?: boolean; danger?: boolean }) {
  return (
    <button type="button" disabled={busy} onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
        danger ? 'bg-broken text-white hover:brightness-95' : quiet ? 'border border-line bg-panel text-muted hover:text-ink' : 'bg-accent text-white hover:bg-rail'}`}>
      {children}
    </button>
  );
}
