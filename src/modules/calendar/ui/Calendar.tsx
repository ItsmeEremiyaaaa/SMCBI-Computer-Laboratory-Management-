import { useState, type FormEvent, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import { useAuth } from '../../auth/hooks/auth';
import { useLoad } from '../../../shared/hooks/useLoad';
import { type EventInput } from '../../../shared/data/api';
import { bookingsRepo } from '../../bookings/data/repository';
import { calendarRepo } from '../data/repository';
import { labsRepo } from '../../labs/data/repository';
import { scheduleRepo } from '../../schedule/data/repository';
import { classesOn } from '../../schedule/logic/rules';
import ClassChangeModal from '../../schedule/ui/ClassChangeModal';
import { placeLanes } from '../logic/lanes';
import { CountUp } from '../../../shared/ui/CountUp';
import { nameKey } from '../../people/logic/rules';
import { manilaNow } from '../../../shared/time';
import { EVENT_TYPES, type ClassChangeInput, type EventType, type LabEvent, type Reservation } from '../../../shared/data/types';
import { Alert, Button, Field, fmtDate, fmtTime, Input, Modal, PageHeader, Panel, Select, Textarea, askConfirm } from '../../../shared/ui/ui';

const TYPE_STYLE: Record<EventType, string> = {
  academic: 'bg-blue-50 text-blue-900 border-blue-400',
  personal: 'bg-violet-50 text-violet-900 border-violet-400',
  holiday: 'bg-red-50 text-red-900 border-red-400',
  meeting: 'bg-teal-50 text-teal-900 border-teal-400',
};
const TYPE_DOT: Record<EventType, string> = { academic: 'bg-blue-500', personal: 'bg-violet-500', holiday: 'bg-red-500', meeting: 'bg-teal-500' };
// One colour per lab, in lab order (ComLab 1, ComLab 2, NetLab).
const LAB_COLORS = ['#2563eb', '#ea580c', '#059669', '#7c3aed'];

const DAY_START = 8; // timeline = lab hours, 8:00 AM – 8:00 PM
const DAY_END = 20;
const SPAN = DAY_END - DAY_START; // hours shown across the day timeline

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const hours = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;
const isClass = (r: Reservation) => r.id.startsWith('class-');

const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

export default function Calendar() {
  const { profile } = useAuth();
  const now = manilaNow();
  const today = now.date;
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [day, setDay] = useState(today);
  const [edit, setEdit] = useState<EventInput | null>(null);
  const events = useLoad(() => calendarRepo.listEvents());
  const res = useLoad(() => bookingsRepo.listReservations({ status: 'approved' }));
  // cancelled bookings stay on the day view, red and crossed out, so nobody shows up for them
  const cancelled = useLoad(() => bookingsRepo.listReservations({ status: 'cancelled' }).catch(() => []));
  const labs = useLoad(() => labsRepo.listLabs());
  const classes = useLoad(() => scheduleRepo.listSchedules());
  useEffect(() => bookingsRepo.subscribeReservations(() => { res.reload(); cancelled.reload(); classes.reload(); }), [res.reload, cancelled.reload, classes.reload]);

  // one-day class changes: click a class to change it, or drag it (desktop) to another time/lab/day or onto "cancel"
  const [change, setChange] = useState<{ session: Reservation; preset?: Partial<ClassChangeInput> } | null>(null);
  const [dragging, setDragging] = useState<Reservation | null>(null);
  const canChange = (r: Reservation) => isClass(r) && !!r.schedule_id && (r.class_date ?? '') >= today && (
    profile?.role === 'admin' || profile?.role === 'staff' || (profile?.role === 'teacher' && nameKey(profile.full_name) === nameKey(r.requester_name)));
  // resize: drag a class block's left/right edge to change its start/end for this date (snapped to 30 min)
  const [resize, setResize] = useState<{ id: string; s: number; e: number } | null>(null);
  function startResize(ev: React.PointerEvent, r: Reservation, edge: 'start' | 'end') {
    ev.preventDefault(); ev.stopPropagation();
    const row = (ev.currentTarget as HTMLElement).closest('[data-lab-row]')!.getBoundingClientRect();
    const s0 = hours(r.start_time), e0 = hours(r.end_time);
    let cur = { id: r.id, s: s0, e: e0 };
    const at = (x: number) => Math.round((DAY_START + ((x - row.left) / row.width) * SPAN) * 2) / 2;
    const move = (m: PointerEvent) => {
      const h = Math.min(DAY_END, Math.max(DAY_START, at(m.clientX)));
      cur = edge === 'end' ? { ...cur, e: Math.max(cur.s + 0.5, h) } : { ...cur, s: Math.min(cur.e - 0.5, h) };
      setResize(cur);
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setResize(null);
      if (cur.s !== s0 || cur.e !== e0) setChange({ session: r, preset: { kind: 'moved', new_date: day, new_lab: r.lab_id, new_start: hhmm(cur.s), new_end: hhmm(cur.e) } });
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  const dropMove = (preset: Partial<ClassChangeInput>) => { if (dragging) setChange({ session: dragging, preset: { kind: 'moved', ...preset } }); setDragging(null); };

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
  const dayClasses = classesOn(day, classes.data ?? [], { includeOff: true });
  // cancelled first = drawn underneath
  const dayBookings = [...(cancelled.data ?? []).filter((r) => r.date === day), ...dayClasses.filter((r) => r.status === 'cancelled'),
    ...(res.data ?? []).filter((r) => r.date === day), ...dayClasses.filter((r) => r.status !== 'cancelled')];
  const dayTitle = new Date(`${day}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const nowH = hours(now.time);

  return (
    <>
      <PageHeader title="Calendar" sub="Pick a day to see what's happening in each lab, hour by hour."
/>

      <div className="grid grid-cols-1 gap-4">
        {/* Month overview */}
        <Panel className="soft-card overflow-hidden p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{monthName}</h2>
              <p className="mt-0.5 text-sm text-muted">Lab usage and school events</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={goToday} className="soft-pill px-5 py-2 text-sm">Today</button>
              <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="soft-round h-10 w-10"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => shift(1)} aria-label="Next month" className="soft-round h-10 w-10"><ChevronRight size={18} /></button>
            </div>
          </div>

          {/* Legend as chips */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-ink">
            {labList.map((l) => (
              <span key={l.id} className="soft-chip flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: labColor(l.id) }} />{labShort(l.id)}</span>
            ))}
            {EVENT_TYPES.map((t) => <span key={t} className="soft-chip flex items-center gap-1.5 capitalize text-muted"><span className={`h-2 w-2 rounded-full ${TYPE_DOT[t]}`} />{t}</span>)}
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted sm:gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((d, i) => {
              const date = d >= 1 && d <= days ? iso(ym.y, ym.m, d) : null;
              const weekend = i % 7 === 0 || i % 7 === 6;
              if (!date) return <div key={i} className="min-h-16 sm:min-h-24" />;
              const ev = eventsOn(date);
              const bk = bookingsOn(date);
              const selected = date === day;
              return (
                <button key={i} type="button" onClick={() => setDay(date)} aria-pressed={selected}
                  onDragOver={(e) => { if (dragging && date >= today) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); dropMove({ new_date: date, new_start: dragging?.start_time, new_end: dragging?.end_time, new_lab: dragging?.lab_id }); }}
                  aria-label={`${date}: ${ev.length} events, ${bk.length} lab bookings`}
                  className={`group relative flex min-h-16 min-w-0 flex-col gap-1 rounded-xl p-1 text-left transition-all sm:min-h-24 sm:rounded-2xl sm:p-2
                    ${selected ? 'bg-white shadow-[0_12px_28px_-14px_rgb(15_23_42/.35)]' : weekend ? 'bg-white/25 hover:bg-white/60' : 'bg-white/45 hover:bg-white/75'}`}>
                  <div className="flex items-center justify-center sm:justify-between">
                    <span className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs ${date === today ? 'bg-ink font-semibold text-white' : selected ? 'font-semibold text-ink' : 'text-ink'}`}>{d}</span>
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
                          <div key={l.id} className="h-1 overflow-hidden rounded-full bg-white/70 sm:h-1.5" title={`${labShort(l.id)}: ${Math.round(h * 10) / 10} h booked`}>
                            <div className="bar-grow h-full rounded-full" style={{ width: `${Math.min(100, (h / (DAY_END - DAY_START)) * 100)}%`, background: labColor(l.id) }} />
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
        <Panel className="soft-card flex flex-col overflow-hidden p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="soft-chip text-xs font-medium text-muted">{day === today ? 'Today' : 'Selected day'}</span>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{dayTitle}</h2>
              <p className="mt-0.5 text-sm text-muted">Every lab, hour by hour</p>
            </div>
            <button type="button" className="soft-pill flex items-center gap-1.5 px-5 py-2.5 text-sm"
              onClick={() => setEdit({ title: '', description: null, event_date: day, event_time: '08:00', event_type: 'academic' })}>
              <Plus size={16} />Add event
            </button>
          </div>
          {/* the day at a glance */}
          {(() => {
            const active = dayBookings.filter((r) => r.status !== 'cancelled');
            const usedH = active.reduce((t, r) => t + Math.max(0, Math.min(DAY_END, hours(r.end_time)) - Math.max(DAY_START, hours(r.start_time))), 0);
            const stats: [React.ReactNode, string][] = [
              [<CountUp value={active.filter(isClass).length} />, 'Classes'],
              [<CountUp value={active.filter((r) => !isClass(r)).length} />, 'Bookings'],
              [<><CountUp value={Math.round(usedH * 10) / 10} decimals={usedH % 1 ? 1 : 0} /> h</>, 'Lab time in use'],
            ];
            return (
              <div className="mt-5 grid grid-cols-3 divide-x divide-white/80 text-center">
                {stats.map(([v, k]) => (
                  <div key={k} className="px-2"><p className="text-2xl font-semibold text-ink">{v}</p><p className="text-sm text-muted">{k}</p></div>
                ))}
              </div>
            );
          })()}

          <div>
            {/* Events, side by side */}
            <div className="mt-5 flex flex-wrap gap-2">
              {dayEvents.length === 0 && <p className="flex items-center gap-2 text-xs text-muted"><CalendarDays size={14} />No school events this day.</p>}
              {dayEvents.map((e) => (
                <div key={e.id} className={`flex min-w-56 flex-1 items-start gap-2 rounded-lg border-l-4 px-3 py-2 sm:max-w-sm ${TYPE_STYLE[e.event_type]}`}>
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

            {/* Hour-by-hour lab timeline, landscape: one row per lab, hours left to right */}
            <div className="mt-4">
              <div className="overflow-x-auto">
                <div className="min-w-[44rem]">
                  {/* hour scale */}
                  <div className="relative ml-24 h-5">
                    {Array.from({ length: SPAN + 1 }, (_, i) => (
                      <span key={i} className={`absolute whitespace-nowrap text-[10px] text-muted ${i === SPAN ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${(i / SPAN) * 100}%` }}>
                        {fmtTime(`${String(DAY_START + i).padStart(2, '0')}:00`).replace(':00', '')}
                      </span>
                    ))}
                  </div>
                  <div className="relative grid gap-1.5">
                    {labList.map((l) => {
                      const placed = placeLanes(dayBookings.filter((r) => r.lab_id === l.id), DAY_START, DAY_END);
                      const laneH = placed.lanes > 1 ? 38 : 56;
                      return (
                      <div key={l.id} className="flex items-center gap-2">
                        <span className="flex h-9 w-22 shrink-0 items-center justify-center rounded-full px-1 text-center text-[11px] font-semibold text-white" style={{ background: labColor(l.id) }}>{labShort(l.id)}</span>
                        <div data-lab-row className="relative flex-1 rounded-2xl bg-white/50"
                          style={{ height: placed.lanes * laneH + 8, backgroundImage: `repeating-linear-gradient(to right, var(--color-line) 0 1px, transparent 1px ${100 / SPAN}%)` }}
                          onDragOver={(e) => { if (dragging) e.preventDefault(); }}
                          onDrop={(e) => {
                            e.preventDefault(); if (!dragging) return;
                            const len = hours(dragging.end_time) - hours(dragging.start_time);
                            const box = e.currentTarget.getBoundingClientRect();
                            const at = DAY_START + ((e.clientX - box.left) / box.width) * SPAN;
                            const start = Math.min(DAY_END - len, Math.max(DAY_START, Math.round(at * 2) / 2));
                            dropMove({ new_date: day, new_start: hhmm(start), new_end: hhmm(start + len), new_lab: l.id });
                          }}>
                          {placed.items.map(({ r, s: s0, e: e0, lane }) => {
                            const live = resize?.id === r.id ? resize : null;
                            const s = live?.s ?? s0, e = live?.e ?? e0;
                            const off = r.status === 'cancelled';
                            const c = off ? '#dc2626' : labColor(l.id);
                            const editable = canChange(r);
                            return (
                              <div key={r.id + (off ? '-off' : '')} title={`${off ? (isClass(r) ? '' : 'CANCELLED: ') : ''}${r.title}\n${fmtTime(r.start_time)} – ${fmtTime(r.end_time)}\n${r.requester_name}${off && r.admin_notes ? `\n${r.admin_notes}` : ''}`}
                                role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}
                                aria-label={editable ? `Change ${r.title} on ${r.class_date}` : undefined}
                                onClick={editable ? () => setChange({ session: r }) : undefined}
                                onKeyDown={editable ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setChange({ session: r }); } } : undefined}
                                draggable={editable && !off && !resize}
                                onDragStart={editable && !off ? (ev) => { ev.dataTransfer.effectAllowed = 'move'; setDragging(r); } : undefined}
                                onDragEnd={() => setTimeout(() => setDragging(null), 0)}
                                className={`absolute overflow-hidden rounded-xl border-l-4 px-1.5 py-1 text-[10px] leading-tight ${isClass(r) ? '' : 'border-dashed'} ${off ? 'line-through decoration-red-600 decoration-2 opacity-80' : ''} ${editable ? 'cursor-pointer hover:ring-2 hover:ring-accent/40' : ''} ${editable && !off ? 'active:cursor-grabbing' : ''} ${dragging?.id === r.id ? 'opacity-40' : ''}`}
                                style={{ top: 4 + lane * laneH, height: laneH - 4, left: `calc(${((s - DAY_START) / SPAN) * 100}% + 1px)`, width: `calc(${((e - s) / SPAN) * 100}% - 2px)`, borderColor: c, background: `${c}1f`, color: off ? '#b91c1c' : '#0f172a' }}>
                                {editable && !off && (['start', 'end'] as const).map((edge) => (
                                  <span key={edge} role="separator" aria-orientation="vertical" aria-label={`Drag to change the ${edge} time`}
                                    title={`Drag to change the ${edge} time`} onPointerDown={(ev) => startResize(ev, r, edge)} onClick={(ev) => ev.stopPropagation()}
                                    className={`absolute inset-y-0 z-10 w-2 cursor-ew-resize hover:bg-accent/30 ${edge === 'start' ? 'left-0' : 'right-0'}`} />
                                ))}
                                <p className="truncate font-semibold">{live ? `${fmtTime(hhmm(s))}–${fmtTime(hhmm(e))}` : `${fmtTime(r.start_time).replace(':00', '')}–${fmtTime(r.end_time).replace(':00', '')}`} · {r.title}</p>
                                <p className="truncate opacity-70">{isClass(r) ? (r.class_change ? (off ? ({ cancelled: 'Cancelled', activity: 'Activity only', moved: 'Moved' } as const)[r.class_change.kind] : `Moved here · ${r.requester_name}`) : r.requester_name) : `${off ? 'Cancelled' : 'Booking'} · ${r.requester_name}`}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      );
                    })}
                    {day === today && nowH >= DAY_START && nowH <= DAY_END && (
                      <div className="pointer-events-none absolute inset-y-0 ml-24 w-[calc(100%-6rem)]">
                        <span className="absolute inset-y-0 w-0.5 bg-red-500" style={{ left: `${((nowH - DAY_START) / SPAN) * 100}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {dragging && (
                <div onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); if (dragging) setChange({ session: dragging, preset: { kind: 'cancelled' } }); setDragging(null); }}
                  className="mt-3 rounded-lg border-2 border-dashed border-red-400 bg-red-50 py-3 text-center text-xs font-semibold text-red-700">
                  Drop here to cancel {dragging.title.split(':')[0]} on {fmtDate(dragging.class_date ?? day)}
                </div>
              )}
              {!dragging && dayClasses.some(canChange) && (
                <p className="mt-2 text-center text-[11px] text-muted">Click a class to cancel, set activity only or move it, or drag it to another time, lab or day.</p>
              )}
              {dayBookings.length === 0 && <p className="mt-2 text-center text-xs text-muted">All labs are free this day.</p>}
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-l-4 border-slate-500 bg-slate-500/15" />Regular class</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-l-4 border-dashed border-slate-500 bg-slate-500/15" />Approved booking</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border-l-4 border-dashed border-red-600 bg-red-600/15" /><span className="line-through decoration-red-600">Cancelled</span></span>
                <span className="flex items-center gap-1"><span className="h-3 w-0.5 bg-red-500" />Now</span>
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {change && classes.data && labs.data && (
        <ClassChangeModal session={change.session} preset={change.preset} schedules={classes.data} bookings={res.data ?? []} labs={labs.data}
          today={today} onClose={() => setChange(null)} onDone={async () => { setChange(null); await classes.reload(); }} />
      )}
      {edit && <EventModal e={edit} onClose={() => setEdit(null)}
        onDelete={edit.id ? async () => { await calendarRepo.deleteEvent(edit.id!); setEdit(null); await events.reload(); } : undefined}
        onSave={async (x) => { await calendarRepo.saveEvent(x); setEdit(null); await events.reload(); }} />}
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
          <Button>Save event</Button>
        </div>
      </form>
    </Modal>
  );
}
