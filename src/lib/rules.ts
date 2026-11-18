// Business rules for bookings and check-ins. The UI and demo backend use these directly;
// the live database enforces the same rules in supabase/migrations/0006_students_checkins.sql.
import { classesOn, slotsOverlap, type Now } from './seat';
import type { CheckIn, ClassSchedule, Pc, Reservation, ReservationInput, Role, Student } from './types';

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

type Phase = 'walk_in' | 'in_session' | 'walk_out' | 'empty';

/**
 * What each PC shows right now. One rule for every view:
 *   broken → Broken; someone seated (class seat or QR check-in) → In use;
 *   seat assigned to an arriving student → Reserved; otherwise Free.
 * `seats` = how many students the class has (null = unknown, then every working PC is a class seat).
 * Seats are handed out in PC order, the same order the 3D students sit in.
 */
export function effectiveStatuses<T extends { id: string; status: string; shown: string }>(
  pcs: T[], phase: Phase, seats: number | null, checkedInPcIds: Set<string>,
): T[] {
  if (phase === 'empty') {
    return pcs.map((p) => (p.shown === 'broken' || p.status === 'broken' ? { ...p, shown: 'broken' }
      : checkedInPcIds.has(p.id) ? { ...p, shown: 'in_use' } : p));
  }
  let n = 0;
  return pcs.map((p) => {
    if (p.status === 'broken' || p.shown === 'broken') return { ...p, shown: 'broken' };
    const classSeat = seats == null || n++ < seats;
    if (checkedInPcIds.has(p.id)) return { ...p, shown: 'in_use' };
    if (!classSeat) return { ...p, shown: 'free' };
    return { ...p, shown: phase === 'walk_in' ? 'reserved' : 'in_use' };
  });
}

/** Enrolled students of a timetable section, by student ID: "BSIT 1A" → BSIT, 1st Year, section A; "BSIT 4" → every 4th-year section. */
export function studentsInSection(students: Student[], section: string | null | undefined): Student[] {
  const m = section?.match(/^([A-Z]+)\s*(\d)\s*([A-Z])?$/i);
  if (!m) return [];
  const year = `${m[2]}${['', 'st', 'nd', 'rd'][Number(m[2])] ?? 'th'} Year`;
  return students
    .filter((s) => s.course === m[1].toUpperCase() && s.year_level === year && (!m[3] || s.section.toUpperCase() === m[3].toUpperCase())
      && (s.status ?? 'Enrolled') === 'Enrolled')
    .sort((a, b) => a.student_id.localeCompare(b.student_id));
}

// "S. April Mariae Libradilla, RVM" and "April Libradilla" both → "april libradilla":
// drop titles/degrees after a comma and single-letter initials, keep first and last name.
export function nameKey(name: string) {
  const words = name.split(',')[0].toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
  return words.length ? `${words[0]} ${words[words.length - 1]}` : '';
}

/** Whether a class section ('BSIT 2B', or 'BSIT 4' = the whole year) includes a student's section ('BSIT 4A'). */
export function sectionIncludes(classSection: string | null | undefined, studentSection: string | null | undefined) {
  const re = /^([A-Z]+)\s*(\d)\s*([A-Z])?$/i;
  const c = classSection?.trim().match(re), s = studentSection?.trim().match(re);
  if (!c || !s) return false;
  return c[1].toUpperCase() === s[1].toUpperCase() && c[2] === s[2] && (!c[3] || c[3].toUpperCase() === (s[3] ?? '').toUpperCase());
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
