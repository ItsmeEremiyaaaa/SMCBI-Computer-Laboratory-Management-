// People module rules: student records, class sections and name matching.
import { DEPARTMENTS, SEXES, STUDENT_STATUSES, YEAR_LEVELS, type Student } from '../../../shared/data/types';

type StudentInput = Pick<Student, 'student_id' | 'full_name' | 'email' | 'course' | 'section' | 'year_level'> & Partial<Pick<Student, 'sex' | 'status'>>;

export function validateStudent(s: StudentInput): string[] {
  const e: string[] = [];
  if (!s.student_id?.trim()) e.push('Student ID is required.');
  if (!s.full_name?.trim()) e.push('Full name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email ?? '')) e.push('Enter a valid email.');
  if (!(DEPARTMENTS as readonly string[]).includes(s.course)) e.push('Choose a course.');
  if (!s.section?.trim()) e.push('Section is required.');
  if (!(YEAR_LEVELS as readonly string[]).includes(s.year_level)) e.push('Choose a year level.');
  if (s.sex != null && !(SEXES as readonly string[]).includes(s.sex)) e.push('Choose male or female.');
  if (s.status != null && !(STUDENT_STATUSES as readonly string[]).includes(s.status)) e.push('Choose a status.');
  return e;
}

/** An account's section from its department and "Nth Year X" course: ('BSIT', '4th Year A') → 'BSIT 4A'. */
export const sectionOf = (department: string | null, course: string | null) => {
  const m = course?.match(/^(\d)\D+Year\s+([A-Z])$/i);
  return department && m ? `${department} ${m[1]}${m[2].toUpperCase()}` : null;
};

/** Enrolled students of a timetable section, by student ID: "BSIT 1A" → BSIT, 1st Year, section A; "BSIT 4" → every 4th-year section. */
export function studentsInSection(students: Student[], section: string | null | undefined): Student[] {
  const m = section?.match(/^([A-Z]+)\s*(\d)\s*([A-Z])?$/i);
  if (!m) return [];
  const year = `${m[2]}${['', 'st', 'nd', 'rd'][Number(m[2])] ?? 'th'} Year`;
  return students
    .filter((s) => s.course === m[1].toUpperCase() && s.year_level === year && (!m[3] || s.section.toUpperCase() === m[3].toUpperCase())
      && (s.status ?? 'Enrolled') === 'Enrolled')
    .sort((a, b) => a.student_id.localeCompare(b.student_id));
}

/** Whether a class section ('BSIT 2B', or 'BSIT 4' = the whole year) includes a student's section ('BSIT 4A'). */
export function sectionIncludes(classSection: string | null | undefined, studentSection: string | null | undefined) {
  const re = /^([A-Z]+)\s*(\d)\s*([A-Z])?$/i;
  const c = classSection?.trim().match(re), s = studentSection?.trim().match(re);
  if (!c || !s) return false;
  return c[1].toUpperCase() === s[1].toUpperCase() && c[2] === s[2] && (!c[3] || c[3].toUpperCase() === (s[3] ?? '').toUpperCase());
}

/** Enrolled students in a class section ('BSIT 2B', or 'BSIT 4' = the whole year), from per-section counts. */
export function sectionSize(sizes: { course: string; year_level: string; section: string; n: number }[], classSection: string) {
  return sizes.filter((x) => sectionIncludes(classSection, `${x.course} ${x.year_level.charAt(0)}${x.section}`)).reduce((t, x) => t + x.n, 0);
}

// "S. April Mariae Libradilla, RVM" and "April Libradilla" both → "april libradilla":
// drop titles/degrees after a comma and single-letter initials, keep first and last name.
export function nameKey(name: string) {
  const words = name.split(',')[0].toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
  return words.length ? `${words[0]} ${words[words.length - 1]}` : '';
}
