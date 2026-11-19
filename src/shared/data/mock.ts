// Demo backend: in-memory state persisted to localStorage. Used when Supabase isn't configured.
import type { Api } from './api';
import { classesOn } from '../../modules/schedule/logic/rules';
import { manilaNow, slotsOverlap } from '../time';
import { seed, seedSchedules, type MockState } from './seed';
import type { ArchivedItem, ArchiveKind, Pc, Profile, Reservation, Role } from './types';
import { isSchoolEmail } from '../../modules/auth/logic/email';
import { schedulesOverlap, validateSchedule } from '../../modules/schedule/logic/rules';
import { validateReservation } from '../../modules/bookings/logic/rules';
import { validateStudent } from '../../modules/people/logic/rules';
import { bookingProblems } from '../../modules/bookings/logic/rules';
import { checkInProblem } from '../../modules/labs/logic/status';

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'comlab-mock-v3'; // v3: Netlab from the sketch (30 PCs)
const SESSION_KEY = 'comlab-mock-session';

function browserStorage(): Store | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function createMock(storage: Store | null = browserStorage()): Api {
  let state: MockState;
  try { state = JSON.parse(storage?.getItem(KEY) ?? 'null') ?? seed(); } catch { state = seed(); }
  state.schedules ??= seedSchedules(); // demo data saved before weekly classes existed
  state.checkIns ??= [];
  state.reports ??= [];
  state.archive ??= [];
  state.labs.forEach((l) => {
    if (l.id === 'lab1') l.name = 'Computer Laboratory 1';
    if (l.id === 'lab2') l.name = 'Computer Laboratory 2';
    if (l.id === 'netlab') l.name = 'Networking Laboratory';
  });
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
    if (!p || !p.approved || p.archived_at) throw new Error('Not allowed: sign in with an approved account.');
    return p;
  };
  const need = (...roles: Role[]) => {
    const p = me();
    if (!roles.includes(p.role)) throw new Error('Not allowed for your role.');
    return p;
  };
  // Same as the database: "delete" moves the row to the archive.
  const LISTS = { student: 'students', reservation: 'reservations', event: 'events', class: 'schedules' } as const;
  const archiveRow = (kind: ArchiveKind, id: string) => {
    const p = me();
    const list = state[LISTS[kind]] as { id: string }[];
    const row = list.find((x) => x.id === id) as unknown as Record<string, string> | undefined;
    if (!row) throw new Error('Not found.');
    const own = (kind === 'reservation' && row.requester_id === p.id && row.status === 'pending') || (kind === 'event' && row.owner_id === p.id);
    if (p.role !== 'admin' && !own) throw new Error('Not allowed for your role.');
    const label = kind === 'student' ? `${row.student_id} · ${row.full_name}` : kind === 'reservation' ? `${row.title} · ${row.date} ${row.start_time}`
      : kind === 'event' ? `${row.title} · ${row.event_date}` : `${row.section} · ${row.subject}`;
    state.archive.unshift({ id: uid(), kind, row_id: id, label, data: row, archived_by_name: p.full_name, archived_at: new Date().toISOString() });
    (state as unknown as Record<string, { id: string }[]>)[LISTS[kind]] = list.filter((x) => x.id !== id);
    changedRes();
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
      // Same as the database: an enrolled student's school email becomes a student account right away.
      const s = state.students.find((x) => x.email.toLowerCase() === i.email.trim().toLowerCase() && (x.status ?? 'Enrolled') === 'Enrolled');
      const p: Profile = s
        ? { id: uid(), full_name: s.full_name, email: i.email.trim(), role: 'student', approved: true,
            department: s.course, course: `${s.year_level} ${s.section}`, phone: null, address: null }
        : { id: uid(), full_name: i.full_name, email: i.email.trim(), role: i.account_type === 'student' ? 'student' : 'teacher', approved: false,
            department: i.department, course: i.course, phone: null, address: null };
      state.profiles.push(p); sessionId = p.id; changedRes(); authListeners.forEach((f) => f());
    },
    async signOut() { sessionId = null; save(); authListeners.forEach((f) => f()); },
    // demo mode has no email; these just succeed
    async resetPassword() {},
    async updatePassword(password) { me(); if (password.length < 8) throw new Error('Password must be at least 8 characters.'); },
    async resendConfirmation() {},

    async listLabs() { me(); return clone(state.labs); },
    async listPcs(labId) { me(); return clone(state.pcs.filter((p) => !labId || p.lab_id === labId)); },
    async setPcStatus(pcId, status, note = null) {
      need('admin', 'staff');
      const pc = state.pcs.find((p) => p.id === pcId);
      if (!pc) throw new Error('PC not found.');
      const oldStatus = pc.status;
      Object.assign(pc, { status, note, updated_at: new Date().toISOString() });

      // When a PC is restored/updated to 'free' (e.g. from broken or maintenance):
      // Resolve any open or broken reports for this PC as 'fixed' so the reporting student receives a fix notification!
      if (status === 'free' && (oldStatus === 'broken' || oldStatus === 'maintenance' || state.reports.some((r) => r.pc_id === pcId && !r.resolved_at))) {
        const at = new Date().toISOString();
        state.reports.forEach((r) => {
          if (r.pc_id === pcId && (!r.resolved_at || r.resolution === 'broken')) {
            r.resolved_at = at;
            r.resolution = 'fixed';
          }
        });
        changedRes();
      }

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
      const active = state.reservations;
      const archivedRes = (state.archive ?? [])
        .filter((a) => a.kind === 'reservation' && a.data)
        .map((a) => a.data as unknown as Reservation);
      const all = p.role === 'admin' || p.role === 'staff' ? active : [...active, ...archivedRes];
      return clone(all
        .filter((r) => (!f.labId || r.lab_id === f.labId) && (!f.date || r.date === f.date) &&
          (!f.status || r.status === f.status) && (!f.mine || r.requester_id === p.id))
        .sort((a, b) => (b.date + b.start_time).localeCompare(a.date + a.start_time)));
    },
    async createReservation(input) {
      const p = me();
      const errs = [...validateReservation(input, manilaNow().date),
        ...bookingProblems(input, { role: p.role, pcs: state.pcs, reservations: state.reservations, schedules: state.schedules })];
      if (errs.length) throw new Error(errs.join(' '));
      if (input.section && p.role === 'student') throw new Error('Only teachers can book for a class section.');
      // an admin may file it under an approved teacher (same as the database trigger)
      const acct = p.role === 'admin' && state.profiles.find((x) => x.id === input.requester_id && x.role === 'teacher' && x.approved);
      const by = acct || { id: p.id, full_name: (p.role === 'admin' && input.requester_name?.trim()) || p.full_name };
      const r = { ...input, section: input.section?.trim() || null, id: uid(), requester_id: by.id, requester_name: by.full_name, status: 'pending' as const,
        admin_notes: null, reviewed_at: null, created_at: new Date().toISOString() };
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
    async deleteReservation(id) { archiveRow('reservation', id); },

    async listProfiles(role) { me(); return clone(state.profiles.filter((p) => !role || p.role === role)); },
    async updateProfile(id, patch) {
      const p = me();
      if (p.role !== 'admin' && (p.id !== id || 'role' in patch || 'approved' in patch)) throw new Error('Not allowed for your role.');
      const t = state.profiles.find((x) => x.id === id);
      if (!t) throw new Error('Profile not found.');
      Object.assign(t, patch); changedRes();
    },

    async listStudents() { me(); return clone(state.students); },
    async sectionSizes() {
      me();
      const m = new Map<string, { course: string; year_level: string; section: string; n: number }>();
      for (const s of state.students) {
        if ((s.status ?? 'Enrolled') !== 'Enrolled') continue;
        const k = `${s.course}|${s.year_level}|${s.section.toUpperCase()}`;
        const e = m.get(k) ?? { course: s.course, year_level: s.year_level, section: s.section.toUpperCase(), n: 0 };
        e.n++; m.set(k, e);
      }
      return [...m.values()];
    },
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
    async deleteStudent(id) { archiveRow('student', id); },

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
    async deleteEvent(id) { archiveRow('event', id); },

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
    async deleteSchedule(id) { archiveRow('class', id); },

    async stats() {
      me();
      return {
        students: state.students.length,
        staff: state.profiles.filter((p) => p.role === 'staff').length,
        teachers: state.profiles.filter((p) => p.role === 'teacher' && p.approved).length,
        courses: new Set(state.students.map((s) => s.course)).size,
        pending: state.reservations.filter((r) => r.status === 'pending').length,
        pendingTeachers: state.profiles.filter((p) => !p.approved).length,
        openReports: state.reports.filter((r) => !r.resolved_at).length,
      };
    },

    async listCheckIns(labId, since) {
      me();
      const today = manilaNow().date;
      return clone(state.checkIns.filter((c) => (since ? c.checked_in_at.slice(0, 10) >= since : !c.checked_out_at && c.checked_in_at.slice(0, 10) >= today)
        && (!labId || c.lab_id === labId)));
    },
    async checkIn(pcId) {
      const p = me();
      const pc = state.pcs.find((x) => x.id === pcId);
      if (!pc) throw new Error('PC not found.');
      const problem = checkInProblem(pc, { role: p.role, userId: p.id, now: manilaNow(), schedules: state.schedules,
        reservations: state.reservations, checkIns: state.checkIns.filter((c) => !c.checked_out_at) });
      if (problem) throw new Error(problem);
      const at = new Date().toISOString();
      state.checkIns.forEach((c) => { if (c.user_id === p.id && !c.checked_out_at) c.checked_out_at = at; });
      const c = { id: uid(), pc_id: pc.id, lab_id: pc.lab_id, user_id: p.id, user_name: p.full_name, checked_in_at: at, checked_out_at: null };
      state.checkIns.push(c); changedRes();
      return clone(c);
    },
    async listReports(o = {}) {
      const p = me();
      const isAdmin = p.role === 'admin' || p.role === 'staff';
      return clone(state.reports.filter((r) => {
        if (isAdmin && r.admin_deleted) return false;
        return (o.all || !r.resolved_at) && (!o.labId || r.lab_id === o.labId);
      }).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async reportProblem(pcId, problem, note = null) {
      const p = me();
      const pc = state.pcs.find((x) => x.id === pcId);
      if (!pc) throw new Error('PC not found.');
      if (!problem.trim()) throw new Error('Choose what is wrong.');
      if (state.reports.some((r) => r.pc_id === pcId && r.user_id === p.id && !r.resolved_at))
        throw new Error('You already reported a problem with this PC. Staff will check it.');
      state.reports.push({ id: uid(), pc_id: pcId, lab_id: pc.lab_id, user_id: p.id, user_name: p.full_name, problem,
        note: note?.trim() || null, created_at: new Date().toISOString(), resolved_at: null, resolution: null });
      changedRes();
    },
    async deleteReports(ids) {
      need('admin');
      state.reports.forEach((r) => {
        if (ids.includes(r.id) && r.resolved_at) {
          r.admin_deleted = true;
        }
      });
      changedRes();
    },
    async resolveReport(id, action) {
      need('admin', 'staff');
      const r = state.reports.find((x) => x.id === id);
      if (!r) throw new Error('Report not found.');
      const pc = state.pcs.find((x) => x.id === r.pc_id);
      if (action === 'broken' && pc) {
        Object.assign(pc, { status: 'broken', note: (r.note ? `${r.problem}: ${r.note}` : r.problem).slice(0, 120), updated_at: new Date().toISOString() });
        pcListeners.forEach((f) => f(clone(pc)));
      }
      const at = new Date().toISOString();
      state.reports.forEach((x) => { if (x.pc_id === r.pc_id && !x.resolved_at) Object.assign(x, { resolved_at: at, resolution: action }); });
      changedRes();
    },
    async listArchive() {
      need('admin');
      const reportItems: ArchivedItem[] = state.reports
        .filter((r) => r.resolved_at && !r.admin_deleted)
        .map((r) => ({
          id: `rep-${r.id}`,
          kind: 'report' as any,
          row_id: r.id,
          label: `${r.pc_id}: ${r.problem}`,
          data: r as any,
          archived_by_name: null,
          archived_at: r.resolved_at!,
        }));
      return clone([...state.archive, ...reportItems]);
    },
    async restoreArchived(id) {
      need('admin');
      const a = state.archive.find((x) => x.id === id);
      if (!a) throw new Error('Not found.');
      (state[LISTS[a.kind]] as unknown[]).push(clone(a.data));
      state.archive = state.archive.filter((x) => x.id !== id); changedRes();
    },
    async purgeArchived(id) { need('admin'); state.archive = state.archive.filter((x) => x.id !== id); save(); },
    async updateAccountEmail(profileId, email) {
      const p = need('admin');
      const e = email.trim().toLowerCase();
      if (!isSchoolEmail(e)) throw new Error('Use an @smcbi.edu.ph email.');
      if (p.id === profileId) throw new Error('Not allowed for your role.');
      const t = state.profiles.find((x) => x.id === profileId);
      if (!t) throw new Error('Account not found.');
      const old = t.email.toLowerCase();
      if (old === e) return;
      if (state.profiles.some((x) => x.id !== profileId && x.email.toLowerCase() === e)) throw new Error('Another account already uses that email.');
      if (state.students.some((s) => s.email.toLowerCase() === e)) throw new Error('A different student record already uses that email.');
      t.email = e;
      state.students.forEach((s) => { if (s.email.toLowerCase() === old) s.email = e; });
      save();
    },
    async setAccountArchived(profileId, archived) {
      const p = need('admin');
      if (p.id === profileId) throw new Error('You cannot archive your own account.');
      const t = state.profiles.find((x) => x.id === profileId);
      if (!t) throw new Error('Profile not found.');
      t.archived_at = archived ? new Date().toISOString() : null; changedRes();
    },
    async checkOut() {
      const p = me();
      const at = new Date().toISOString();
      state.checkIns.forEach((c) => { if (c.user_id === p.id && !c.checked_out_at) c.checked_out_at = at; });
      changedRes();
    },
  };
}
