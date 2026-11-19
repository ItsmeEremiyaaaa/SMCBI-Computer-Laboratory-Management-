import { useState } from 'react';
import type { ClassChangeInput, ClassChangeKind, ClassSchedule, Lab, Reservation } from '../../../shared/data/types';
import { LAB_CLOSE, LAB_OPEN } from '../../../shared/time';
import { Alert, Button, Field, fmtDate, fmtTime, Input, Modal, Select, Textarea, toast } from '../../../shared/ui/ui';
import { classChangeProblems } from '../logic/rules';
import { scheduleRepo } from '../data/repository';

const GREETING = 'Good Day!\nPraised Be Jesus and Mary!\n\n';
const KINDS: { kind: ClassChangeKind; label: string; hint: string }[] = [
  { kind: 'cancelled', label: 'Cancelled', hint: 'No class this day. The lab is free to book.' },
  { kind: 'activity', label: 'Activity only', hint: 'Students do an activity instead (no lab). The lab is free.' },
  { kind: 'moved', label: 'Move', hint: 'Hold this meeting on another date, time or lab.' },
];

/** Change one meeting of a weekly class. `session` = the meeting as shown on the calendar; `preset` = what a drag-and-drop suggested. */
export default function ClassChangeModal({ session, preset, schedules, bookings, labs, today, onClose, onDone }: {
  session: Reservation; preset?: Partial<ClassChangeInput>; schedules: ClassSchedule[]; bookings: Reservation[]; labs: Lab[];
  today: string; onClose: () => void; onDone: () => void;
}) {
  const existing = session.class_change;
  const s = schedules.find((x) => x.id === session.schedule_id)!;
  const [f, setF] = useState<ClassChangeInput>({
    schedule_id: s.id, date: session.class_date!, kind: preset?.kind ?? existing?.kind ?? 'cancelled',
    new_date: preset?.new_date ?? existing?.new_date ?? session.class_date!, new_start: preset?.new_start ?? existing?.new_start ?? s.start_time,
    new_end: preset?.new_end ?? existing?.new_end ?? s.end_time, new_lab: preset?.new_lab ?? existing?.new_lab ?? s.lab_id,
    note: existing?.note ?? GREETING,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ClassChangeInput) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const note = f.note?.trim() === GREETING.trim() ? null : f.note?.trim() || null;
  const input: ClassChangeInput = { ...f, note };
  // same check the database runs: a clashing move is denied, with the reason
  const problems = classChangeProblems(input, { schedules, approvedBookings: bookings, today });

  async function save() {
    setBusy(true); setError(null);
    try {
      await scheduleRepo.saveClassChange(input);
      toast(f.kind === 'cancelled' ? 'Class cancelled for that day' : f.kind === 'activity' ? 'Set to activity only' : 'Class moved', `${s.section} ${s.subject} · students are notified`);
      onDone();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function undo() {
    setBusy(true); setError(null);
    try { await scheduleRepo.deleteClassChange(existing!.id); toast('Back to the normal schedule', `${s.section} ${s.subject}`); onDone(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Modal open wide title={`${s.section} ${s.subject}: ${fmtDate(f.date)}`} onClose={onClose}>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:gap-6">
        <div className="grid content-start gap-3">
          <p className="text-sm text-muted">
            Usually {fmtTime(s.start_time)}–{fmtTime(s.end_time)} in {labs.find((l) => l.id === s.lab_id)?.name ?? s.lab_id} · {s.instructor}.
            Only <b>this date</b> changes; the other weeks stay the same. Students of {s.section} are notified.
          </p>
          <div role="radiogroup" aria-label="What happens" className="grid gap-2">
            {KINDS.map((k) => (
              <label key={k.kind} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${f.kind === k.kind ? 'border-accent bg-accent/5' : 'border-line hover:bg-chalk'}`}>
                <input type="radio" name="kind" className="mt-0.5 accent-[var(--color-accent)]" checked={f.kind === k.kind} onChange={() => setF({ ...f, kind: k.kind })} />
                <span><b className={k.kind === 'cancelled' ? 'text-red-700' : ''}>{k.label}</b><span className="block text-xs text-muted">{k.hint}</span></span>
              </label>
            ))}
          </div>
          {f.kind === 'moved' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New date" required><Input type="date" min={today} value={f.new_date ?? ''} onChange={set('new_date')} /></Field>
              <Field label="Lab" required><Select value={f.new_lab ?? ''} onChange={set('new_lab')}>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
              <Field label="Start" required><Input type="time" step={1800} min={LAB_OPEN} max={LAB_CLOSE} value={f.new_start ?? ''} onChange={set('new_start')} /></Field>
              <Field label="End" required><Input type="time" step={1800} min={LAB_OPEN} max={LAB_CLOSE} value={f.new_end ?? ''} onChange={set('new_end')} /></Field>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Note to the students (optional)" hint="Starts with the school greeting. E.g. what to do, or where to go.">
            <Textarea data-autofocus value={f.note ?? ''} onChange={set('note')} rows={7}
              onFocus={(e) => { const end = e.currentTarget.value.length; e.currentTarget.setSelectionRange(end, end); }} />
          </Field>
          {problems.length > 0 && (
            <ul role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-end gap-2">
            {existing && <Button variant="quiet" className="mr-auto" disabled={busy} onClick={undo}>Undo change (back to normal)</Button>}
            <Button variant={f.kind === 'cancelled' ? 'danger' : 'primary'} disabled={busy || problems.length > 0} onClick={save}>
              {busy ? 'Saving…' : f.kind === 'cancelled' ? 'Cancel this meeting' : f.kind === 'activity' ? 'Set activity only' : 'Move this meeting'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
