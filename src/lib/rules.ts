// Business rules for bookings and check-ins. The UI and demo backend use these directly;
// the live database enforces the same rules in supabase/migrations/0006_students_checkins.sql.
import { classesOn, slotsOverlap, type Now } from './seat';
import type { CheckIn, ClassSchedule, Pc, Reservation, ReservationInput, Role } from './types';

export const STUDENT_LAB = 'netlab'; // the only lab students may book
const ARRIVAL_MIN = 10; // students may check in this many minutes before class

const minus = (t: string, min: number) => {
  const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) - min;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

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
  if (pc?.status === 'broken') e.push(`${pc.label} is broken and can't be booked. Pick another PC.`);
  if (r.date && r.start_time && r.end_time) {
    const cls = classesOn(r.date, ctx.schedules)
      .find((c) => c.lab_id === r.lab_id && c.start_time < r.end_time && r.start_time < c.end_time);
    if (cls) e.push(`There's a class in this lab at that time (${cls.title}, ${cls.start_time}–${cls.end_time}).`);
    if (ctx.reservations.some((o) => o.status === 'approved' && slotsOverlap(o, r))) e.push('That time overlaps an approved booking.');
  }
  return e;
}

// Why a user may not check in at this PC right now, or null when they may.
export function checkInProblem(
  pc: Pc,
  ctx: { role: Role; userId: string; now: Now; schedules: ClassSchedule[]; reservations: Reservation[]; checkIns: CheckIn[] },
): string | null {
  if (ctx.role !== 'student') return 'Only student accounts check in to a PC.';
  if (pc.status === 'broken') return `${pc.label} is broken. Please use another PC and tell the lab staff.`;
  const t = ctx.now.time;
  const inClass = classesOn(ctx.now.date, ctx.schedules)
    .some((c) => c.lab_id === pc.lab_id && minus(c.start_time, ARRIVAL_MIN) <= t && t < c.end_time);
  const booked = ctx.reservations.some((r) => r.status === 'approved' && r.requester_id === ctx.userId && r.lab_id === pc.lab_id
    && (!r.pc_id || r.pc_id === pc.id) && r.date === ctx.now.date && r.start_time <= t && t < r.end_time);
  if (!inClass && !booked) return 'You can only check in during a class in this lab or your approved booking.';
  if (ctx.checkIns.some((c) => c.pc_id === pc.id && !c.checked_out_at && c.user_id !== ctx.userId))
    return `${pc.label} is already checked in by another student.`;
  return null;
}
