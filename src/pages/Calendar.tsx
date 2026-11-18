import { useState, type FormEvent, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import { useAuth } from '../auth';
import { useLoad } from '../hooks/useLoad';
import { api, type EventInput } from '../lib/api';
import { classesOn, manilaNow } from '../lib/seat';
import { EVENT_TYPES, type EventType, type LabEvent, type Reservation } from '../lib/types';
import { Alert, Button, Field, fmtDate, fmtTime, Input, Modal, PageHeader, Panel, Select, Textarea, askConfirm } from '../components/ui';

const TYPE_STYLE: Record<EventType, string> = {
  academic: 'bg-blue-50 text-blue-900 border-blue-400',
  personal: 'bg-violet-50 text-violet-900 border-violet-400',
  holiday: 'bg-red-50 text-red-900 border-red-400',
  meeting: 'bg-teal-50 text-teal-900 border-teal-400',
};
const TYPE_DOT: Record<EventType, string> = { academic: 'bg-blue-500', personal: 'bg-violet-500', holiday: 'bg-red-500', meeting: 'bg-teal-500' };
// One colour per lab, in lab order (ComLab 1, ComLab 2, NetLab).
const LAB_COLORS = ['#2563eb', '#ea580c', '#059669', '#7c3aed'];

const DAY_START = 7; // timeline 7:00 AM – 9:00 PM
const DAY_END = 21;
const HOUR_PX = 44;

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const hours = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;
const isClass = (r: Reservation) => r.id.startsWith('class-');

export default function Calendar() {
  const { profile } = useAuth();
  const now = manilaNow();
  const today = now.date;
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [day, setDay] = useState(today);
  const [edit, setEdit] = useState<EventInput | null>(null);
  const events = useLoad(() => api.listEvents());
  const res = useLoad(() => api.listReservations({ status: 'approved' }));
  // cancelled bookings stay on the day view, red and crossed out, so nobody shows up for them
  const cancelled = useLoad(() => api.listReservations({ status: 'cancelled' }).catch(() => []));
  useEffect(() => api.subscribeReservations(() => { res.reload(); cancelled.reload(); }), [res.reload, cancelled.reload]);
  const labs = useLoad(() => api.listLabs());
  const classes = useLoad(() => api.listSchedules());

  const first = new Date(Date.UTC(ym.y, ym.m, 1)).getUTCDay();
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((first + days) / 7) * 7 }, (_, i) => i - first + 1);
  const monthName = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const shift = (n: number) => setYm(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const goToday = () => { setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }); setDay(today); };

  const labList = labs.data ?? [];
  const labShort = (id: string) => {
    const l = labList.find((x) => x.id === id);
    if (!l) return id;
    if (l.id === 'lab1' || l.name.includes('1')) return 'ComLab 1';
    if (l.id === 'lab2' || l.name.includes('2')) return 'ComLab 2';
    if (l.id === 'netlab' || l.name.toLowerCase().includes('net')) return 'NetLab';
    return l.name;
  };
  const labColor = (id: string) => LAB_COLORS[Math.max(0, labList.findIndex((l) => l.id === id)) % LAB_COLORS.length];
  const canEdit = (e: LabEvent) => e.owner_id === profile?.id || profile?.role === 'admin';

  const eventsOn = (date: string) => (events.data ?? []).filter((e) => e.event_date === date).sort((a, b) => a.event_time.localeCompare(b.event_time));
  const bookingsOn = (date: string) => [...(res.data ?? []).filter((r) => r.date === date), ...classesOn(date, classes.data ?? [])]
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const dayEvents = eventsOn(day);
  const dayBookings = [...(cancelled.data ?? []).filter((r) => r.date === day), ...bookingsOn(day)]; // cancelled first = drawn underneath
  const dayTitle = new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const nowH = hours(now.time);

  return (
    <>
      <PageHeader title="Calendar" sub="Pick a day to see what's happening in each lab, hour by hour."
        actions={<Button onClick={() => setEdit({ title: '', description: null, event_date: day, event_time: '08:00', event_type: 'academic' })}><Plus size={16} />Add event</Button>} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Month overview */}
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold">{monthName}</h2>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={goToday}>Today</Button>
              <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></Button>
              <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line px-4 py-2.5 text-xs text-muted">
            <span className="font-semibold text-ink">Lab usage</span>
            {labList.map((l) => (
              <span key={l.id} className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full" style={{ background: labColor(l.id) }} />{labShort(l.id)}</span>
            ))}
            <span className="mx-1 hidden h-3 w-px bg-line sm:block" />
            <span className="font-semibold text-ink">Events</span>
            {EVENT_TYPES.map((t) => <span key={t} className="flex items-center gap-1.5 capitalize"><span className={`h-2 w-2 rounded-full ${TYPE_DOT[t]}`} />{t}</span>)}
          </div>

          <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const date = d >= 1 && d <= days ? iso(ym.y, ym.m, d) : null;
              const weekend = i % 7 === 0 || i % 7 === 6;
              const border = `border-b border-r border-line ${i % 7 === 6 ? 'border-r-0' : ''}`;
              if (!date) return <div key={i} className={`min-h-24 bg-chalk/50 sm:min-h-28 ${border}`} />;
              const ev = eventsOn(date);
              const bk = bookingsOn(date);
              const selected = date === day;
              return (
                <button key={i} type="button" onClick={() => setDay(date)} aria-pressed={selected}
                  aria-label={`${date}: ${ev.length} events, ${bk.length} lab bookings`}
                  className={`group relative flex min-h-16 min-w-0 flex-col gap-1 p-1 text-left transition-colors sm:min-h-28 sm:p-1.5 ${border}
                    ${selected ? 'bg-accent/5 ring-2 ring-inset ring-accent' : weekend ? 'bg-chalk/40 hover:bg-chalk' : 'hover:bg-chalk/70'}`}>
                  <div className="flex items-center justify-center sm:justify-between">
                    <span className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs ${date === today ? 'bg-accent font-semibold text-white' : selected ? 'font-semibold text-accent' : 'text-ink'}`}>{d}</span>
                    {bk.length > 0 && <span className="hidden text-[10px] font-medium text-muted sm:inline">{bk.length} use{bk.length > 1 ? 's' : ''}</span>}
                  </div>
                  {/* phones: a dot per event; larger screens: the event names */}
                  {ev.length > 0 && (
                    <span className="flex justify-center gap-0.5 sm:hidden" aria-hidden>
                      {ev.slice(0, 3).map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[e.event_type]}`} />)}
                    </span>
                  )}
                  {ev.slice(0, 2).map((e) => (
                    <span key={e.id} title={e.description ?? e.title}
                      className={`hidden truncate rounded border-l-2 px-1.5 py-0.5 text-[11px] font-medium sm:block ${TYPE_STYLE[e.event_type]}`}>{e.title}</span>
                  ))}
                  {ev.length > 2 && <span className="hidden px-1 text-[10px] text-muted sm:inline">+{ev.length - 2} more</span>}
                  {/* How busy each lab is that day (share of 7 AM – 9 PM booked) */}
                  {bk.length > 0 && (
                    <div className="mt-auto grid w-full gap-0.5">
                      {labList.map((l) => {
                        const h = bk.filter((r) => r.lab_id === l.id).reduce((s, r) => s + hours(r.end_time) - hours(r.start_time), 0);
                        return h > 0 && (
                          <div key={l.id} className="h-1 overflow-hidden rounded-full bg-line/60 sm:h-1.5" title={`${labShort(l.id)}: ${Math.round(h * 10) / 10} h booked`}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (h / (DAY_END - DAY_START)) * 100)}%`, background: labColor(l.id) }} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Panel>

        {/* Selected day agenda */}
        <Panel className="flex flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{day === today ? 'Today' : 'Selected day'}</p>
              <h2 className="text-base font-semibold">{dayTitle}</h2>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEdit({ title: '', description: null, event_date: day, event_time: '08:00', event_type: 'academic' })}>
              <Plus size={14} />Event
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Events */}
            <div className="grid gap-2 border-b border-line px-4 py-3">
              {dayEvents.length === 0 && <p className="flex items-center gap-2 text-xs text-muted"><CalendarDays size={14} />No school events this day.</p>}
              {dayEvents.map((e) => (
                <div key={e.id} className={`flex items-start gap-2 rounded-lg border-l-4 px-3 py-2 ${TYPE_STYLE[e.event_type]}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{fmtTime(e.event_time)} · {e.event_type}</p>
                    <p className="text-sm font-semibold">{e.title}</p>
                    {e.description && <p className="mt-0.5 text-xs opacity-80">{e.description}</p>}
                  </div>
                  {canEdit(e) && (
                    <button onClick={() => setEdit(e)} aria-label={`Edit ${e.title}`} className="rounded p-1 opacity-60 hover:bg-white/60 hover:opacity-100"><Pencil size={14} /></button>
                  )}
                </div>
              ))}
            </div>

            {/* Hour-by-hour lab timeline */}
            <div className="px-4 py-3">
              <div className="mb-2 grid gap-1 pl-12 text-center text-[11px] font-semibold" style={{ gridTemplateColumns: `repeat(${Math.max(1, labList.length)}, minmax(0, 1fr))` }}>
                {labList.map((l) => <span key={l.id} className="truncate rounded-md py-1 text-white" style={{ background: labColor(l.id) }}>{labShort(l.id)}</span>)}
              </div>
              <div className="relative" style={{ height: (DAY_END - DAY_START) * HOUR_PX }}>
                {Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => (
                  <div key={i} className="absolute inset-x-0 flex items-start" style={{ top: i * HOUR_PX }}>
                    <span className="-mt-2 w-12 shrink-0 pr-2 text-right text-[10px] text-muted">{fmtTime(`${String(DAY_START + i).padStart(2, '0')}:00`).replace(':00', '')}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                ))}
                <div className="absolute inset-y-0 left-12 right-0 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(1, labList.length)}, minmax(0, 1fr))` }}>
                  {labList.map((l) => (
                    <div key={l.id} className="relative">
                      {dayBookings.filter((r) => r.lab_id === l.id).map((r) => {
                        const s = Math.max(DAY_START, hours(r.start_time));
                        const e = Math.min(DAY_END, hours(r.end_time));
                        if (e <= s) return null;
                        const off = r.status === 'cancelled';
                        const c = off ? '#dc2626' : labColor(l.id);
                        return (
                          <div key={r.id} title={`${off ? 'CANCELLED: ' : ''}${r.title}\n${fmtTime(r.start_time)} – ${fmtTime(r.end_time)}\n${r.requester_name}${off && r.admin_notes ? `\n${r.admin_notes}` : ''}`}
                            className={`absolute inset-x-0 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-[10px] leading-tight ${isClass(r) ? '' : 'border-dashed'} ${off ? 'line-through decoration-red-600 decoration-2 opacity-80' : ''}`}
                            style={{ top: (s - DAY_START) * HOUR_PX + 1, height: (e - s) * HOUR_PX - 2, borderColor: c, background: `${c}1f`, color: off ? '#b91c1c' : '#0f172a' }}>
                            <p className="font-semibold">{fmtTime(r.start_time).replace(':00', '')}–{fmtTime(r.end_time).replace(':00', '')}</p>
                            <p className="truncate">{r.title}</p>
                            {(e - s) >= 1.2 && <p className="truncate opacity-70">{isClass(r) ? r.requester_name : `${off ? 'Cancelled' : 'Booking'} · ${r.requester_name}`}</p>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {day === today && nowH >= DAY_START && nowH <= DAY_END && (
                  <div className="pointer-events-none absolute left-10 right-0 flex items-center" style={{ top: (nowH - DAY_START) * HOUR_PX }}>
                    <span className="h-2 w-2 rounded-full bg-red-500" /><span className="h-0.5 flex-1 bg-red-500" />
                  </div>
                )}
              </div>
              {dayBookings.length === 0 && <p className="mt-2 text-center text-xs text-muted">All labs are free this day.</p>}
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-l-4 border-slate-500 bg-slate-500/15" />Regular class</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-l-4 border-dashed border-slate-500 bg-slate-500/15" />Approved booking</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-l-4 border-dashed border-red-600 bg-red-600/15" /><span className="line-through decoration-red-600">Cancelled</span></span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-red-500" />Now</span>
              </p>
            </div>
          </div>
        </Panel>
      </div>

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
          {onDelete ? <Button type="button" variant="quiet" onClick={() => askConfirm({ title: 'Delete this event?', message: 'It moves to the Archive, where an admin can restore it.', confirmLabel: 'Delete', danger: true }).then((ok) => { if (ok) onDelete(); })}>Delete event</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button>Save event</Button></div>
        </div>
      </form>
    </Modal>
  );
}
