import type { ClassSchedule, Pc, Reservation, ShownStatus } from './types';

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

// The booking that holds this PC now: one running right now (whole lab or this PC), otherwise this PC's
// next approved booking later today. A single-PC booking holds its PC from approval until it ends, so
// the PC shows Reserved straight away; a whole-lab booking only counts while it runs.
export function activeReservation(pc: Pc, approved: Reservation[], now: Now): Reservation | undefined {
  const today = approved.filter((r) =>
    r.status === 'approved' && r.lab_id === pc.lab_id && (r.pc_id === null || r.pc_id === pc.id) &&
    r.date === now.date && now.time < r.end_time);
  return today.find((r) => r.start_time <= now.time)
    ?? today.filter((r) => r.pc_id === pc.id).sort((x, y) => x.start_time.localeCompare(y.start_time))[0];
}

export function shownStatus(pc: Pc, approved: Reservation[], now: Now): ShownStatus {
  if (pc.status === 'broken') return 'broken';
  const active = activeReservation(pc, approved, now);
  if (!active) return pc.status;
  // A class in session means the comlab is actively in use, not just reserved
  if (
    active.purpose === 'Regular class' ||
    active.purpose === 'Laboratory class' ||
    active.id.startsWith('class-')
  ) {
    return 'in_use';
  }
  return 'reserved';
}

// ISO weekday of a YYYY-MM-DD date: 1 = Monday … 7 = Sunday.
export const isoWeekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

// Weekly classes meeting on `date`, shaped as approved whole-lab bookings so every
// screen and rule that understands reservations understands classes too.
export function classesOn(date: string, schedules: ClassSchedule[]): Reservation[] {
  const dow = isoWeekday(date);
  return schedules
    .filter((s) => s.day_of_week === dow && s.starts_on <= date && date <= s.ends_on)
    .map((s) => ({
      id: `class-${s.id}-${date}`, title: `${s.section}: ${s.subject}`, lab_id: s.lab_id, pc_id: null,
      purpose: 'Regular class', date, start_time: s.start_time, end_time: s.end_time,
      requester_id: '', requester_name: s.instructor, participants: null, requirements: null,
      status: 'approved', admin_notes: null, reviewed_at: null,
    }));
}
