// Bookings module rules: who may book what, form validation, and real usage hours.
// The live database enforces the same rules (supabase/migrations 0006, 0014, 0018).
import type { CheckIn, ClassSchedule, Pc, Reservation, ReservationInput, Role } from '../../../shared/data/types';
import { LAB_HOURS_MSG, outsideLabHours, slotsOverlap, type Now } from '../../../shared/time';
import { classesOn } from '../../schedule/logic/rules';

export const STUDENT_LAB = 'netlab'; // the only lab students may book

export function validateReservation(r: ReservationInput, today: string): string[] {
  const e: string[] = [];
  if (!r.title?.trim()) e.push('Title is required.');
  if (!r.purpose?.trim()) e.push('Purpose is required.');
  if (!r.lab_id) e.push('Choose a lab.');
  if (!r.date || r.date < today) e.push('Date must be today or later.');
  if (!r.start_time || !r.end_time || r.end_time <= r.start_time) e.push('End time must be after start time.');
  if (outsideLabHours(r.start_time, r.end_time)) e.push(LAB_HOURS_MSG);
  if (r.participants != null && r.participants < 1) e.push('Participants must be at least 1.');
  return e;
}

// Reasons a booking request must be refused when it is sent.
export function bookingProblems(
  r: ReservationInput,
  ctx: { role: Role; pcs: Pc[]; reservations: Reservation[]; schedules: ClassSchedule[] },
): string[] {
  const e: string[] = [];
  if (ctx.role === 'student') {
    if (r.lab_id !== STUDENT_LAB) e.push('Students can only book the Networking Laboratory.');
    if (!r.pc_id) e.push('Choose the PC you will use.');
  }
  const pc = r.pc_id ? ctx.pcs.find((p) => p.id === r.pc_id) : undefined;
  if (pc?.status === 'broken' || pc?.status === 'maintenance') e.push(`${pc.label} is ${pc.status === 'maintenance' ? 'under maintenance' : 'broken'} and can't be booked. Pick another PC.`);
  if (r.date && r.start_time && r.end_time) {
    const cls = classesOn(r.date, ctx.schedules)
      .find((c) => c.lab_id === r.lab_id && c.start_time < r.end_time && r.start_time < c.end_time);
    if (cls) e.push(`There's a class in this lab at that time (${cls.title}, ${cls.start_time}–${cls.end_time}).`);
    if (ctx.reservations.some((o) => o.status === 'approved' && slotsOverlap(o, r))) e.push('That time overlaps an approved booking.');
  }
  return e;
}

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * Hours actually used per lab, for usage stats: only time that has already happened, and a booking
 * only counts if its requester checked in at that lab during it. Classes count once they are under way.
 * `entries` = classes (ids starting "class-") and approved/completed bookings; `now` in Manila time.
 */
export function usedHours(
  entries: Pick<Reservation, 'id' | 'lab_id' | 'date' | 'start_time' | 'end_time' | 'requester_id' | 'status'>[],
  checkIns: Pick<CheckIn, 'lab_id' | 'user_id' | 'checked_in_at'>[],
  now: Now,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of entries) {
    if (!r.id.startsWith('class-') && r.status !== 'approved' && r.status !== 'completed') continue;
    if (r.date > now.date) continue;
    const start = mins(r.start_time), end = mins(r.end_time);
    const until = r.date < now.date ? end : Math.min(end, mins(now.time));
    if (until <= start) continue;
    if (!r.id.startsWith('class-')) {
      // a booking nobody showed up for is not usage
      const from = new Date(`${r.date}T${r.start_time}:00+08:00`).getTime() - 10 * 60_000;
      const to = new Date(`${r.date}T${r.end_time}:00+08:00`).getTime();
      const came = checkIns.some((c) => c.user_id === r.requester_id && c.lab_id === r.lab_id
        && new Date(c.checked_in_at).getTime() >= from && new Date(c.checked_in_at).getTime() < to);
      if (!came) continue;
    }
    out[r.lab_id] = (out[r.lab_id] ?? 0) + (until - start) / 60;
  }
  return out;
}
