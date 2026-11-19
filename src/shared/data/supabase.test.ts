import { friendlyError, hhmm } from './supabase';

describe('supabase adapter helpers', () => {
  it('trims Postgres times to HH:MM', () => {
    expect(hhmm('08:30:00')).toBe('08:30');
    expect(hhmm('08:30')).toBe('08:30');
  });

  it('maps the conflict trigger to a readable message', () => {
    expect(friendlyError({ message: 'conflict', code: 'P0001' }).message).toBe('This slot overlaps an approved reservation.');
  });

  it('maps RLS denials to a role message', () => {
    expect(friendlyError({ message: 'new row violates row-level security policy for table "reservations"', code: '42501' }).message)
      .toBe('Not allowed for your role.');
  });

  it('maps duplicate student id and email', () => {
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "students_student_id_key"', code: '23505' }).message)
      .toBe('Student ID already exists.');
    expect(friendlyError({ message: 'duplicate key value violates unique constraint "students_email_key"', code: '23505' }).message)
      .toBe('Email already exists.');
  });

  it('passes other messages through', () => {
    expect(friendlyError({ message: 'Date must be today or later.' }).message).toBe('Date must be today or later.');
  });
});
