import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ClipboardList, MonitorX, TriangleAlert, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { bookingsRepo } from '../../bookings/data/repository';
import { labsRepo } from '../../labs/data/repository';
import { peopleRepo } from '../../people/data/repository';
import { reportsRepo } from '../../reports/data/repository';
import { useCleared } from '../../../shared/hooks/useCleared';
import type { Pc, PcReport, Profile, Reservation } from '../../../shared/data/types';
import { fmtDate, fmtTime, useExclusive } from '../../../shared/ui/ui';

const LAB_SHORT: Record<string, string> = { lab1: 'ComLab 1', lab2: 'ComLab 2', netlab: 'NetLab' };
const peopleTab = (p: Profile) => (p.role === 'student' ? 'accounts' : p.role === 'staff' ? 'staff' : 'teachers');
type Data = { accounts: Profile[]; reports: PcReport[]; requests: Reservation[]; broken: Pc[]; pcs: Pc[] };
// notice ids: a PC that breaks again (new updated_at) shows up again even if its old notice was cleared
const noticeIds = (d: Data) => [
  ...d.accounts.map((p) => `acc-${p.id}`), ...d.reports.map((r) => `rep-${r.id}`),
  ...d.requests.map((r) => `req-${r.id}`), ...d.broken.map((p) => `pc-${p.id}-${p.updated_at}`),
];

// Everything that needs an admin's/staff's attention, kept live (bookings, reports, accounts, PCs).
function useAttention() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(() => Promise.all([
    isAdmin ? peopleRepo.listProfiles().then((ps) => ps.filter((p) => !p.approved && !p.archived_at)) : Promise.resolve([]),
    bookingsRepo.listReservations({ status: 'pending' }),
    labsRepo.listPcs(),
    reportsRepo.listReports().catch(() => []),
  ]).then(([accounts, requests, pcs, reports]) => setData({ accounts, reports, requests, pcs, broken: pcs.filter((p) => p.status === 'broken') }))
    .catch(() => setData((d) => d ?? { accounts: [], reports: [], requests: [], broken: [], pcs: [] })), [isAdmin]);
  // realtime does the instant updates; this catches anything it misses (dropped socket, phone asleep)
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 20_000);
    const wake = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', wake); window.addEventListener('focus', wake);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', wake); window.removeEventListener('focus', wake); };
  }, [load]);
  useEffect(() => bookingsRepo.subscribeReservations(() => { load(); }), [load]);
  useEffect(() => labsRepo.subscribePcs(null, () => { load(); }), [load]);
  return { data, load, isAdmin };
}

