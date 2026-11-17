import { DEPARTMENTS, YEAR_LEVELS, type ClassSchedule, type ReservationInput, type Student } from './types';

export function validateReservation(r: ReservationInput, today: string): string[] {
  const e: string[] = [];
  if (!r.title?.trim()) e.push('Title is required.');
  if (!r.purpose?.trim()) e.push('Purpose is required.');
  if (!r.lab_id) e.push('Choose a lab.');
  if (!r.date || r.date < today) e.push('Date must be today or later.');
  if (!r.start_time || !r.end_time || r.end_time <= r.start_time) e.push('End time must be after start time.');
  if (r.participants != null && r.participants < 1) e.push('Participants must be at least 1.');
  return e;
}

type StudentInput = Pick<Student, 'student_id' | 'full_name' | 'email' | 'course' | 'section' | 'year_level'>;

export function validateStudent(s: StudentInput): string[] {
  const e: string[] = [];
  if (!s.student_id?.trim()) e.push('Student ID is required.');
  if (!s.full_name?.trim()) e.push('Full name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email ?? '')) e.push('Enter a valid email.');
  if (!(DEPARTMENTS as readonly string[]).includes(s.course)) e.push('Choose a course.');
  if (!s.section?.trim()) e.push('Section is required.');
  if (!(YEAR_LEVELS as readonly string[]).includes(s.year_level)) e.push('Choose a year level.');
  return e;
}

export const isSchoolEmail = (email: string) => /^[^\s@]+@smcbi\.edu\.ph$/i.test(email.trim());

type ScheduleCheck = Pick<ClassSchedule, 'lab_id' | 'section' | 'subject' | 'day_of_week' | 'start_time' | 'end_time' | 'starts_on' | 'ends_on'>;

export function validateSchedule(s: ScheduleCheck): string[] {
  const e: string[] = [];
  if (!s.lab_id) e.push('Choose a lab.');
  if (!s.section?.trim() || !s.subject?.trim()) e.push('Section and subject are required.');
  if (!(s.day_of_week >= 1 && s.day_of_week <= 7)) e.push('Choose a day.');
  if (!s.start_time || !s.end_time || s.end_time <= s.start_time) e.push('End time must be after start time.');
  if (!s.starts_on || !s.ends_on || s.ends_on < s.starts_on) e.push('The last day must be on or after the first day.');
  return e;
}

// Same lab, same weekday, overlapping times and overlapping date ranges.
export const schedulesOverlap = (a: ScheduleCheck, b: ScheduleCheck) =>
  a.lab_id === b.lab_id && a.day_of_week === b.day_of_week &&
  a.start_time < b.end_time && b.start_time < a.end_time &&
  a.starts_on <= b.ends_on && b.starts_on <= a.ends_on;
