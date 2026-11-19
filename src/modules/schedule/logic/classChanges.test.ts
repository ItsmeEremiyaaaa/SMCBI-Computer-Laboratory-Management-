import { classChangeProblems, classesOn } from './rules';
import type { ClassChange, ClassSchedule } from '../../../shared/data/types';

// Mondays 9–12 in ComLab 1 and 13–16 in ComLab 2; 2026-11-23 is a Monday
const base = { day_of_week: 1, starts_on: '2026-11-02', ends_on: '2027-03-31', instructor: 'Ms. Cruz' };
const a: ClassSchedule = { ...base, id: 'a', lab_id: 'lab1', section: 'BSIT 1A', subject: 'IT111', start_time: '09:00', end_time: '12:00' };
const b: ClassSchedule = { ...base, id: 'b', lab_id: 'lab2', section: 'BSIT 2A', subject: 'IT213', start_time: '13:00', end_time: '16:00' };
const change = (o: Partial<ClassChange>): ClassChange => ({ id: 'x', schedule_id: 'a', date: '2026-11-23', kind: 'cancelled',
  new_date: null, new_start: null, new_end: null, new_lab: null, note: null, ...o });
const ctx = (schedules: ClassSchedule[]) => ({ schedules, approvedBookings: [], today: '2026-11-19' });

describe('one-day class changes', () => {
  it('a cancelled or activity-only meeting frees the lab that day only (the calendar can still show it crossed out)', () => {
    const s = [{ ...a, changes: [change({ kind: 'activity', note: 'Answer Activity 3' })] }];
    expect(classesOn('2026-11-23', s)).toEqual([]);
    expect(classesOn('2026-11-23', s, { includeOff: true })[0]).toMatchObject({ status: 'cancelled', admin_notes: 'Activity only · Answer Activity 3' });
    expect(classesOn('2026-11-30', s)).toHaveLength(1); // next week as normal
  });

  it('a moved meeting leaves its day and appears at the new date, time and lab', () => {
    const s = [{ ...a, changes: [change({ kind: 'moved', new_date: '2026-11-25', new_start: '13:00', new_end: '16:00', new_lab: 'lab2' })] }];
    expect(classesOn('2026-11-23', s)).toEqual([]);
    expect(classesOn('2026-11-25', s)[0]).toMatchObject({ lab_id: 'lab2', start_time: '13:00', title: 'BSIT 1A: IT111', class_date: '2026-11-23' });
  });

  it('refuses a move that clashes with another class or an approved booking, with the reason', () => {
    const move = { schedule_id: 'a', date: '2026-11-23', kind: 'moved' as const, new_date: '2026-11-23', new_start: '14:00', new_end: '17:00', new_lab: 'lab2', note: null };
    expect(classChangeProblems(move, ctx([a, b]))).toEqual(["Can't move it there: it clashes with BSIT 2A IT213 (13:00–16:00) in that lab."]);
    const booking = { lab_id: 'lab1', date: '2026-11-24', start_time: '09:00', end_time: '11:00', title: 'Seminar', status: 'approved' as const };
    expect(classChangeProblems({ ...move, new_date: '2026-11-24', new_start: '10:00', new_end: '13:00', new_lab: 'lab1' }, { ...ctx([a, b]), approvedBookings: [booking] }))
      .toEqual(['Can\'t move it there: it clashes with the approved booking "Seminar" (09:00–11:00).']);
  });

  it('allows moving within its own slot, and rejects past dates, other weekdays and outside lab hours', () => {
    const move = { schedule_id: 'a', date: '2026-11-23', kind: 'moved' as const, new_date: '2026-11-23', new_start: '10:00', new_end: '13:00', new_lab: 'lab1', note: null };
    expect(classChangeProblems(move, ctx([a, b]))).toEqual([]);
    expect(classChangeProblems({ ...move, date: '2026-11-16' }, ctx([a]))).toEqual(['That class meeting has already passed.']);
    expect(classChangeProblems({ ...move, date: '2026-11-24' }, ctx([a]))).toEqual(["This class doesn't meet on that date."]);
    expect(classChangeProblems({ ...move, new_start: '18:00', new_end: '21:00' }, ctx([a]))[0]).toMatch(/open 8:00 AM to 8:00 PM/);
  });
});
