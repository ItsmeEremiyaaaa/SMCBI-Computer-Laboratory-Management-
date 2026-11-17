import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '../auth';
import { useLoad } from '../hooks/useLoad';
import { api, type EventInput } from '../lib/api';
import { classesOn, manilaNow } from '../lib/seat';
import { EVENT_TYPES, type EventType, type LabEvent } from '../lib/types';
import { Alert, Button, Field, fmtDate, fmtTime, Input, Modal, PageHeader, Panel, Select, Textarea } from '../components/ui';

const TYPE_STYLE: Record<EventType, string> = {
  academic: 'bg-blue-50 text-blue-900 border-blue-300',
  personal: 'bg-violet-50 text-violet-900 border-violet-300',
  holiday: 'bg-red-50 text-red-900 border-red-300',
  meeting: 'bg-teal-50 text-teal-900 border-teal-300',
};
const RES_STYLE = 'bg-amber-50 text-amber-900 border-amber-300';

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function Calendar() {
  const { profile } = useAuth();
  const today = manilaNow().date;
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [edit, setEdit] = useState<EventInput | null>(null);
  const events = useLoad(() => api.listEvents());
  const res = useLoad(() => api.listReservations({ status: 'approved' }));
  const labs = useLoad(() => api.listLabs());
  const classes = useLoad(() => api.listSchedules());

  const first = new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay();
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => i - first + 1);
  const monthName = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shift = (n: number) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const labShort = (id: string) => labs.data?.find((l) => l.id === id)?.name.replace('Computer Laboratory', 'Lab') ?? '';
  const canEdit = (e: LabEvent) => e.owner_id === profile?.id || profile?.role === 'admin';

  return (
    <>
      <PageHeader title="Calendar" sub="School events and approved lab bookings."
        actions={<Button onClick={() => setEdit({ title: '', description: null, event_date: today, event_time: '08:00', event_type: 'academic' })}><Plus size={16} />Add event</Button>} />

      <Panel>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-lg font-semibold">{monthName}</h2>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 })}>Today</Button>
            <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></Button>
            <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-line text-center text-xs font-medium text-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const date = d >= 1 && d <= days ? iso(ym.y, ym.m, d) : null;
            const ev = date ? (events.data ?? []).filter((e) => e.event_date === date) : [];
            const rs = date ? [...(res.data ?? []).filter((r) => r.date === date), ...classesOn(date, classes.data ?? [])]
              .sort((a, b) => a.start_time.localeCompare(b.start_time)) : [];
            return (
              <div key={i} className={`min-h-24 border-b border-r border-line p-1.5 sm:min-h-28 ${i % 7 === 6 ? 'border-r-0' : ''} ${date ? '' : 'bg-chalk/60'}`}>
                {date && <>
                  <p className={`mb-1 inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs ${date === today ? 'bg-accent font-semibold text-white' : 'text-muted'}`}>{d}</p>
                  <div className="grid gap-1">
                    {ev.map((e) => (
                      <button key={e.id} onClick={() => canEdit(e) && setEdit(e)} title={e.description ?? e.title}
                        className={`truncate rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] ${TYPE_STYLE[e.event_type]} ${canEdit(e) ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}>
                        {fmtTime(e.event_time).replace(':00', '')} {e.title}
                      </button>
                    ))}
                    {rs.slice(0, 3).map((r) => (
                      <p key={r.id} title={`${r.title}, ${r.requester_name}`} className={`truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] ${RES_STYLE}`}>
                        {fmtTime(r.start_time).replace(':00', '')} {labShort(r.lab_id)}: {r.title}
                      </p>
                    ))}
                    {rs.length > 3 && <p className="px-1.5 text-[11px] text-muted">+{rs.length - 3} more</p>}
                  </div>
                </>}
              </div>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-xs text-muted">
          {EVENT_TYPES.map((t) => <li key={t} className="flex items-center gap-1.5 capitalize"><span className={`h-3 w-3 rounded-sm border-l-2 ${TYPE_STYLE[t]}`} />{t}</li>)}
          <li className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm border-l-2 ${RES_STYLE}`} />Lab booking</li>
        </ul>
      </Panel>

      {edit && <EventModal e={edit} onClose={() => setEdit(null)}
        onDelete={edit.id ? async () => { await api.deleteEvent(edit.id!); setEdit(null); await events.reload(); } : undefined}
        onSave={async (x) => { await api.saveEvent(x); setEdit(null); await events.reload(); }} />}
    </>
  );
}

function EventModal({ e, onClose, onSave, onDelete }:
  { e: EventInput; onClose: () => void; onSave: (x: EventInput) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [f, setF] = useState(e);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof EventInput) => (ev: { target: { value: string } }) => setF({ ...f, [k]: ev.target.value });
  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!f.title.trim() || !f.event_date || !f.event_time) return setError('Title, date and time are required.');
    try { await onSave({ ...f, title: f.title.trim(), description: f.description?.trim() || null }); } catch (err) { setError((err as Error).message); }
  }
  return (
    <Modal open title={e.id ? 'Edit event' : 'Add event'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Title"><Input value={f.title} onChange={set('title')} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date"><Input type="date" value={f.event_date} onChange={set('event_date')} /></Field>
          <Field label="Time"><Input type="time" value={f.event_time} onChange={set('event_time')} /></Field>
          <Field label="Type"><Select value={f.event_type} onChange={set('event_type')} className="capitalize">
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}</Select></Field>
        </div>
        <Field label="Description"><Textarea value={f.description ?? ''} onChange={set('description')} rows={3} /></Field>
        {e.id && <p className="text-xs text-muted">Scheduled {fmtDate(e.event_date)}.</p>}
        <div className="flex justify-between gap-2">
          {onDelete ? <Button type="button" variant="quiet" onClick={() => confirm('Delete this event?') && onDelete()}>Delete event</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Save event</Button></div>
        </div>
      </form>
    </Modal>
  );
}
