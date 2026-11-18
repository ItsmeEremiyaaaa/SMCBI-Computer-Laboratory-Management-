import type {
  CheckIn, ClassSchedule, ScheduleInput,
  Lab, LabEvent, Pc, PcStatus, Profile, Reservation, ReservationInput, ResStatus, Role, Student,
} from './types';
import { createMock } from './mock';
import { createSupabaseApi } from './supabase';

export interface SignUpInput {
  full_name: string; email: string; password: string; department: string; course: string;
  account_type?: 'student' | 'teacher';
}
export interface ReservationFilter { labId?: string; date?: string; status?: ResStatus; mine?: boolean }
export interface Stats {
  students: number; staff: number; teachers: number; courses: number; pending: number; pendingTeachers: number;
}
export type StudentInput = Omit<Student, 'id'> & { id?: string };
export type EventInput = Omit<LabEvent, 'id' | 'owner_id'> & { id?: string };

export interface Api {
  demo: boolean;
  getSession(): Promise<Profile | null>;
  onAuthChange(cb: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(input: SignUpInput): Promise<void>;
  signOut(): Promise<void>;

  listLabs(): Promise<Lab[]>;
  listPcs(labId?: string): Promise<Pc[]>;
  setPcStatus(pcId: string, status: PcStatus, note?: string | null): Promise<void>;
  subscribePcs(labId: string | null, cb: (pc: Pc) => void): () => void;
  subscribeReservations(cb: () => void): () => void;

  listReservations(f?: ReservationFilter): Promise<Reservation[]>;
  createReservation(input: ReservationInput): Promise<Reservation>;
  reviewReservation(id: string, status: 'approved' | 'rejected' | 'completed', notes?: string | null): Promise<void>;
  deleteReservation(id: string): Promise<void>;

  listProfiles(role?: Role): Promise<Profile[]>;
  updateProfile(id: string, patch: Partial<Omit<Profile, 'id' | 'email'>>): Promise<void>;

  listStudents(): Promise<Student[]>;
  saveStudent(s: StudentInput): Promise<void>;
  deleteStudent(id: string): Promise<void>;

  listEvents(): Promise<LabEvent[]>;
  saveEvent(e: EventInput): Promise<void>;
  deleteEvent(id: string): Promise<void>;

  listSchedules(): Promise<ClassSchedule[]>;
  saveSchedule(s: ScheduleInput): Promise<void>;
  deleteSchedule(id: string): Promise<void>;

  stats(): Promise<Stats>;

  /** Active check-ins from today (optionally for one lab). */
  listCheckIns(labId?: string): Promise<CheckIn[]>;
  /** Student confirms they are sitting at this PC (leaves any earlier seat). */
  checkIn(pcId: string): Promise<CheckIn>;
  checkOut(): Promise<void>;
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// No Supabase settings → demo mode with sample data in the browser.
export const api: Api = url && key ? createSupabaseApi(url, key) : createMock();
