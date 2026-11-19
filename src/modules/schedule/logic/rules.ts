// Schedule module rules: weekly classes, school terms, class validation.
// The live database enforces the same checks (supabase/migrations 0002, 0018).
import type { ClassChangeInput, ClassChangeKind, ClassSchedule, Reservation } from '../../../shared/data/types';
import { isoWeekday, LAB_HOURS_MSG, outsideLabHours } from '../../../shared/time';

const KIND_LABEL: Record<ClassChangeKind, string> = { cancelled: 'Cancelled', activity: 'Activity only', moved: 'Moved' };

const meets = (s: ClassSchedule, date: string) => s.day_of_week === isoWeekday(date) && s.starts_on <= date && date <= s.ends_on;
const session = (s: ClassSchedule, date: string, at: { lab_id: string; start: string; end: string }, extra: Partial<Reservation> = {}): Reservation => ({
  id: `class-${s.id}-${date}`, title: `${s.section}: ${s.subject}`, lab_id: at.lab_id, pc_id: null,
  purpose: 'Regular class', date, start_time: at.start, end_time: at.end,
  requester_id: '', requester_name: s.instructor, participants: null, requirements: null,
  status: 'approved', admin_notes: null, reviewed_at: null, schedule_id: s.id, class_date: date, ...extra,
});

/**
 * Weekly classes meeting on `date`, shaped as approved whole-lab bookings so every screen and rule
 * that understands reservations understands classes too. One-day changes apply: a cancelled /
 * activity-only / moved-away meeting is left out (or, with `includeOff`, returned as 'cancelled' so
 * the calendar can cross it out), and a meeting moved *into* this date is added at its new time and lab.
 */
export function classesOn(date: string, schedules: ClassSchedule[], opts: { includeOff?: boolean } = {}): Reservation[] {
  const out: Reservation[] = [];
  for (const s of schedules) {
    if (meets(s, date)) {
      const ch = s.changes?.find((c) => c.date === date);
      if (!ch) out.push(session(s, date, { lab_id: s.lab_id, start: s.start_time, end: s.end_time }));
      else if (opts.includeOff) out.push(session(s, date, { lab_id: s.lab_id, start: s.start_time, end: s.end_time }, {
        status: 'cancelled', class_change: ch,
        admin_notes: [ch.kind === 'moved' ? `Moved to ${ch.new_date} ${ch.new_start}–${ch.new_end}` : KIND_LABEL[ch.kind], ch.note].filter(Boolean).join(' · '),
      }));
    }
    for (const ch of s.changes ?? []) {
      if (ch.kind === 'moved' && ch.new_date === date) {
        out.push(session(s, ch.date, { lab_id: ch.new_lab!, start: ch.new_start!, end: ch.new_end! }, {
          id: `class-${s.id}-${ch.date}-moved`, date, class_change: ch, admin_notes: [`Moved from ${ch.date}`, ch.note].filter(Boolean).join(' · '),
        }));
      }
    }
  }
  return out;
}

/** Why a one-day change can't be saved (empty = OK). A move that clashes is refused, same as the database. */
export function classChangeProblems(
  c: ClassChangeInput,
  ctx: { schedules: ClassSchedule[]; approvedBookings: Pick<Reservation, 'lab_id' | 'date' | 'start_time' | 'end_time' | 'title' | 'status'>[]; today: string },
): string[] {
  const s = ctx.schedules.find((x) => x.id === c.schedule_id);
  if (!s) return ['Class not found.'];
  if (c.date < ctx.today) return ['That class meeting has already passed.'];
  if (!meets(s, c.date)) return ["This class doesn't meet on that date."];
  if (c.kind !== 'moved') return [];
  const e: string[] = [];
  if (!c.new_date || !c.new_start || !c.new_end || !c.new_lab) return ['Pick the new date, time and lab.'];
  if (c.new_date < ctx.today) e.push("Pick a date that hasn't passed.");
  if (c.new_end <= c.new_start) e.push('End time must be after start time.');
  if (outsideLabHours(c.new_start, c.new_end)) e.push(LAB_HOURS_MSG);
  if (e.length) return e;
  // what meets on the new date once this change is in place (this class's own meeting excluded)
  const others = ctx.schedules.map((x) => (x.id === s.id ? { ...x, changes: [...(x.changes ?? []).filter((k) => k.date !== c.date), { ...c, id: 'new' }] } : x));
  const clash = classesOn(c.new_date, others)
    .find((r) => r.schedule_id !== s.id && r.lab_id === c.new_lab && r.start_time < c.new_end! && c.new_start! < r.end_time);
  if (clash) return [`Can't move it there: it clashes with ${clash.title.replace(':', '')} (${clash.start_time}–${clash.end_time}) in that lab.`];
  const booked = ctx.approvedBookings.find((r) => r.status === 'approved' && r.lab_id === c.new_lab && r.date === c.new_date
    && r.start_time < c.new_end! && c.new_start! < r.end_time);
  if (booked) return [`Can't move it there: it clashes with the approved booking "${booked.title}" (${booked.start_time}–${booked.end_time}).`];
  return [];
}

/**
 * SMCBI's terms, by the month a class starts: June–October = 1st semester, November–March = 2nd semester,
 * April–May = summer. The school year runs June to May (Nov 2026 → "2nd semester, AY 2026–2027").
 */
export function termOf(date: string) {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  const ay = m >= 6 ? y : y - 1;
  const sem = m >= 6 && m <= 10 ? 1 : m >= 11 || m <= 3 ? 2 : 3;
  return { key: `${ay}-${sem}`, label: `${['', '1st semester', '2nd semester', 'Summer'][sem]}, AY ${ay}–${ay + 1}` };
}

type ScheduleCheck = Pick<ClassSchedule, 'lab_id' | 'section' | 'subject' | 'day_of_week' | 'start_time' | 'end_time' | 'starts_on' | 'ends_on'>;

export function validateSchedule(s: ScheduleCheck): string[] {
  const e: string[] = [];
  if (!s.lab_id) e.push('Choose a lab.');
  if (!s.section?.trim() || !s.subject?.trim()) e.push('Section and subject are required.');
  if (!(s.day_of_week >= 1 && s.day_of_week <= 7)) e.push('Choose a day.');
  if (!s.start_time || !s.end_time || s.end_time <= s.start_time) e.push('End time must be after start time.');
  if (outsideLabHours(s.start_time, s.end_time)) e.push(LAB_HOURS_MSG);
  if (!s.starts_on || !s.ends_on || s.ends_on < s.starts_on) e.push('The last day must be on or after the first day.');
  return e;
}

// Same lab, same weekday, overlapping times and overlapping date ranges.
export const schedulesOverlap = (a: ScheduleCheck, b: ScheduleCheck) =>
  a.lab_id === b.lab_id && a.day_of_week === b.day_of_week &&
  a.start_time < b.end_time && b.start_time < a.end_time &&
  a.starts_on <= b.ends_on && b.starts_on <= a.ends_on;
