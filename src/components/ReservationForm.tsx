import { useState, type FormEvent } from 'react';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import { manilaNow } from '../lib/seat';
import { bookingProblems, nameKey, sectionSize, STUDENT_LAB } from '../lib/rules';
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

const NEEDS = ['HDMI', 'Laptops', 'Projector', 'Projector tarpaulin'];

export default function ReservationForm({ labs: allLabs, pcs, initial, onSubmit, onCancel, role, approved, schedules }: Props) {
  const student = role === 'student';
  const labs = student ? allLabs.filter((l) => l.id === STUDENT_LAB) : allLabs;
  const [f, setF] = useState({
    title: '', purpose: '', date: '', start_time: '', end_time: '', participants: '', requirements: '', section: '', teacher: '', needs: [] as string[],
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
      participants: f.participants ? Number(f.participants) : null,
      requirements: [...f.needs, ...(f.requirements.trim() ? [f.requirements.trim()] : [])].join(', ') || null,
      ...(f.section ? { section: f.section } : {}),
      // 'id:<account>' = a teacher with an account; 'name:<instructor>' = on the schedule, no account yet
      ...(f.teacher.startsWith('id:') ? { requester_id: f.teacher.slice(3) } : f.teacher.startsWith('name:') ? { requester_name: f.teacher.slice(5) } : {}),
    };
    const errs = [...(role === 'admin' && !f.teacher ? ['Choose the teacher who asked for this booking (or “No teacher”).'] : []),
      ...validateReservation(input, manilaNow().date),
      ...bookingProblems(input, { role, pcs, reservations: approved, schedules })];
    setErrors(errs); setServerError(null);
    if (errs.length) return;
    setBusy(true);
    try { await onSubmit(input); } catch (err) { setServerError((err as Error).message); } finally { setBusy(false); }
  }

  const labPcs = pcs.filter((p) => p.lab_id === f.lab_id);
  // participants: the chosen section's size, up to the lab's seats
  const sizes = useLoad(() => (student ? Promise.resolve([]) : api.sectionSizes().catch(() => [])), [student]);
  const classSize = f.section ? sectionSize(sizes.data ?? [], f.section) : 0;
  const maxPeople = Math.max(classSize, f.pc_id ? 1 : labPcs.length, 1);
  const toggleNeed = (n: string) => setF({ ...f, needs: f.needs.includes(n) ? f.needs.filter((x) => x !== n) : [...f.needs, n] });
  const allNeeds = NEEDS.every((n) => f.needs.includes(n));
  // admins book on behalf of a teacher: accounts, plus instructors on the class schedule who haven't signed up yet
  const teachers = useLoad(() => (role === 'admin' ? api.listProfiles('teacher').catch(() => []) : Promise.resolve([])), [role]);
  const accounts = (teachers.data ?? []).filter((t) => t.approved && !t.archived_at).sort((a, b) => a.full_name.localeCompare(b.full_name));
  const known = new Set(accounts.map((t) => nameKey(t.full_name)));
  const instructors = [...new Map(schedules.filter((c) => c.instructor?.trim() && !known.has(nameKey(c.instructor)))
    .map((c) => [nameKey(c.instructor), c.instructor.trim()])).values()].sort();
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
            <Field label="Teacher" required hint="Who asked for this booking. Students see this name.">
              <Select value={f.teacher} onChange={set('teacher')}>
                <option value="" disabled>Choose the teacher…</option>
                {accounts.length > 0 && <optgroup label="Teachers with an account">
                  {accounts.map((t) => <option key={t.id} value={`id:${t.id}`}>{t.full_name}</option>)}
                </optgroup>}
                {instructors.length > 0 && <optgroup label="On the class schedule (no account yet)">
                  {instructors.map((n) => <option key={n} value={`name:${n}`}>{n}</option>)}
                </optgroup>}
                <option value="self">No teacher (lab office booking)</option>
              </Select>
            </Field>
          )}
          {!student && sections.length > 0 && (
            <Field label="For class" hint="Students of this section get a notification about this booking.">
              <Select value={f.section} onChange={(e) => {
                const n = e.target.value ? sectionSize(sizes.data ?? [], e.target.value) : 0;
                setF({ ...f, section: e.target.value, participants: n ? String(n) : f.participants });
              }}>
                <option value="">No class / not for students</option>
                {sections.map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <Field label="Participants">
              <Select value={f.participants} onChange={set('participants')}>
                <option value="">—</option>
                {Array.from({ length: maxPeople }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n === classSize ? `${n} (whole class)` : n}</option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">Requirements</span>
                <button type="button" onClick={() => setF({ ...f, needs: allNeeds ? [] : [...NEEDS] })} className="text-xs font-medium text-accent hover:underline">
                  {allNeeds ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Requirements">
                {NEEDS.map((n) => {
                  const on = f.needs.includes(n);
                  return (
                    <button key={n} type="button" aria-pressed={on} onClick={() => toggleNeed(n)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? 'border-accent bg-accent text-white' : 'border-line bg-panel text-ink hover:border-accent'}`}>
                      {on ? '✓ ' : ''}{n}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <Field label="Other needs"><Input value={f.requirements} onChange={set('requirements')} placeholder="Software, internet…" /></Field>
        </div>
        {/* what & when */}
        <div className="grid content-start gap-4">
          <Field label="Title" required><Input value={f.title} onChange={set('title')} placeholder={student ? 'e.g. Packet Tracer practice' : 'e.g. Programming 2, BSIT 1A'} /></Field>
          <Field label="Purpose" required><Textarea value={f.purpose} onChange={set('purpose')} rows={2} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date" required><Input type="date" value={f.date} onChange={set('date')} min={manilaNow().date} /></Field>
            <Field label="Start time" required hint="Labs open 8 AM – 8 PM"><Input type="time" min="08:00" max="20:00" value={f.start_time} onChange={set('start_time')} /></Field>
            <Field label="End time" required><Input type="time" min="08:00" max="20:00" value={f.end_time} onChange={set('end_time')} /></Field>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <p className="mr-auto text-xs text-muted"><span className="text-broken">*</span> required</p>
        <Button disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Button>
      </div>
    </form>
  );
}
