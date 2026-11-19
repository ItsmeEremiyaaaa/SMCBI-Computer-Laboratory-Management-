import { COLUMNS, rowsToSchedules, schedulesToRows } from './excel';
import type { ClassSchedule, Lab } from '../../../shared/data/types';

const labs = [{ id: 'lab1', name: 'Computer Laboratory 1' }, { id: 'netlab', name: 'Networking Laboratory' }] as Lab[];
const cls: ClassSchedule = { id: 'c1', lab_id: 'lab1', section: 'BSIT 1A', subject: 'IT111', instructor: 'Ms. Cruz', day_of_week: 1,
  start_time: '09:00', end_time: '12:00', starts_on: '2026-11-02', ends_on: '2027-03-31' };

describe('schedule Excel rows', () => {
  it('round-trips: an exported row imports back as the same class (and is refused as a clash if it already exists)', () => {
    const sheet = [[...COLUMNS], ...schedulesToRows([cls], labs)];
    const { id: _id, ...expected } = cls; void _id;
    expect(rowsToSchedules(sheet, labs, []).ok).toEqual([expected]);
    expect(rowsToSchedules(sheet, labs, [cls]).problems[0]).toMatch(/Row 2: overlaps BSIT 1A IT111/);
  });

  it('reads Excel-style cells: lab nicknames, day names, 12-hour times, Excel dates and time fractions', () => {
    const sheet = [[...COLUMNS], ['ComLab 1', 'bsit 2b', 'IT213', 'Mr. Reyes', 'tue', '1:00 PM', 0.6875, new Date(Date.UTC(2027, 5, 1)), '10/31/2027']];
    expect(rowsToSchedules(sheet, labs, []).ok[0]).toMatchObject({
      lab_id: 'lab1', section: 'BSIT 2B', day_of_week: 2, start_time: '13:00', end_time: '16:30', starts_on: '2027-06-01', ends_on: '2027-10-31',
    });
  });

  it('reports every bad row with its number and skips blank lines', () => {
    const sheet = [[...COLUMNS],
      ['Lab 9', 'BSIT 1A', 'X', 'Y', 'Funday', '9:00', '12:00', '2027-06-01', '2027-10-31'],
      [null, '', '', '', '', '', '', '', ''],
      ['NetLab', 'BSIT 1A', 'X', 'Y', 'Mon', '7:00 AM', '9:00 AM', '2027-06-01', '2027-10-31']];
    const { ok, problems } = rowsToSchedules(sheet, labs, []);
    expect(ok).toEqual([]);
    expect(problems).toEqual([
      'Row 2: unknown lab "Lab 9"; unknown day "Funday".',
      'Row 4: The labs are open 8:00 AM to 8:00 PM. Pick a time inside those hours.',
    ]);
  });

  it('asks for the right headings', () => {
    expect(rowsToSchedules([['Lab', 'Section']], labs, []).problems[0]).toMatch(/needs these headings: Subject, Instructor/);
  });
});
