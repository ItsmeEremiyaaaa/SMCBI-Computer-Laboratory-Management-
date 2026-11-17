import { useEffect, useState, type FormEvent } from 'react';
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../auth';
import { useLoad } from '../hooks/useLoad';
import { api } from '../lib/api';
import { isoWeekday, manilaNow } from '../lib/seat';
import type { ClassSchedule, Lab, ScheduleInput } from '../lib/types';
import { validateSchedule } from '../lib/validate';
import { Alert, Button, Empty, Field, fmtDate, fmtTime, Input, Modal, PageHeader, Panel, Select } from '../components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const short = (lab?: Lab) => lab?.name.replace('Computer Laboratory', 'Lab') ?? '';

export default function Schedule() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const labs = useLoad(() => api.listLabs());
  const list = useLoad(() => api.listSchedules());
  const [edit, setEdit] = useState<ScheduleInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => api.subscribeReservations(list.reload), [list.reload]);

  const today = manilaNow();
  const todayDow = isoWeekday(today.date);
  const rows = list.data ?? [];
  const days = DAYS.map((name, i) => ({ name, dow: i + 1 })).filter((d) => d.dow <= 5 || rows.some((r) => r.day_of_week === d.dow));
  const first = rows.reduce((a, r) => (r.starts_on < a ? r.starts_on : a), rows[0]?.starts_on ?? '');
  const last = rows.reduce((a, r) => (r.ends_on > a ? r.ends_on : a), rows[0]?.ends_on ?? '');
  const live = (r: ClassSchedule) => r.day_of_week === todayDow && r.starts_on <= today.date && today.date <= r.ends_on &&
    r.start_time <= today.time && today.time < r.end_time;

  async function remove(r: ClassSchedule) {
    if (!confirm(`Remove ${r.section} ${r.subject} on ${DAYS[r.day_of_week - 1]}s?`)) return;
    try { await api.deleteSchedule(r.id); await list.reload(); } catch (e) { setError((e as Error).message); }
  }

  const blank = (): ScheduleInput => ({
    lab_id: labs.data?.[0]?.id ?? '', section: '', subject: '', instructor: '', day_of_week: 1,
    start_time: '09:00', end_time: '12:00', starts_on: first || today.date, ends_on: last || today.date,
  });

  return (
    <>
      <PageHeader title="Class schedule"
        sub={<>Regular weekly lab classes for AY 2026–2027, second semester{first && <> ({fmtDate(first)} to {fmtDate(last)})</>}.
          Labs show as Reserved during these hours and can’t be booked over them.</>}
        actions={isAdmin && labs.data && <Button onClick={() => setEdit(blank())}><Plus size={16} />Add class</Button>} />

      {(error || list.error) && <div className="mb-4"><Alert>{error || list.error}</Alert></div>}

      {rows.length === 0 ? <Panel><Empty>{list.loading ? 'Loading…' : 'No classes yet.'}</Empty></Panel> : (
        <div className="grid gap-4">
          {days.map((d) => {
            const dayRows = rows.filter((r) => r.day_of_week === d.dow);
            return (
              <Panel key={d.dow} title={d.name} icon={CalendarClock}
                actions={d.dow === todayDow && <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-[#7a5d0d]">Today</span>}>
                <div className="grid gap-px overflow-hidden rounded-b-lg bg-line md:grid-cols-3">
                  {labs.data?.map((l) => {
                    const cell = dayRows.filter((r) => r.lab_id === l.id).sort((a, b) => a.start_time.localeCompare(b.start_time));
                    return (
                      <div key={l.id} className="bg-panel p-3">
                        <p className="mb-2 text-xs font-semibold tracking-wide text-muted">{short(l)}</p>
                        {cell.length === 0 ? <p className="py-2 text-sm text-muted/70">No classes, open for booking</p> : (
                          <ul className="grid gap-2">
                            {cell.map((r) => (
                              <li key={r.id} className={`group relative rounded-md border-l-4 px-3 py-2 text-sm ${live(r) ? 'border-reserved bg-amber-50' : 'border-accent bg-accent-soft/60'}`}>
                                <p className="font-cond font-semibold text-rail">
                                  {fmtTime(r.start_time)} to {fmtTime(r.end_time)}
                                  {live(r) && <span className="ml-2 text-xs font-medium text-amber-700">In session</span>}
                                </p>
                                <p className="font-medium">{r.section}</p>
                                <p className="text-muted">{r.subject}</p>
                                {r.instructor && <p className="text-xs text-muted">{r.instructor}</p>}
                                {isAdmin && (
                                  <div className="absolute right-1.5 top-1.5 flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                    <button onClick={() => setEdit(r)} aria-label={`Edit ${r.section} ${r.subject}`} className="rounded p-1 text-muted hover:bg-white hover:text-ink"><Pencil size={14} /></button>
                                    <button onClick={() => remove(r)} aria-label={`Remove ${r.section} ${r.subject}`} className="rounded p-1 text-muted hover:bg-white hover:text-broken"><Trash2 size={14} /></button>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {edit && labs.data && <ScheduleModal s={edit} labs={labs.data} onClose={() => setEdit(null)}
        onSave={async (x) => { await api.saveSchedule(x); setEdit(null); await list.reload(); }} />}
    </>
  );
}

function ScheduleModal({ s, labs, onClose, onSave }:
  { s: ScheduleInput; labs: Lab[]; onClose: () => void; onSave: (x: ScheduleInput) => Promise<void> }) {
  const [f, setF] = useState(s);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ScheduleInput) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: k === 'day_of_week' ? Number(e.target.value) : e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    const x = { ...f, section: f.section.trim(), subject: f.subject.trim(), instructor: f.instructor.trim() };
    const errs = validateSchedule(x);
    if (errs.length) return setError(errs.join(' '));
    try { await onSave(x); } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal open title={s.id ? 'Edit class' : 'Add class'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Section"><Input value={f.section} onChange={set('section')} placeholder="BSIT 1A" /></Field>
          <Field label="Lab"><Select value={f.lab_id} onChange={set('lab_id')}>{labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>
        </div>
        <Field label="Subject"><Input value={f.subject} onChange={set('subject')} placeholder="IT121 Computer Programming 2" /></Field>
        <Field label="Instructor"><Input value={f.instructor} onChange={set('instructor')} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Day"><Select value={f.day_of_week} onChange={set('day_of_week')}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</Select></Field>
          <Field label="Start time"><Input type="time" value={f.start_time} onChange={set('start_time')} /></Field>
          <Field label="End time"><Input type="time" value={f.end_time} onChange={set('end_time')} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First day"><Input type="date" value={f.starts_on} onChange={set('starts_on')} /></Field>
          <Field label="Last day"><Input type="date" value={f.ends_on} onChange={set('ends_on')} /></Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Save class</Button></div>
      </form>
    </Modal>
  );
}
