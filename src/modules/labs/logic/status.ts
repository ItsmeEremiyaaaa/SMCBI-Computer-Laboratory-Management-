// Labs module rules: what each PC shows (Free / In use / Reserved / Maintenance / Broken) and who may check in.
// The live database enforces check-in the same way (supabase/migrations/0006_students_checkins.sql).
import type { CheckIn, ClassSchedule, Pc, Reservation, Role, ShownStatus } from '../../../shared/data/types';
import type { Now } from '../../../shared/time';
import { classesOn } from '../../schedule/logic/rules';

const ARRIVAL_MIN = 10; // students may check in this many minutes before class

const minus = (t: string, min: number) => {
  const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) - min;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

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
  if (pc.status === 'maintenance') return 'maintenance';
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
      : p.shown === 'maintenance' || p.status === 'maintenance' ? { ...p, shown: 'maintenance' }
      : checkedInPcIds.has(p.id) ? { ...p, shown: 'in_use' } : p));
  }
  let n = 0;
  return pcs.map((p) => {
    if (p.status === 'broken' || p.shown === 'broken') return { ...p, shown: 'broken' };
    if (p.status === 'maintenance' || p.shown === 'maintenance') return { ...p, shown: 'maintenance' };
    const classSeat = seats == null || n++ < seats;
    if (checkedInPcIds.has(p.id)) return { ...p, shown: 'in_use' };
    if (!classSeat) return { ...p, shown: 'free' };
    return { ...p, shown: phase === 'walk_in' ? 'reserved' : 'in_use' };
  });
}

// Why a user may not check in at this PC right now, or null when they may.
export function checkInProblem(
  pc: Pc,
  ctx: { role: Role; userId: string; now: Now; schedules: ClassSchedule[]; reservations: Reservation[]; checkIns: CheckIn[] },
): string | null {
  if (ctx.role !== 'student') return 'Only student accounts check in to a PC.';
  if (pc.status === 'broken' || pc.status === 'maintenance') return `${pc.label} is ${pc.status === 'maintenance' ? 'under maintenance' : 'broken'}. Please use another PC and tell the lab staff.`;
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
