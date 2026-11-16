import { isSchoolEmail, validateReservation, validateStudent } from './validate';

const ok = {
  title: 'Programming 1', lab_id: 'lab1', pc_id: null, purpose: 'Lab class', date: '2026-11-20',
  start_time: '08:00', end_time: '10:00', participants: 30, requirements: null,
};

describe('validateReservation', () => {
  const today = '2026-11-16';
  it('accepts a valid reservation', () => expect(validateReservation(ok, today)).toEqual([]));
  it('rejects a past date', () => expect(validateReservation({ ...ok, date: '2026-11-15' }, today)).toHaveLength(1));
  it('rejects end not after start', () => expect(validateReservation({ ...ok, end_time: '08:00' }, today)).toHaveLength(1));
  it('rejects zero participants', () => expect(validateReservation({ ...ok, participants: 0 }, today)).toHaveLength(1));
  it('requires title and purpose', () => expect(validateReservation({ ...ok, title: ' ', purpose: '' }, today)).toHaveLength(2));
});

describe('validateStudent', () => {
  const s = { student_id: '2023-001', full_name: 'Ana Cruz', email: 'ana@smcbi.edu.ph', course: 'BSIT', section: 'A', year_level: '2nd Year' };
  it('accepts a valid student', () => expect(validateStudent(s)).toEqual([]));
  it('rejects unknown course and year', () =>
    expect(validateStudent({ ...s, course: 'BSCS', year_level: '6th Year' })).toHaveLength(2));
});

describe('isSchoolEmail', () => {
  it('accepts school domain', () => expect(isSchoolEmail('a@smcbi.edu.ph')).toBe(true));
  it('accepts mixed case', () => expect(isSchoolEmail('A@SMCBI.edu.ph')).toBe(true));
  it('rejects gmail', () => expect(isSchoolEmail('a@gmail.com')).toBe(false));
  it('rejects lookalike domains', () => expect(isSchoolEmail('a@smcbi.edu.ph.evil.com')).toBe(false));
});
