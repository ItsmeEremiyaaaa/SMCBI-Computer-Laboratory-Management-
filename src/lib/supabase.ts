// Live backend: Supabase Postgres + Auth + Realtime. Security is enforced by RLS and triggers
// in supabase/migrations; this file only maps rows and errors.
import { createClient } from '@supabase/supabase-js';
import type { Api } from './api';
import type { Pc, Profile, Reservation } from './types';

export const hhmm = (t: string) => t.slice(0, 5);

export function friendlyError(e: { message: string; code?: string }): Error {
  if (e.message === 'conflict') return new Error('This slot overlaps an approved reservation.');
  if (e.code === '42501' || /row-level security/.test(e.message)) return new Error('Not allowed for your role.');
  if (e.code === '23505') {
    if (/student_id/.test(e.message)) return new Error('Student ID already exists.');
    if (/email/.test(e.message)) return new Error('Email already exists.');
    return new Error('That record already exists.');
  }
  return new Error(e.message);
}

// Unwraps a supabase-js result or throws a friendly error.
// data is only null on error, or for maybeSingle() with no row (callers cast that case).
function ok<T>(r: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (r.error) throw friendlyError(r.error);
  return r.data as T;
}

const res = (r: Reservation): Reservation => ({ ...r, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time) });

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key);
  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null;

  return {
    demo: false,

    async getSession() {
      const id = await uid();
      if (!id) return null;
      return ok(await sb.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => { if (event !== 'TOKEN_REFRESHED') setTimeout(cb, 0); });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
    },
    async signUp(i) {
      const { error } = await sb.auth.signUp({
        email: i.email.trim(), password: i.password,
        options: { data: { full_name: i.full_name, department: i.department, course: i.course }, emailRedirectTo: window.location.origin },
      });
      // The only sign-up rule the database enforces now is the school email domain.
      if (error) throw new Error(/Database error/.test(error.message) ? 'Sign-up failed. Check that you used your @smcbi.edu.ph email.' : error.message);
    },
    async signOut() { await sb.auth.signOut(); },

    async listLabs() { return ok(await sb.from('labs').select('*').order('id')); },
    async listPcs(labId) {
      let q = sb.from('pcs').select('*').order('lab_id').order('row').order('col');
      if (labId) q = q.eq('lab_id', labId);
      return ok(await q) as Pc[];
    },
    async setPcStatus(pcId, status, note = null) {
      const rows = ok(await sb.from('pcs').update({ status, note }).eq('id', pcId).select('id'));
      if (!rows.length) throw new Error('Not allowed for your role.');
    },
    subscribePcs(labId, cb) {
      const ch = sb.channel(`pcs:${labId ?? 'all'}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pcs', ...(labId ? { filter: `lab_id=eq.${labId}` } : {}) },
          (p) => cb(p.new as Pc))
        .subscribe();
      return () => { sb.removeChannel(ch); };
    },
    subscribeReservations(cb) {
      const ch = sb.channel(`res:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => cb())
        .subscribe();
      return () => { sb.removeChannel(ch); };
    },

    async listReservations(f = {}) {
      let q = sb.from('reservations').select('*').order('date', { ascending: false }).order('start_time', { ascending: false });
      if (f.labId) q = q.eq('lab_id', f.labId);
      if (f.date) q = q.eq('date', f.date);
      if (f.status) q = q.eq('status', f.status);
      if (f.mine) q = q.eq('requester_id', (await uid()) ?? '');
      return (ok(await q) as Reservation[]).map(res);
    },
    async createReservation(input) {
      // requester, status and review fields are set by the database trigger
      return res(ok(await sb.from('reservations').insert(input).select().single()) as Reservation);
    },
    async reviewReservation(id, status, notes = null) {
      const patch = notes == null ? { status } : { status, admin_notes: notes };
      const rows = ok(await sb.from('reservations').update(patch).eq('id', id).select('id'));
      if (!rows.length) throw new Error('Not allowed for your role.');
    },
    async deleteReservation(id) {
      const rows = ok(await sb.from('reservations').delete().eq('id', id).select('id'));
      if (!rows.length) throw new Error('Only pending reservations can be deleted.');
    },

    async listProfiles(role) {
      let q = sb.from('profiles').select('*').order('full_name');
      if (role) q = q.eq('role', role);
      return ok(await q) as Profile[];
    },
    async updateProfile(id, patch) {
      const rows = ok(await sb.from('profiles').update(patch).eq('id', id).select('id'));
      if (!rows.length) throw new Error('Not allowed for your role.');
    },

    async listStudents() { return ok(await sb.from('students').select('*').order('full_name')); },
    async saveStudent({ id, ...s }) {
      if (id) ok(await sb.from('students').update(s).eq('id', id));
      else ok(await sb.from('students').insert(s));
    },
    async deleteStudent(id) { ok(await sb.from('students').delete().eq('id', id)); },

    async listEvents() {
      return (ok(await sb.from('events').select('*').order('event_date')) as { event_time: string }[])
        .map((e) => ({ ...e, event_time: hhmm(e.event_time) })) as never;
    },
    async saveEvent({ id, ...e }) {
      if (id) ok(await sb.from('events').update(e).eq('id', id));
      else ok(await sb.from('events').insert(e));
    },
    async deleteEvent(id) { ok(await sb.from('events').delete().eq('id', id)); },

    async stats() {
      const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
        const r = await q;
        if (r.error) throw friendlyError(r.error);
        return r.count ?? 0;
      };
      const head = { count: 'exact' as const, head: true };
      const [students, staff, teachers, pending, pendingTeachers, courses] = await Promise.all([
        count(sb.from('students').select('*', head)),
        count(sb.from('profiles').select('*', head).eq('role', 'staff').eq('approved', true)),
        count(sb.from('profiles').select('*', head).eq('role', 'teacher').eq('approved', true)),
        count(sb.from('reservations').select('*', head).eq('status', 'pending')),
        count(sb.from('profiles').select('*', head).eq('approved', false)),
        sb.from('students').select('course').then((r) => new Set((r.data ?? []).map((x) => x.course)).size),
      ]);
      return { students, staff, teachers, courses, pending, pendingTeachers };
    },
  };
}
