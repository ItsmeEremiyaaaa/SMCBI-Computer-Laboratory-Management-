export type Role = 'admin' | 'staff' | 'teacher';
export type PcStatus = 'free' | 'in_use' | 'broken';
export type ShownStatus = PcStatus | 'reserved';
export type ResStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type EventType = 'academic' | 'personal' | 'holiday' | 'meeting';

export const DEPARTMENTS = ['BSIT', 'BSBA', 'BSHM', 'BEED', 'BSED'] as const;
export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'] as const;
export const EVENT_TYPES: EventType[] = ['academic', 'personal', 'holiday', 'meeting'];

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  approved: boolean;
  department: string | null;
  course: string | null;
  phone: string | null;
  address: string | null;
}

export interface Lab { id: string; name: string; rows: number; cols: number }

export interface Pc {
  id: string;
  lab_id: string;
  label: string;
  row: number;
  col: number;
  status: PcStatus;
  note: string | null;
  updated_at: string;
}

export interface Reservation {
  id: string;
  title: string;
  lab_id: string;
  pc_id: string | null;
  purpose: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;
  requester_id: string;
  requester_name: string;
  participants: number | null;
  requirements: string | null;
  status: ResStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
}

export type ReservationInput = Pick<Reservation,
  'title' | 'lab_id' | 'pc_id' | 'purpose' | 'date' | 'start_time' | 'end_time' | 'participants' | 'requirements'>;

export interface Student {
  id: string;
  student_id: string;
  full_name: string;
  email: string;
  course: string;
  section: string;
  year_level: string;
  phone: string | null;
  address: string | null;
  sex: Sex | null;
  status: StudentStatus;
}

export const SEXES = ['Male', 'Female'] as const;
export type Sex = (typeof SEXES)[number];
export const STUDENT_STATUSES = ['Enrolled', 'Inactive', 'Dropped', 'Graduated'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

// BSIT enrollment, SY 2026–2027 1st semester (as of July 9, 2026). ID prefix = C + entry year.
export const BSIT_ROSTER = [
  { yy: '26', year_level: '1st Year', male: 71, female: 20 },
  { yy: '25', year_level: '2nd Year', male: 34, female: 14 },
  { yy: '24', year_level: '3rd Year', male: 64, female: 20 },
  { yy: '23', year_level: '4th Year', male: 17, female: 8 },
] as const;

export interface LabEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string;
  event_type: EventType;
  owner_id: string;
}

// A weekly class held in a lab, e.g. every Wednesday 9:00–12:00 for the semester.
export interface ClassSchedule {
  id: string;
  lab_id: string;
  section: string;
  subject: string;
  instructor: string;
  day_of_week: number; // 1 = Monday … 7 = Sunday
  start_time: string;
  end_time: string;
  starts_on: string;
  ends_on: string;
}
export type ScheduleInput = Omit<ClassSchedule, 'id'> & { id?: string };
