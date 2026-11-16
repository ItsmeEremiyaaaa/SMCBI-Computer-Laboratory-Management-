import { useState, type FormEvent } from 'react';
import { manilaNow } from '../lib/seat';
import type { Lab, Pc, ReservationInput } from '../lib/types';
import { validateReservation } from '../lib/validate';
import { Alert, Button, Field, Input, Select, Textarea } from './ui';

interface Props {
  labs: Lab[];
  pcs: Pc[];
  initial?: Partial<ReservationInput>;
  onSubmit: (input: ReservationInput) => Promise<void>;
  onCancel: () => void;
}

export default function ReservationForm({ labs, pcs, initial, onSubmit, onCancel }: Props) {
  const [f, setF] = useState({
    title: '', purpose: '', date: '', start_time: '', end_time: '', participants: '', requirements: '',
    lab_id: initial?.lab_id ?? labs[0]?.id ?? '', pc_id: initial?.pc_id ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input: ReservationInput = {
      title: f.title.trim(), purpose: f.purpose.trim(), lab_id: f.lab_id, pc_id: f.pc_id || null,
      date: f.date, start_time: f.start_time, end_time: f.end_time,
      participants: f.participants ? Number(f.participants) : null, requirements: f.requirements.trim() || null,
    };
    const errs = validateReservation(input, manilaNow().date);
    setErrors(errs); setServerError(null);
    if (errs.length) return;
    setBusy(true);
    try { await onSubmit(input); } catch (err) { setServerError((err as Error).message); } finally { setBusy(false); }
  }

  const labPcs = pcs.filter((p) => p.lab_id === f.lab_id);
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {serverError && <Alert>{serverError}</Alert>}
      {errors.length > 0 && (
        <ul className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errors.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Lab">
          <Select value={f.lab_id} onChange={(e) => setF({ ...f, lab_id: e.target.value, pc_id: '' })}>
            {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </Field>
        <Field label="Seat">
          <Select value={f.pc_id} onChange={set('pc_id')}>
            <option value="">Whole lab (class)</option>
            {labPcs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Title"><Input value={f.title} onChange={set('title')} placeholder="e.g. Programming 2, BSIT 1A" /></Field>
      <Field label="Purpose"><Textarea value={f.purpose} onChange={set('purpose')} rows={2} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date"><Input type="date" value={f.date} onChange={set('date')} min={manilaNow().date} /></Field>
        <Field label="Start time"><Input type="time" value={f.start_time} onChange={set('start_time')} /></Field>
        <Field label="End time"><Input type="time" value={f.end_time} onChange={set('end_time')} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
        <Field label="Participants"><Input type="number" min={1} value={f.participants} onChange={set('participants')} /></Field>
        <Field label="Requirements"><Input value={f.requirements} onChange={set('requirements')} placeholder="Software, internet, projector…" /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button>
      </div>
    </form>
  );
}
