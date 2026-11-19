// School clock: Manila time, weekdays, time-slot overlap and lab opening hours. Used by every module.
import type { Reservation } from './data/types';

type Slot = Pick<Reservation, 'lab_id' | 'pc_id' | 'date' | 'start_time' | 'end_time'>;
export type Now = { date: string; time: string };

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function manilaNow(d = new Date()): Now {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// HH:MM strings compare correctly as text.
export function slotsOverlap(a: Slot, b: Slot): boolean {
  if (a.lab_id !== b.lab_id || a.date !== b.date) return false;
  if (a.pc_id && b.pc_id && a.pc_id !== b.pc_id) return false;
  return a.start_time < b.end_time && b.start_time < a.end_time;
}

// ISO weekday of a YYYY-MM-DD date: 1 = Monday … 7 = Sunday.
export const isoWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

/** Lab opening hours: bookings and classes must fit inside them. */
export const LAB_OPEN = '08:00';
export const LAB_CLOSE = '20:00';
export const outsideLabHours = (start: string, end: string) => !!start && !!end && (start < LAB_OPEN || end > LAB_CLOSE);
export const LAB_HOURS_MSG = 'The labs are open 8:00 AM to 8:00 PM. Pick a time inside those hours.';
