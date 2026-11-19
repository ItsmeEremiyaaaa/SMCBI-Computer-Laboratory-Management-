// Class schedule ⇄ spreadsheet rows. Pure functions (no Excel library) so they're easy to test;
// the screen reads/writes the .xlsx file and passes plain cell values in and out.
import type { ClassSchedule, Lab, ScheduleInput } from '../../../shared/data/types';
import { schedulesOverlap, validateSchedule } from './rules';

export const COLUMNS = ['Lab', 'Section', 'Subject', 'Instructor', 'Day', 'Start', 'End', 'First day', 'Last day'] as const;
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export type Cell = string | number | boolean | Date | null | undefined;

/** One row per class, in COLUMNS order (what Export writes). */
export function schedulesToRows(classes: ClassSchedule[], labs: Lab[]): (string)[][] {
  const labName = (id: string) => labs.find((l) => l.id === id)?.name ?? id;
  return [...classes]
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time) || a.lab_id.localeCompare(b.lab_id))
    .map((c) => [labName(c.lab_id), c.section, c.subject, c.instructor, DAYS[c.day_of_week - 1], c.start_time, c.end_time, c.starts_on, c.ends_on]);
}

const text = (v: Cell) => (v instanceof Date ? '' : String(v ?? '').trim());
const pad = (n: number) => String(n).padStart(2, '0');

// "ComLab 1", "Computer Laboratory 1", "lab1", "NetLab" → lab id
function labId(v: Cell, labs: Lab[]): string | null {
  const s = text(v).toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  const hit = labs.find((l) => l.id.toLowerCase() === s || l.name.toLowerCase() === s);
  if (hit) return hit.id;
  if (/net/.test(s)) return labs.find((l) => /net/i.test(l.id + l.name))?.id ?? null;
  const n = s.match(/(\d)/)?.[1];
  return n ? labs.find((l) => l.id === `lab${n}`)?.id ?? null : null;
}

// "Monday", "mon", "1" → 1..7
function day(v: Cell): number | null {
  const s = text(v).toLowerCase();
  if (/^[1-7]$/.test(s)) return Number(s);
  const i = DAYS.findIndex((d) => s && d.toLowerCase().startsWith(s.slice(0, 3)));
  return i >= 0 ? i + 1 : null;
}

// Excel time (fraction of a day or a Date) or "9:00 AM" / "13:00" → "HH:MM"
function time(v: Cell): string | null {
  if (v instanceof Date) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
  if (typeof v === 'number' && v >= 0 && v < 1) { const m = Math.round(v * 1440); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
  const m = text(v).toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2] ?? 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
}

// Excel date (Date) or "2027-06-01" / "6/1/2027" → "YYYY-MM-DD"
function date(v: Cell): string | null {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  const s = text(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // month/day/year, as Excel shows it in the Philippines
  return m ? `${m[3]}-${pad(+m[1])}-${pad(+m[2])}` : null;
}

/**
 * Reads sheet rows (first row = headings, in any order) into classes ready to save.
 * Every bad row is reported with its row number and reason; it never stops at the first one.
 * Rows that clash with existing classes or with each other are refused, so importing the same file twice adds nothing.
 */
export function rowsToSchedules(sheet: Cell[][], labs: Lab[], existing: ClassSchedule[]) {
  const ok: ScheduleInput[] = [];
  const problems: string[] = [];
  const [head = [], ...rows] = sheet;
  const col = Object.fromEntries(COLUMNS.map((c) => [c, head.findIndex((h) => text(h).toLowerCase() === c.toLowerCase())]));
  const missing = COLUMNS.filter((c) => col[c] < 0);
  if (missing.length) return { ok, problems: [`The first row needs these headings: ${missing.join(', ')}. Use Export to get a file in the right shape.`] };

  rows.forEach((r, i) => {
    const n = i + 2;
    const get = (c: (typeof COLUMNS)[number]) => r[col[c]];
    if (r.every((v) => text(v) === '' && !(v instanceof Date) && typeof v !== 'number')) return; // blank line
    const why: string[] = [];
    const lab_id = labId(get('Lab'), labs); if (!lab_id) why.push(`unknown lab "${text(get('Lab'))}"`);
    const dow = day(get('Day')); if (!dow) why.push(`unknown day "${text(get('Day'))}"`);
    const start = time(get('Start')), end = time(get('End'));
    if (!start || !end) why.push('start/end must be times like 9:00 AM or 13:00');
    const from = date(get('First day')), to = date(get('Last day'));
    if (!from || !to) why.push('first/last day must be dates');
    if (why.length) { problems.push(`Row ${n}: ${why.join('; ')}.`); return; }
    const s: ScheduleInput = {
      lab_id: lab_id!, section: text(get('Section')).toUpperCase(), subject: text(get('Subject')), instructor: text(get('Instructor')),
      day_of_week: dow!, start_time: start!, end_time: end!, starts_on: from!, ends_on: to!,
    };
    const invalid = validateSchedule(s);
    if (invalid.length) { problems.push(`Row ${n}: ${invalid.join(' ')}`); return; }
    const clash = existing.find((e) => schedulesOverlap(e, s)) ?? ok.find((o) => schedulesOverlap(o, s));
    if (clash) { problems.push(`Row ${n}: overlaps ${clash.section} ${clash.subject} (${DAYS[clash.day_of_week - 1]} ${clash.start_time}–${clash.end_time}) in the same lab.`); return; }
    ok.push(s);
  });
  return { ok, problems };
}
