import { bsitRoster } from './seed';
import { TIMETABLE } from './timetable';
import { schedulesOverlap } from '../../modules/schedule/logic/rules';

describe('bsitRoster', () => {
  const r = bsitRoster();
  const count = (y: string, sex?: string) => r.filter((s) => s.year_level === y && (!sex || s.sex === sex)).length;

  it('matches the official BSIT enrollment (SY 2026–2027, 1st sem)', () => {
    expect([count('1st Year', 'Male'), count('1st Year', 'Female')]).toEqual([71, 20]);
    expect([count('2nd Year', 'Male'), count('2nd Year', 'Female')]).toEqual([34, 14]);
    expect([count('3rd Year', 'Male'), count('3rd Year', 'Female')]).toEqual([64, 20]);
    expect([count('4th Year', 'Male'), count('4th Year', 'Female')]).toEqual([17, 8]);
    expect(r).toHaveLength(248);
  });

  it('uses C + entry year + 4 digits, unique', () => {
    expect(r.every((s) => /^C2[3-6]\d{4}$/.test(s.student_id))).toBe(true);
    expect(r.find((s) => s.year_level === '4th Year')?.student_id).toBe('C230001');
    expect(new Set(r.map((s) => s.student_id)).size).toBe(248);
  });
});

describe('TIMETABLE', () => {
  it('never double-books a lab', () => {
    const clash = TIMETABLE.flatMap((a, i) => TIMETABLE.slice(i + 1).filter((b) => schedulesOverlap(a, b)).map((b) => `${a.section} / ${b.section}`));
    expect(clash).toEqual([]);
  });
});
