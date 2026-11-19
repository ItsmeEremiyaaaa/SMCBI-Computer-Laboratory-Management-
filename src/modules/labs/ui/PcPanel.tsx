import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Wrench, X } from 'lucide-react';
import type { LivePc } from '../hooks/useLabLive';
import { useAuth } from '../../auth/hooks/auth';
import { useLoad } from '../../../shared/hooks/useLoad';
import { bookingsRepo } from '../../bookings/data/repository';
import { labsRepo } from '../data/repository';
import { reportsRepo } from '../../reports/data/repository';
import { STUDENT_LAB } from '../../bookings/logic/rules';
import ReportProblem from '../../reports/ui/ReportProblem';
import type { Lab, PcStatus } from '../../../shared/data/types';
import { Alert, Button, Field, fmtDate, fmtTime, Input, Led, STATUS_LABEL, toast } from '../../../shared/ui/ui';
import { manilaNow } from '../../../shared/time';

const MANUAL: PcStatus[] = ['free', 'in_use', 'maintenance', 'broken'];

export default function PcPanel({ pc, lab, canEdit, onClose }: { pc: LivePc; lab: Lab; canEdit: boolean; onClose: () => void }) {
  const [note, setNote] = useState(pc.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(pc.note ?? ''); setError(null); }, [pc.id, pc.note]);
  const { profile } = useAuth();
  const checkIns = useLoad(() => labsRepo.listCheckIns(lab.id).catch(() => []), [lab.id, pc.id]);
  const here = checkIns.data?.find((c) => c.pc_id === pc.id);
  const canReserve = pc.status !== 'broken' && (profile?.role !== 'student' || lab.id === STUDENT_LAB);
  const isStaff = profile?.role === 'admin' || profile?.role === 'staff';
  const upcoming = useLoad(() => bookingsRepo.listReservations({ status: 'approved', labId: lab.id }).catch(() => []), [lab.id, pc.id]);
  const nowM = manilaNow();
  const next = (upcoming.data ?? []).filter((r) => (r.pc_id === pc.id || r.pc_id === null) && r.id !== pc.current?.id
    && (r.date > nowM.date || (r.date === nowM.date && nowM.time < r.start_time)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)).slice(0, 4);
  const reports = useLoad(() => (profile?.role === 'student' ? Promise.resolve([]) : reportsRepo.listReports({ labId: lab.id }).catch(() => [])), [lab.id, pc.id, pc.status]);
  const open = (reports.data ?? []).filter((r) => r.pc_id === pc.id);
  async function resolve(id: string, action: 'broken' | 'dismissed') {
    setBusy(true); setError(null);
    try { await reportsRepo.resolveReport(id, action); toast(action === 'broken' ? `${pc.label} marked broken` : 'Report dismissed'); await reports.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function set(status: PcStatus) {
    setBusy(true); setError(null);
    try { await labsRepo.setPcStatus(pc.id, status, note.trim() || null); toast(`${pc.label} set to ${STATUS_LABEL[status]}`); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{lab.name}</p>
          <h2 className="font-cond text-2xl font-semibold">{pc.label}</h2>
        </div>
        <button onClick={onClose} aria-label="Close PC details" className="rounded p-1 text-muted hover:bg-chalk"><X size={18} /></button>
      </div>

      <div className="flex items-center gap-2.5 text-lg font-medium">
        <Led status={pc.shown} className="!h-3 !w-3" />{STATUS_LABEL[pc.shown]}
      </div>

      {pc.current && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium">{pc.current.title}</p>
          <p className="text-muted">{pc.current.requester_name}, {fmtTime(pc.current.start_time)} to {fmtTime(pc.current.end_time)}</p>
          <p className="text-muted">{pc.current.pc_id ? 'This PC is booked' : 'Whole lab is booked'}</p>
        </div>
      )}
      {next.length > 0 && (
        <div className="rounded-md border border-line p-3 text-sm">
          <p className="mb-1 font-semibold">Upcoming bookings</p>
          <ul className="grid gap-1">
            {next.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <span><b className="font-medium">{fmtDate(r.date)}, {fmtTime(r.start_time)}–{fmtTime(r.end_time)}</b>
                  <span className="block text-muted">{r.requester_name}{r.pc_id ? '' : ' · whole lab'} · {r.title}</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {here && profile?.role !== 'student' && (
        <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <span className="text-muted">Checked in:</span> <b>{here.user_name}</b>
          <span className="text-muted"> since {new Date(here.checked_in_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
        </p>
      )}
      {open.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-900">{open.length} problem report{open.length > 1 ? 's' : ''}</p>
          <ul className="mt-1 grid gap-1.5">
            {open.map((r) => (
              <li key={r.id}>
                <b>{r.problem}</b>{r.note && <> — {r.note}</>}
                <span className="block text-xs text-amber-800/80">{r.user_name}, {new Date(r.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
          {isStaff && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="danger" disabled={busy} onClick={() => resolve(open[0].id, 'broken')}>Mark broken</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => resolve(open[0].id, 'dismissed')}>Dismiss</Button>
            </div>
          )}
        </div>
      )}
      {pc.note && !canEdit && <p className="text-sm"><span className="text-muted">Note:</span> {pc.note}</p>}

      {canEdit ? (
        <div className="grid gap-3.5">
          {error && <Alert>{error}</Alert>}

          {/* One-Click Maintenance Quick Action Button */}
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-violet-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-violet-900">
                  {pc.status === 'maintenance' ? 'Under Maintenance' : 'Quick Maintenance'}
                </span>
              </div>
              {pc.status === 'maintenance' && (
                <span className="rounded-full bg-violet-200/80 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                  Active
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-violet-800/80 leading-relaxed">
              {pc.status === 'maintenance'
                ? 'This workstation is undergoing scheduled servicing. Click below to complete maintenance and restore it to Free.'
                : 'Quickly take this computer offline for hardware diagnostics, software updates, or desk cleaning with one click.'}
            </p>
            <div className="mt-2.5">
              {pc.status === 'maintenance' ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => set('free')}
                  className="w-full justify-center !bg-emerald-600 hover:!bg-emerald-700 !text-white font-semibold py-2 shadow-xs transition-all active:scale-[0.98]"
                >
                  <CheckCircle2 size={15} /> Complete Maintenance (Set Free)
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busy}
                  onClick={() => set('maintenance')}
                  className="w-full justify-center !bg-violet-600 hover:!bg-violet-700 !text-white font-semibold py-2 shadow-xs transition-all active:scale-[0.98]"
                >
                  <Wrench size={15} /> One-Click Maintenance
                </Button>
              )}
            </div>
          </div>

          <Field label="Note" hint="Shown to everyone, e.g. “No display”">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">Set status</p>
            <div className="grid grid-cols-2 gap-1.5">
              {MANUAL.map((s) => (
                <Button key={s} size="sm" variant={pc.shown === s ? 'primary' : 'ghost'} disabled={busy}
                  aria-pressed={pc.shown === s} onClick={() => set(s)} className="text-xs">
                  <Led status={s} />{STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
            {pc.shown === 'reserved' && <p className="mt-2 text-xs text-muted">Reserved for a student who is arriving or booked it.</p>}
            {pc.shown === 'maintenance' && <p className="mt-2 text-xs text-violet-700 font-medium">Workstation is flagged under maintenance.</p>}
            {pc.shown !== pc.status && pc.shown !== 'reserved' && pc.status !== 'broken' && pc.status !== 'maintenance' && (
              <p className="mt-2 text-xs text-muted">
                {pc.shown === 'in_use' ? 'Set automatically: a student is sitting here now.' : 'Set automatically: nobody is sitting here now.'}
                {' '}Use Broken or Maintenance if it stops working.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {!isStaff && pc.status !== 'broken' && <ReportProblem pcId={pc.id} pcLabel={pc.label} onDone={reports.reload} />}
      {canReserve ? (
        <Link to={`/reservations?new=1&lab=${lab.id}&pc=${pc.id}`}
          className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-panel text-sm font-medium hover:bg-chalk">
          Reserve this PC
        </Link>
      ) : (
        <p className="rounded-md bg-chalk px-3 py-2 text-center text-sm text-muted">
          {pc.status === 'broken' ? "This PC is broken, so it can't be reserved." : 'Students can book PCs in the Networking Laboratory only.'}
        </p>
      )}
    </div>
  );
}
