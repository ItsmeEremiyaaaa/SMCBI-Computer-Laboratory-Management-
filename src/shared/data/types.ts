export type Role = 'admin' | 'staff' | 'teacher' | 'student';
export type PcStatus = 'free' | 'in_use' | 'broken' | 'maintenance';
export type ShownStatus = PcStatus | 'reserved';
export type ResStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
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
  /** set when an admin archives the login: it keeps its data but has no access */
  archived_at?: string | null;
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
  /** Class section the booking is for (teacher bookings), e.g. 'BSIT 2B'; its students are notified. */
  section?: string | null;
  created_at?: string;
  /** Class meetings only: which weekly class and date this is, and its one-day change if any. */
  schedule_id?: string;
  class_date?: string;
  class_change?: ClassChange;
}

export type ReservationInput = Pick<Reservation,
  'title' | 'lab_id' | 'pc_id' | 'purpose' | 'date' | 'start_time' | 'end_time' | 'participants' | 'requirements'> & {
  section?: string | null;
  /** Admin only: file the booking under this teacher instead of the admin. */
  requester_id?: string;
  /** Admin only: name of a scheduled instructor who has no account yet. */
  requester_name?: string;
};

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
type Sex = (typeof SEXES)[number];
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
  /** One-day changes to this class (cancelled / activity only / moved), attached when classes are loaded. */
  changes?: ClassChange[];
}
export type ScheduleInput = Omit<ClassSchedule, 'id' | 'changes'> & { id?: string };

export type ClassChangeKind = 'cancelled' | 'activity' | 'moved';
/** One meeting of a weekly class, changed for that date only. */
export interface ClassChange {
  id: string;
  schedule_id: string;
  date: string; // the meeting that changes (YYYY-MM-DD)
  kind: ClassChangeKind;
  new_date: string | null; new_start: string | null; new_end: string | null; new_lab: string | null; // when moved
  note: string | null;
  created_by_name?: string | null;
  created_at?: string;
}
export type ClassChangeInput = Omit<ClassChange, 'id' | 'created_by_name' | 'created_at'>;

// A student confirming which PC they're sitting at (scanned from the PC's QR code).
export interface CheckIn {
  id: string;
  pc_id: string;
  lab_id: string;
  user_id: string;
  user_name: string;
  checked_in_at: string; // ISO timestamp
  checked_out_at: string | null;
}

// A student/teacher reporting a problem with a PC. Staff mark the PC broken or dismiss it.
export const PROBLEMS = ['No display', 'Keyboard / mouse', 'No internet', "Won't turn on", 'Slow / freezing', 'Other'] as const;
export interface PcReport {
  id: string;
  pc_id: string;
  lab_id: string;
  user_id: string;
  user_name: string;
  problem: string;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: 'broken' | 'dismissed' | 'fixed' | null;
  admin_deleted?: boolean;
}

// Rows moved to the Archive by "Delete" (restorable).
export type ArchiveKind = 'student' | 'reservation' | 'event' | 'class';
export interface ArchivedItem {
  id: string;
  kind: ArchiveKind;
  row_id: string;
  label: string;
  data: Record<string, unknown>;
  archived_by_name: string | null;
  archived_at: string;
}

/** One chat message between two accounts. Names are copied in so students never read the accounts table. */
export interface Message {
  id: string;
  from_id: string; to_id: string;
  from_name: string | null; to_name: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
}
export interface Contact { id: string; full_name: string; role: Role }
