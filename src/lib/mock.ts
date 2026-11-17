// Demo backend: in-memory state persisted to localStorage. Used when Supabase isn't configured.
import type { Api } from './api';
import { classesOn, manilaNow, slotsOverlap } from './seat';
import { seed, seedSchedules, type MockState } from './seed';
import type { Pc, Profile, Role } from './types';
import { isSchoolEmail, schedulesOverlap, validateReservation, validateSchedule, validateStudent } from './validate';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'comlab-mock';
const SESSION_KEY = 'comlab-mock-session';

function browserStorage(): Store | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function createMock(storage: Store | null = browserStorage()): Api {
  let state: MockState;
  try { state = JSON.parse(storage?.getItem(KEY) ?? 'null') ?? seed(); } catch { state = seed(); }
  state.schedules ??= seedSchedules(); // demo data saved before weekly classes existed
  let sessionId: string | null = null;
  try { sessionId = storage?.getItem(SESSION_KEY) ?? null; } catch { /* private mode */ }

  const pcListeners = new Set<(pc: Pc) => void>();
  const resListeners = new Set<() => void>();
  const authListeners = new Set<() => void>();

  const save = () => {
    try { storage?.setItem(KEY, JSON.stringify(state)); storage?.setItem(SESSION_KEY, sessionId ?? ''); } catch { /* quota/private */ }
  };
  const me = (): Profile => {
    const p = state.profiles.find((x) => x.id === sessionId);
    if (!p || !p.approved) throw new Error('Not allowed: sign in with an approved account.');
    return p;
  };
  const need = (...roles: Role[]) => {
    const p = me();
    if (!roles.includes(p.role)) throw new Error('Not allowed for your role.');
    return p;
  };
  const changedRes = () => { save(); resListeners.forEach((f) => f()); };
  const clone = <T,>(x: T): T => structuredClone(x);

  return {
    demo: true,

    async getSession() { return clone(state.profiles.find((p) => p.id === sessionId) ?? null); },
    onAuthChange(cb) { authListeners.add(cb); return () => authListeners.delete(cb); },
    async signIn(email) {
      const p = state.profiles.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!p) throw new Error('No account with that email. Demo accounts: admin@, staff@, teacher@smcbi.edu.ph');
      sessionId = p.id; save(); authListeners.forEach((f) => f());
    },
    async signUp(i) {
      if (!isSchoolEmail(i.email)) throw new Error('Use your @smcbi.edu.ph email.');
      if (i.password.length < 8) throw new Error('Password must be at least 8 characters.');
      if (state.profiles.some((p) => p.email.toLowerCase() === i.email.toLowerCase())) throw new Error('That email is already registered.');
      const p: Profile = { id: uid(), full_name: i.full_name, email: i.email.trim(), role: 'teacher', approved: false,
        department: i.department, course: i.course, phone: null, address: null };
      state.profiles.push(p); sessionId = p.id; save(); authListeners.forEach((f) => f());
    },
    async signOut() { sessionId = null; save(); authListeners.forEach((f) => f()); },

    async listLabs() { me(); return clone(state.labs); },
    async listPcs(labId) { me(); return clone(state.pcs.filter((p) => !labId || p.lab_id === labId)); },
    async setPcStatus(pcId, status, note = null) {
      need('admin', 'staff');
      const pc = state.pcs.find((p) => p.id === pcId);
      if (!pc) throw new Error('PC not found.');
      Object.assign(pc, { status, note, updated_at: new Date().toISOString() });
      save();
      pcListeners.forEach((f) => f(clone(pc)));
    },
    subscribePcs(labId, cb) {
      const f = (pc: Pc) => { if (!labId || pc.lab_id === labId) cb(pc); };
      pcListeners.add(f);
      return () => pcListeners.delete(f);
    },
    subscribeReservations(cb) { resListeners.add(cb); return () => resListeners.delete(cb); },

    async listReservations(f = {}) {
      const p = me();
      return clone(state.reservations
        .filter((r) => (!f.labId || r.lab_id === f.labId) && (!f.date || r.date === f.date) &&
          (!f.status || r.status === f.status) && (!f.mine || r.requester_id === p.id))
        .sort((a, b) => (b.date + b.start_time).localeCompare(a.date + a.start_time)));
    },
    async createReservation(input) {
      const p = me();
      const errs = validateReservation(input, manilaNow().date);
      if (errs.length) throw new Error(errs.join(' '));
      const r = { ...input, id: uid(), requester_id: p.id, requester_name: p.full_name, status: 'pending' as const,
        admin_notes: null, reviewed_at: null };
      state.reservations.push(r); changedRes();
      return clone(r);
    },
    async reviewReservation(id, status, notes = null) {
      need('admin');
      const r = state.reservations.find((x) => x.id === id);
      if (!r) throw new Error('Reservation not found.');
      if (status === 'approved' && state.reservations.some((o) => o.id !== id && o.status === 'approved' && slotsOverlap(o, r)))
        throw new Error('This slot overlaps an approved reservation.');
      if (status === 'approved' && classesOn(r.date, state.schedules).some((c) => slotsOverlap(c, r)))
        throw new Error('This slot overlaps a regular class in this lab.');
      Object.assign(r, { status, admin_notes: notes ?? r.admin_notes, reviewed_at: new Date().toISOString() });
      changedRes();
    },
    async deleteReservation(id) {
      const p = me();
      const r = state.reservations.find((x) => x.id === id);
      if (!r) throw new Error('Reservation not found.');
      if (r.status !== 'pending') throw new Error('Only pending reservations can be deleted.');
      if (r.requester_id !== p.id && p.role !== 'admin') throw new Error('Not allowed for your role.');
      state.reservations = state.reservations.filter((x) => x.id !== id); changedRes();
    },

    async listProfiles(role) { me(); return clone(state.profiles.filter((p) => !role || p.role === role)); },
    async updateProfile(id, patch) {
      const p = me();
      if (p.role !== 'admin' && (p.id !== id || 'role' in patch || 'approved' in patch)) throw new Error('Not allowed for your role.');
      const t = state.profiles.find((x) => x.id === id);
      if (!t) throw new Error('Profile not found.');
      Object.assign(t, patch); save();
    },

    async listStudents() { me(); return clone(state.students); },
    async saveStudent(s) {
      need('admin');
      const errs = validateStudent(s);
      if (errs.length) throw new Error(errs.join(' '));
      if (state.students.some((x) => x.id !== s.id && x.student_id === s.student_id)) throw new Error('Student ID already exists.');
      if (state.students.some((x) => x.id !== s.id && x.email.toLowerCase() === s.email.toLowerCase())) throw new Error('Email already exists.');
      const existing = state.students.find((x) => x.id === s.id);
      if (existing) Object.assign(existing, s); else state.students.push({ ...s, id: uid() });
      save();
    },
    async deleteStudent(id) { need('admin'); state.students = state.students.filter((x) => x.id !== id); save(); },

    async listEvents() { me(); return clone(state.events); },
    async saveEvent(e) {
      const p = me();
      if (!e.title.trim() || !e.event_date) throw new Error('Title and date are required.');
      const existing = state.events.find((x) => x.id === e.id);
      if (existing) {
        if (existing.owner_id !== p.id && p.role !== 'admin') throw new Error('Not allowed for your role.');
        Object.assign(existing, e);
      } else state.events.push({ ...e, id: uid(), owner_id: p.id });
      save();
    },
    async deleteEvent(id) {
      const p = me();
      const e = state.events.find((x) => x.id === id);
      if (e && e.owner_id !== p.id && p.role !== 'admin') throw new Error('Not allowed for your role.');
      state.events = state.events.filter((x) => x.id !== id); save();
    },

    async listSchedules() { me(); return clone(state.schedules); },
    async saveSchedule(s) {
      need('admin');
      const errs = validateSchedule(s);
      if (errs.length) throw new Error(errs.join(' '));
      if (state.schedules.some((o) => o.id !== s.id && schedulesOverlap(o, s)))
        throw new Error('This class overlaps another class in the same lab.');
      const existing = state.schedules.find((x) => x.id === s.id);
      if (existing) Object.assign(existing, s); else state.schedules.push({ ...s, id: uid() });
      save(); resListeners.forEach((f) => f());
    },
    async deleteSchedule(id) {
      need('admin');
      state.schedules = state.schedules.filter((x) => x.id !== id); save(); resListeners.forEach((f) => f());
    },

    async stats() {
      me();
      return {
        students: state.students.length,
        staff: state.profiles.filter((p) => p.role === 'staff').length,
        teachers: state.profiles.filter((p) => p.role === 'teacher' && p.approved).length,
        courses: new Set(state.students.map((s) => s.course)).size,
        pending: state.reservations.filter((r) => r.status === 'pending').length,
        pendingTeachers: state.profiles.filter((p) => !p.approved).length,
      };
    },
  };
}
