import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { LivePc } from '../hooks/useLabLive';
import { api } from '../lib/api';
import type { Lab, PcStatus } from '../lib/types';
import { Alert, Button, Field, fmtTime, Input, Led, STATUS_LABEL } from './ui';

const MANUAL: PcStatus[] = ['free', 'in_use', 'broken'];

export default function PcPanel({ pc, lab, canEdit, onClose }: { pc: LivePc; lab: Lab; canEdit: boolean; onClose: () => void }) {
  const [note, setNote] = useState(pc.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(pc.note ?? ''); setError(null); }, [pc.id, pc.note]);

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
                <Button key={s} size="sm" variant={pc.status === s ? 'primary' : 'ghost'} disabled={busy}
                  aria-pressed={pc.status === s} onClick={() => set(s)}>
                  <Led status={s} />{STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
            {pc.shown === 'reserved' && <p className="mt-2 text-xs text-muted">Shown as Reserved while the booking is active.</p>}
          </div>
        </div>
      ) : null}

      <Link to={`/reservations?new=1&lab=${lab.id}&pc=${pc.id}`}
        className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-panel text-sm font-medium hover:bg-chalk">
        Reserve this PC
      </Link>
    </div>
  );
}
