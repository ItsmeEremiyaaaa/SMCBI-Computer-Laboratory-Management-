import { useState } from 'react';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import type { ArchiveKind } from '../lib/types';
import { Alert, Button, Empty, PageHeader, Panel } from '../components/ui';

const KINDS: { kind: ArchiveKind | 'account' | 'report'; label: string }[] = [
  { kind: 'student', label: 'Student records' },
  { kind: 'account', label: 'Accounts' },
  { kind: 'reservation', label: 'Bookings' },
  { kind: 'event', label: 'Calendar events' },
  { kind: 'class', label: 'Classes' },
  { kind: 'report', label: 'Handled reports' },
];
const when = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// Everything "deleted" lands here. Admins restore it, or erase it for good.
export default function Archive() {
  const [tab, setTab] = useState<(typeof KINDS)[number]['kind']>('student');
  const items = useLoad(() => api.listArchive());
  const accounts = useLoad(() => api.listProfiles().then((ps) => ps.filter((p) => p.archived_at)));
  const reports = useLoad(() => api.listReports({ all: true }).then((rs) => rs.filter((r) => r.resolved_at)).catch(() => []));
  const pcs = useLoad(() => api.listPcs());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, fn: () => Promise<void>, reload: () => Promise<void>) {
    setBusy(id); setError(null);
    try { await fn(); await reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  const count = (k: (typeof KINDS)[number]['kind']) =>
    k === 'account' ? accounts.data?.length ?? 0 : k === 'report' ? reports.data?.length ?? 0 : (items.data ?? []).filter((i) => i.kind === k).length;
  const pcLabel = (id: string) => pcs.data?.find((p) => p.id === id)?.label ?? id;

  return (
    <>
      <PageHeader title="Archive" sub="Deleted records and archived accounts. Restore anything, or delete it for good." />
      <nav className="mb-4 flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1" aria-label="Archive type">
        {KINDS.map((k) => (
          <button key={k.kind} onClick={() => setTab(k.kind)} aria-pressed={tab === k.kind}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${tab === k.kind ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}>
            {k.label}<span className={`rounded-full px-1.5 text-xs ${tab === k.kind ? 'bg-white/25' : 'bg-chalk'}`}>{count(k.kind)}</span>
          </button>
        ))}
      </nav>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Panel>
        {tab === 'account' ? (
          !accounts.data?.length ? <Empty>{accounts.loading ? 'Loading…' : 'No archived accounts.'}</Empty> : (
            <ul className="divide-y divide-line">
              {accounts.data.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.full_name} <span className="text-sm font-normal capitalize text-muted">· {p.role}</span></p>
                    <p className="truncate text-sm text-muted">{p.email} · archived {when(p.archived_at!)}</p>
                  </div>
                  <Button size="sm" disabled={busy === p.id} onClick={() => act(p.id, () => api.setAccountArchived(p.id, false), accounts.reload)}>
                    <ArchiveRestore size={14} />Restore access
                  </Button>
                </li>
              ))}
            </ul>
          )
        ) : tab === 'report' ? (
          !reports.data?.length ? <Empty>{reports.loading ? 'Loading…' : 'No handled reports yet.'}</Empty> : (
            <ul className="divide-y divide-line">
              {reports.data.map((r) => (
                <li key={r.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{pcLabel(r.pc_id)}: {r.problem}{r.note && <span className="font-normal text-muted"> — {r.note}</span>}</p>
                  <p className="text-muted">
                    Reported by {r.user_name}, {when(r.created_at)} ·{' '}
                    <span className={r.resolution === 'broken' ? 'font-medium text-red-700' : ''}>{r.resolution === 'broken' ? 'Marked broken' : 'Dismissed'}</span>{' '}
                    {when(r.resolved_at!)}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : (() => {
          const list = (items.data ?? []).filter((i) => i.kind === tab);
          return !list.length ? <Empty>{items.loading ? 'Loading…' : 'Nothing here.'}</Empty> : (
            <ul className="divide-y divide-line">
              {list.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.label}</p>
                    <p className="text-sm text-muted">Deleted {when(i.archived_at)}{i.archived_by_name && ` by ${i.archived_by_name}`}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === i.id} onClick={() => act(i.id, () => api.restoreArchived(i.id), items.reload)}>
                      <ArchiveRestore size={14} />Restore
                    </Button>
                    <Button size="sm" variant="quiet" disabled={busy === i.id}
                      onClick={() => confirm(`Delete "${i.label}" for good? This can't be undone.`) && act(i.id, () => api.purgeArchived(i.id), items.reload)}>
                      <Trash2 size={14} />Delete forever
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          );
        })()}
      </Panel>
    </>
  );
}
