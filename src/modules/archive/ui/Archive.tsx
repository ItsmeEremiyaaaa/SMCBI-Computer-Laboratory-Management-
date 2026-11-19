import { useEffect, useState, type ReactNode } from 'react';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { useLoad } from '../../../shared/hooks/useLoad';
import { archiveRepo } from '../data/repository';
import { labsRepo } from '../../labs/data/repository';
import { peopleRepo } from '../../people/data/repository';
import { reportsRepo } from '../../reports/data/repository';
import type { ArchiveKind } from '../../../shared/data/types';
import { Alert, Button, Empty, PageHeader, Panel, askConfirm, toast } from '../../../shared/ui/ui';

const KINDS: { kind: ArchiveKind | 'account' | 'report'; label: string }[] = [
  { kind: 'student', label: 'Student records' },
  { kind: 'account', label: 'Accounts' },
  { kind: 'reservation', label: 'Bookings' },
  { kind: 'event', label: 'Calendar events' },
  { kind: 'class', label: 'Classes' },
  { kind: 'report', label: 'Handled reports' },
];
type Tab = (typeof KINDS)[number]['kind'];
const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// One row shape for every tab: what it is, when/why it's here.
type Row = { id: string; title: ReactNode; sub: ReactNode; label: string };

// Everything "deleted" lands here. Admins restore it, or erase it for good, one at a time or in bulk.
export default function Archive() {
  const [tab, setTab] = useState<Tab>('student');
  const items = useLoad(() => archiveRepo.listArchive());
  const accounts = useLoad(() => peopleRepo.listProfiles().then((ps) => ps.filter((p) => p.archived_at)));
  const reports = useLoad(() => reportsRepo.listReports({ all: true }).then((rs) => rs.filter((r) => r.resolved_at)).catch(() => []));
  const pcs = useLoad(() => labsRepo.listPcs());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  useEffect(() => setPicked(new Set()), [tab]);

  const pcLabel = (id: string) => pcs.data?.find((p) => p.id === id)?.label ?? id;
  const rowsFor = (k: Tab): Row[] => {
    if (k === 'account') return (accounts.data ?? []).map((p) => ({
      id: p.id, label: p.full_name,
      title: <>{p.full_name} <span className="text-sm font-normal capitalize text-muted">· {p.role}</span></>,
      sub: <>{p.email} · archived {when(p.archived_at!)}</>,
    }));
    if (k === 'report') return (reports.data ?? []).map((r) => ({
      id: r.id, label: `${pcLabel(r.pc_id)}: ${r.problem}`,
      title: <>{pcLabel(r.pc_id)}: {r.problem}{r.note && <span className="font-normal text-muted"> — {r.note}</span>}</>,
      sub: <>Reported by {r.user_name}, {when(r.created_at)} ·{' '}
        <span className={r.resolution === 'broken' ? 'font-medium text-red-700' : ''}>{r.resolution === 'broken' ? 'Marked broken' : 'Dismissed'}</span> {when(r.resolved_at!)}</>,
    }));
    return (items.data ?? []).filter((i) => i.kind === k).map((i) => ({
      id: i.id, label: i.label, title: i.label,
      sub: <>Deleted {when(i.archived_at)}{i.archived_by_name && ` by ${i.archived_by_name}`}</>,
    }));
  };
  const rows = rowsFor(tab);
  const loading = tab === 'account' ? accounts.loading : tab === 'report' ? reports.loading : items.loading;
  // what each tab can do: accounts are restored only (deleting a login needs the admin tools); reports are only deleted
  const canRestore = tab !== 'report';
  const canDelete = tab !== 'account';

  async function run(ids: string[], what: 'restore' | 'delete') {
    setBusy(true); setError(null);
    try {
      if (tab === 'account') for (const id of ids) await peopleRepo.setAccountArchived(id, false);
      else if (tab === 'report') await reportsRepo.deleteReports(ids);
      else for (const id of ids) await (what === 'restore' ? archiveRepo.restoreArchived(id) : archiveRepo.purgeArchived(id));
      setPicked(new Set());
      toast(what === 'restore' ? `Restored ${ids.length === 1 ? '1 item' : `${ids.length} items`}` : `Deleted ${ids.length === 1 ? '1 item' : `${ids.length} items`} for good`);
    } catch (e) { setError((e as Error).message); }
    finally {
      setBusy(false);
      await (tab === 'account' ? accounts.reload() : tab === 'report' ? reports.reload() : items.reload());
    }
  }
  const restore = (ids: string[]) => run(ids, 'restore');
  const erase = (ids: string[], name: string) => askConfirm({
    title: ids.length > 1 ? `Delete ${ids.length} items forever?` : 'Delete forever?',
    message: `${ids.length > 1 ? `${ids.length} items` : `"${name}"`} will be deleted for good. This can't be undone.`,
    confirmLabel: 'Delete forever', danger: true,
  }).then((ok) => { if (ok) void run(ids, 'delete'); });

  const allPicked = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chosen = rows.filter((r) => picked.has(r.id));

  return (
    <>
      <PageHeader title="Archive" sub="Deleted records, archived accounts and handled reports. Restore them, or delete them for good." />
      <nav className="mb-4 flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1" aria-label="Archive type">
        {KINDS.map((k) => (
          <button key={k.kind} onClick={() => setTab(k.kind)} aria-pressed={tab === k.kind}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${tab === k.kind ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
            {k.label}<span className={`rounded-full px-1.5 text-xs ${tab === k.kind ? 'bg-white/25' : 'bg-chalk'}`}>{rowsFor(k.kind).length}</span>
          </button>
        ))}
      </nav>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Panel>
        {!rows.length ? <Empty>{loading ? 'Loading…' : 'Nothing here.'}</Empty> : (
          <>
            {/* toolbar: select all + bulk actions */}
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-chalk/50 px-4 py-2.5 text-sm">
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" className="h-4 w-4 accent-[var(--color-accent)]" checked={allPicked}
                  onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.id)))} />
                {chosen.length ? `${chosen.length} selected` : `Select all (${rows.length})`}
              </label>
              {!chosen.length && canDelete && (
                <Button size="sm" variant="quiet" className="ml-auto text-red-700" disabled={busy} onClick={() => erase(rows.map((r) => r.id), rows[0].label)}>
                  <Trash2 size={14} />Delete all ({rows.length})
                </Button>
              )}
              {chosen.length > 0 && (
                <div className="ml-auto flex gap-2">
                  {canRestore && <Button size="sm" disabled={busy} onClick={() => restore(chosen.map((r) => r.id))}><ArchiveRestore size={14} />Restore</Button>}
                  {canDelete && <Button size="sm" variant="danger" disabled={busy} onClick={() => erase(chosen.map((r) => r.id), chosen[0].label)}><Trash2 size={14} />Delete forever</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button>
                </div>
              )}
            </div>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${picked.has(r.id) ? 'bg-accent/5' : ''}`}>
                  <input type="checkbox" aria-label={`Select ${r.label}`} className="h-4 w-4 shrink-0 accent-[var(--color-accent)]"
                    checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-muted">{r.sub}</p>
                  </div>
                  <div className="flex gap-2">
                    {canRestore && <Button size="sm" disabled={busy} onClick={() => restore([r.id])}>
                      <ArchiveRestore size={14} />{tab === 'account' ? 'Restore access' : 'Restore'}
                    </Button>}
                    {canDelete && <Button size="sm" variant="quiet" disabled={busy} onClick={() => erase([r.id], r.label)}>
                      <Trash2 size={14} />Delete forever
                    </Button>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </>
  );
}
