import { bookingProblems, checkInProblem, effectiveStatuses } from './rules';
import type { ClassSchedule, Pc, Reservation, ReservationInput } from './types';

const pc = (id: string, status: Pc['status'] = 'free', lab_id = 'netlab'): Pc =>
  ({ id, lab_id, label: id.toUpperCase(), row: 0, col: 0, status, note: null, updated_at: '' });
const pcs = [pc('n1'), pc('n2', 'broken')];
// Wednesday 2026-11-18
const cls: ClassSchedule = { id: 'c1', lab_id: 'netlab', section: 'BSIT 3B', subject: 'IT323', instructor: 'X',
  day_of_week: 3, start_time: '13:00', end_time: '16:00', starts_on: '2026-11-02', ends_on: '2027-03-31' };
const req = (o: Partial<ReservationInput> = {}): ReservationInput => ({ title: 'Practice', purpose: 'Lab work', lab_id: 'netlab', pc_id: 'n1',
  date: '2026-11-18', start_time: '09:00', end_time: '10:00', participants: null, requirements: null, ...o });
const approved = (o: Partial<Reservation>): Reservation => ({ ...req(), id: 'r', requester_id: 'u1', requester_name: 'A', status: 'approved',
  admin_notes: null, reviewed_at: null, ...o });

describe('bookingProblems', () => {
  const ctx = { role: 'student' as const, pcs, reservations: [], schedules: [cls] };
  it('accepts a free NetLab PC outside class', () => expect(bookingProblems(req(), ctx)).toEqual([]));
  it('refuses a broken PC', () => expect(bookingProblems(req({ pc_id: 'n2' }), ctx).join()).toMatch(/broken/));
  it('refuses other labs and whole-lab requests for students', () => {
    expect(bookingProblems(req({ lab_id: 'lab1' }), ctx).join()).toMatch(/only book the Networking/);
    expect(bookingProblems(req({ pc_id: null }), ctx).join()).toMatch(/Choose the PC/);
  });
  it('refuses a slot during a class', () => expect(bookingProblems(req({ start_time: '15:00', end_time: '17:00' }), ctx).join()).toMatch(/class/));
  it('refuses a slot overlapping an approved booking', () =>
    expect(bookingProblems(req(), { ...ctx, reservations: [approved({ start_time: '09:30', end_time: '11:00' })] }).join()).toMatch(/overlaps/));
  it('lets teachers book any lab', () => expect(bookingProblems(req({ lab_id: 'lab1', pc_id: null }), { ...ctx, role: 'teacher' })).toEqual([]));
});

describe('checkInProblem', () => {
  const base = { role: 'student' as const, userId: 'u1', schedules: [cls], reservations: [] as Reservation[], checkIns: [] };
  it('allows check-in from 10 minutes before class', () => {
    expect(checkInProblem(pc('n1'), { ...base, now: { date: '2026-11-18', time: '12:50' } })).toBeNull();
    expect(checkInProblem(pc('n1'), { ...base, now: { date: '2026-11-18', time: '12:45' } })).toMatch(/only check in/);
  });
  it('allows check-in during your own approved booking only', () => {
    const now = { date: '2026-11-18', time: '09:15' };
    expect(checkInProblem(pc('n1'), { ...base, now, reservations: [approved({})] })).toBeNull();
    expect(checkInProblem(pc('n1'), { ...base, now, reservations: [approved({ requester_id: 'other' })] })).toMatch(/only check in/);
  });
  it('refuses broken PCs, taken PCs and non-students', () => {
    const now = { date: '2026-11-18', time: '14:00' };
    expect(checkInProblem(pc('n2', 'broken'), { ...base, now })).toMatch(/broken/);
    expect(checkInProblem(pc('n1'), { ...base, now, checkIns: [{ id: 'k', pc_id: 'n1', lab_id: 'netlab', user_id: 'u2', user_name: 'B', checked_in_at: '', checked_out_at: null }] })).toMatch(/already/);
    expect(checkInProblem(pc('n1'), { ...base, now, role: 'teacher' })).toMatch(/Only student/);
  });
});

describe('effectiveStatuses', () => {
  const pcs = ['a', 'b', 'c', 'd'].map((id) => ({ id, status: id === 'b' ? 'broken' : 'free', shown: id === 'b' ? 'broken' : 'free' }));
  const shown = (r: { shown: string }[]) => r.map((p) => p.shown);
  it('marks only seats with a student as in use during class', () =>
    expect(shown(effectiveStatuses(pcs, 'in_session', 2, new Set()))).toEqual(['in_use', 'broken', 'in_use', 'free']));
  it('reserves assigned seats while students arrive', () =>
    expect(shown(effectiveStatuses(pcs, 'walk_in', 1, new Set()))).toEqual(['reserved', 'broken', 'free', 'free']));
  it('uses every working PC when the class size is unknown', () =>
    expect(shown(effectiveStatuses(pcs, 'in_session', null, new Set()))).toEqual(['in_use', 'broken', 'in_use', 'in_use']));
  it('a QR check-in is in use even outside class, and broken always wins', () => {
    expect(shown(effectiveStatuses(pcs, 'empty', null, new Set(['d', 'b'])))).toEqual(['free', 'broken', 'free', 'in_use']);
    expect(shown(effectiveStatuses(pcs, 'in_session', 1, new Set(['d'])))).toEqual(['in_use', 'broken', 'free', 'in_use']);
  });
});

describe('studentsInSection', () => {
  it('matches course, year and section; a section without a letter means the whole year', async () => {
    const { studentsInSection } = await import('./rules');
    const { bsitRoster } = await import('./seed');
    const all = bsitRoster();
    expect(studentsInSection(all, 'BSIT 1A').every((s) => s.year_level === '1st Year' && s.section === 'A')).toBe(true);
    expect(studentsInSection(all, 'BSIT 1A').length + studentsInSection(all, 'BSIT 1B').length + studentsInSection(all, 'BSIT 1C').length).toBe(91);
    expect(studentsInSection(all, 'BSIT 4')).toHaveLength(25);
    expect(studentsInSection(all, 'BSHM 2A')).toEqual([]);
    expect(studentsInSection(all, null)).toEqual([]);
  });
});
