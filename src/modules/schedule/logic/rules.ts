// Schedule module rules: weekly classes, school terms, class validation.
// The live database enforces the same checks (supabase/migrations 0002, 0018).
import type { ClassSchedule, Reservation } from '../../../shared/data/types';
import { isoWeekday, LAB_HOURS_MSG, outsideLabHours } from '../../../shared/time';

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
