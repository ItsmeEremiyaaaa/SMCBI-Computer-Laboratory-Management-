import { useState, type FormEvent } from 'react';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import { manilaNow } from '../lib/seat';
import { bookingProblems, STUDENT_LAB } from '../lib/rules';
import type { ClassSchedule, Lab, Pc, Reservation, ReservationInput, Role } from '../lib/types';
import { validateReservation } from '../lib/validate';
import { Alert, Button, Field, Input, Select, Textarea } from './ui';

interface Props {
  labs: Lab[];
  pcs: Pc[];
  initial?: Partial<ReservationInput>;
  onSubmit: (input: ReservationInput) => Promise<void>;
  onCancel: () => void;
  role: Role;
  /** All approved bookings and the class timetable, to refuse clashes before sending. */
  approved: Reservation[];
  schedules: ClassSchedule[];
}

export default function ReservationForm({ labs: allLabs, pcs, initial, onSubmit, onCancel, role, approved, schedules }: Props) {
  const student = role === 'student';
  const labs = student ? allLabs.filter((l) => l.id === STUDENT_LAB) : allLabs;
  const [f, setF] = useState({
    title: '', purpose: '', date: '', start_time: '', end_time: '', participants: '', requirements: '', section: '', teacher: '',
    lab_id: (student ? STUDENT_LAB : initial?.lab_id) ?? labs[0]?.id ?? '',
    pc_id: initial?.pc_id && pcs.find((p) => p.id === initial.pc_id)?.status !== 'broken' ? initial.pc_id : '',
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
      ...(f.section ? { section: f.section } : {}),
      ...(f.teacher ? { requester_id: f.teacher } : {}),
    };
    const errs = [...validateReservation(input, manilaNow().date),
      ...bookingProblems(input, { role, pcs, reservations: approved, schedules })];
    setErrors(errs); setServerError(null);
    if (errs.length) return;
    setBusy(true);
    try { await onSubmit(input); } catch (err) { setServerError((err as Error).message); } finally { setBusy(false); }
  }

  const labPcs = pcs.filter((p) => p.lab_id === f.lab_id);
  // admins book on behalf of a teacher account
  const teachers = useLoad(() => (role === 'admin' ? api.listProfiles('teacher').catch(() => []) : Promise.resolve([])), [role]);
  const teacherList = (teachers.data ?? []).filter((t) => t.approved && !t.archived_at).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const sections = [...new Set(schedules.map((c) => c.section.trim()).filter(Boolean))].sort();
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      {serverError && <Alert>{serverError}</Alert>}
      {errors.length > 0 && (
        <ul className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errors.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {/* where & who */}
        <div className="grid content-start gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lab" required>
              <Select value={f.lab_id} onChange={(e) => setF({ ...f, lab_id: e.target.value, pc_id: '' })}>
                {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </Select>
            </Field>
            <Field label="Seat" required={student}>
              <Select value={f.pc_id} onChange={set('pc_id')}>
                <option value="">{student ? 'Choose a PC' : 'Whole lab (class)'}</option>
                {labPcs.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.status === 'broken'}>{p.label}{p.status === 'broken' ? ' — broken' : ''}</option>
                ))}
              </Select>
            </Field>
          </div>
          {role === 'admin' && (
            <Field label="Teacher" hint="Who asked for this booking. It is filed under them and students see their name.">
              <Select value={f.teacher} onChange={set('teacher')}>
                <option value="">Me (admin)</option>
                {teacherList.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </Select>
            </Field>
          )}
          {!student && sections.length > 0 && (
            <Field label="For class" hint="Students of this section get a notification about this booking.">
              <Select value={f.section} onChange={set('section')}>
                <option value="">No class / not for students</option>
                {sections.map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <Field label="Participants"><Input type="number" min={1} value={f.participants} onChange={set('participants')} /></Field>
            <Field label="Requirements"><Input value={f.requirements} onChange={set('requirements')} placeholder="Software, internet, projector…" /></Field>
          </div>
        </div>
        {/* what & when */}
        <div className="grid content-start gap-4">
          <Field label="Title" required><Input value={f.title} onChange={set('title')} placeholder={student ? 'e.g. Packet Tracer practice' : 'e.g. Programming 2, BSIT 1A'} /></Field>
          <Field label="Purpose" required><Textarea value={f.purpose} onChange={set('purpose')} rows={2} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date" required><Input type="date" value={f.date} onChange={set('date')} min={manilaNow().date} /></Field>
            <Field label="Start time" required><Input type="time" value={f.start_time} onChange={set('start_time')} /></Field>
            <Field label="End time" required><Input type="time" value={f.end_time} onChange={set('end_time')} /></Field>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <p className="mr-auto text-xs text-muted"><span className="text-broken">*</span> required</p>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button>
      </div>
    </form>
  );
}
