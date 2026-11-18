import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { LivePc } from '../hooks/useLabLive';
import { useAuth } from '../auth';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import { STUDENT_LAB } from '../lib/rules';
import type { Lab, PcStatus } from '../lib/types';
import { Alert, Button, Field, fmtTime, Input, Led, STATUS_LABEL } from './ui';

const MANUAL: PcStatus[] = ['free', 'in_use', 'broken'];

export default function PcPanel({ pc, lab, canEdit, onClose }: { pc: LivePc; lab: Lab; canEdit: boolean; onClose: () => void }) {
  const [note, setNote] = useState(pc.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(pc.note ?? ''); setError(null); }, [pc.id, pc.note]);
  const { profile } = useAuth();
  const checkIns = useLoad(() => api.listCheckIns(lab.id).catch(() => []), [lab.id, pc.id]);
  const here = checkIns.data?.find((c) => c.pc_id === pc.id);
  const canReserve = pc.status !== 'broken' && (profile?.role !== 'student' || lab.id === STUDENT_LAB);

  async function set(status: PcStatus) {
    setBusy(true); setError(null);
    try { await api.setPcStatus(pc.id, status, note.trim() || null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
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
      {here && profile?.role !== 'student' && (
        <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <span className="text-muted">Checked in:</span> <b>{here.user_name}</b>
          <span className="text-muted"> since {new Date(here.checked_in_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
        </p>
      )}
      {pc.note && !canEdit && <p className="text-sm"><span className="text-muted">Note:</span> {pc.note}</p>}

      {canEdit ? (
        <div className="grid gap-3">
          {error && <Alert>{error}</Alert>}
          <Field label="Note" hint="Shown to everyone, e.g. “No display”">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">Set status</p>
            <div className="grid grid-cols-3 gap-2">
              {MANUAL.map((s) => (
                <Button key={s} size="sm" variant={pc.shown === s ? 'primary' : 'ghost'} disabled={busy}
                  aria-pressed={pc.shown === s} onClick={() => set(s)}>
                  <Led status={s} />{STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
            {pc.shown === 'reserved' && <p className="mt-2 text-xs text-muted">Reserved for a student who is arriving or booked it.</p>}
            {pc.shown !== pc.status && pc.shown !== 'reserved' && pc.status !== 'broken' && (
              <p className="mt-2 text-xs text-muted">
                {pc.shown === 'in_use' ? 'Set automatically: a student is sitting here now.' : 'Set automatically: nobody is sitting here now.'}
                {' '}Use Broken if it stops working.
              </p>
            )}
          </div>
        </div>
      ) : null}

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