/** The list itself: used in the bell's dropdown and on the Notifications page. */
export function AttentionList({ page = false, onNavigate }: { page?: boolean; onNavigate?: () => void }) {
  const { profile } = useAuth();
  const { data, load, isAdmin } = useAttention();
  const { cleared, clear } = useCleared(profile?.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function act(id: string, fn: () => Promise<void>) {
    setBusy(id); setError(null);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  const done = () => onNavigate?.();
  const navigate = useNavigate();
  // approve/reject go through the Reservations dialog: full details + the note (with the school greeting)
  const review = (id: string, to: 'approved' | 'rejected') => { done(); navigate(`/reservations?status=pending&review=${id}&to=${to}`); };
  const show = <T,>(list: T[], id: (x: T) => string) => list.filter((x) => !cleared.has(id(x)));
  const accounts = show(data?.accounts ?? [], (p) => `acc-${p.id}`);
  const reports = show(data?.reports ?? [], (r) => `rep-${r.id}`);
  const requests = show(data?.requests ?? [], (r) => `req-${r.id}`);
  const broken = show(data?.broken ?? [], (p) => `pc-${p.id}-${p.updated_at}`);
  const visible = accounts.length + reports.length + requests.length + broken.length;
  const pcLabel = (id: string) => data?.pcs.find((p) => p.id === id)?.label ?? id;
  const maxReq = page ? Infinity : 6;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <p className="font-semibold">Needs attention</p>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span>
        {visible > 0 && (
          <button type="button" onClick={() => data && clear(noticeIds(data))} className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-chalk hover:text-ink">
            Clear all
          </button>
        )}
      </div>
      {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
      <div className={page ? '' : 'max-h-[60vh] overflow-y-auto'}>
        {!data && <p className="px-4 py-6 text-center text-sm text-muted">Loading…</p>}
        {data && visible === 0 && <p className="px-4 py-6 text-center text-sm text-muted">All caught up. New reports, requests and sign-ups appear here as they happen.</p>}

        {accounts.length > 0 && (
          <Section icon={<UserPlus size={15} />} title="Accounts waiting for approval" n={accounts.length}>
            {accounts.map((p) => (
              <Item key={p.id} to={`/people/${peopleTab(p)}`} onClick={done} onClear={() => clear([`acc-${p.id}`])}
                title={p.full_name} sub={<><span className="capitalize">{p.role}</span> · {p.email}</>}
                actions={<>
                  <Act busy={busy === p.id} onClick={() => act(p.id, () => peopleRepo.updateProfile(p.id, { approved: true }))}>Approve</Act>
                  <Act busy={busy === p.id} quiet onClick={() => act(p.id, () => peopleRepo.setAccountArchived(p.id, true))}>Archive</Act>
                </>} />
            ))}
          </Section>
        )}
        {reports.length > 0 && (
          <Section icon={<TriangleAlert size={15} />} title="Problem reports" n={reports.length}>
            {reports.map((r) => (
              <Item key={r.id} to={`/labs/${r.lab_id}?pc=${r.pc_id}`} onClick={done} onClear={() => clear([`rep-${r.id}`])}
                title={`${LAB_SHORT[r.lab_id] ?? r.lab_id} · ${pcLabel(r.pc_id)}: ${r.problem}`}
                sub={`${r.user_name}${r.note ? ' · ' + r.note : ''} · ${fmtDate(r.created_at.slice(0, 10))}`}
                actions={<>
                  <Act busy={busy === r.id} danger onClick={() => act(r.id, () => reportsRepo.resolveReport(r.id, 'broken'))}>Mark broken</Act>
                </>} />
            ))}
          </Section>
        )}
        {requests.length > 0 && (
          <Section icon={<ClipboardList size={15} />} title="Booking requests" n={requests.length}>
            {requests.slice(0, maxReq).map((r) => (
              <Item key={r.id} to="/reservations?status=pending" onClick={done} onClear={() => clear([`req-${r.id}`])} title={r.title}
                sub={`${r.requester_name} · ${LAB_SHORT[r.lab_id] ?? r.lab_id}${r.pc_id ? ' ' + pcLabel(r.pc_id) : ''} · ${fmtDate(r.date)} ${fmtTime(r.start_time)}`}
                actions={isAdmin && <>
                  <Act busy={busy === r.id} onClick={() => review(r.id, 'approved')}>Approve</Act>
                  <Act busy={busy === r.id} quiet onClick={() => review(r.id, 'rejected')}>Reject</Act>
                </>} />
            ))}
            {requests.length > maxReq && <Item to="/reservations?status=pending" onClick={done} title={`See all ${requests.length} requests`} />}
          </Section>
        )}
        {broken.length > 0 && (
          <Section icon={<MonitorX size={15} />} title="Broken PCs" n={broken.length}>
            {broken.map((p) => (
              <Item key={p.id} to={`/labs/${p.lab_id}?pc=${p.id}`} onClick={done} onClear={() => clear([`pc-${p.id}-${p.updated_at}`])}
                title={`${LAB_SHORT[p.lab_id] ?? p.lab_id} · ${p.label}`} sub={p.note ?? 'No note'} />
            ))}
          </Section>
        )}
      </div>
      {!page && (
        <Link to="/inbox" onClick={done} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-accent hover:bg-chalk">
          Open all notifications
        </Link>
      )}
    </>
  );
}

/** Live count of what is still showing (after the user's cleared notices). */
function useAttentionCount() {
  const { profile } = useAuth();
  const { data } = useAttention();
  const { cleared } = useCleared(profile?.id);
  return data ? noticeIds(data).filter((id) => !cleared.has(id)).length : 0;
}

// Bell for admin/staff: one panel grouping what needs attention, each item linking to where it's handled.
export default function NotificationBell({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const count = useAttentionCount();
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
  const done = () => setOpen(false);
  useExclusive(open, done);

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
          <AttentionList onNavigate={done} />
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

function Item({ to, title, sub, onClick, onClear, actions }:
  { to: string; title: string; sub?: React.ReactNode; onClick: () => void; onClear?: () => void; actions?: React.ReactNode }) {
  return (
    <li className="group relative px-4 py-2.5 hover:bg-chalk">
      <Link to={to} onClick={onClick} className={`block ${onClear ? 'pr-7' : ''}`}>
        <p className="truncate text-sm font-medium">{title}</p>
        {sub && <p className="truncate text-xs text-muted">{sub}</p>}
      </Link>
      {onClear && (
        <button type="button" onClick={onClear} aria-label={`Clear notification: ${title}`} title="Clear"
          className="absolute right-2 top-2 rounded p-1 text-muted hover:bg-panel hover:text-ink"><X size={14} /></button>
      )}
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
