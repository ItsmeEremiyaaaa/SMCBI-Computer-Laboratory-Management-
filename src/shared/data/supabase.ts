// Live backend: Supabase Postgres + Auth + Realtime. Security is enforced by RLS and triggers
// in supabase/migrations; this file only maps rows and errors.
import { createClient } from '@supabase/supabase-js';
import type { Api } from './api';
import type { ArchivedItem, CheckIn, ClassSchedule, Pc, PcReport, Profile, Reservation } from './types';
import { manilaNow } from '../time';

export const hhmm = (t: string) => t.slice(0, 5);

export function friendlyError(e: { message: string; code?: string }): Error {
  if (e.message === 'conflict') return new Error('This slot overlaps an approved reservation.');
  if (e.message === 'class_conflict') return new Error('This slot overlaps a regular class in this lab.');
  if (e.message === 'schedule_conflict') return new Error('This class overlaps another class in the same lab.');
  if (e.code === '42501' || /row-level security/.test(e.message)) return new Error('Not allowed for your role.');
  if (e.code === '23505' && /pc_reports/.test(e.message)) return new Error('You already reported a problem with this PC. Staff will check it.');
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
      if (error) {
        if (error.message === 'Invalid login credentials') throw new Error('Wrong email or password.');
        if (/not confirmed/i.test(error.message)) throw new Error("Your email isn't confirmed yet. Open the confirmation link we emailed you, or send it again below.");
        throw new Error(error.message);
      }
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw new Error(error.message);
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    async resendConfirmation(email) {
      const { error } = await sb.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: window.location.origin } });
      if (error) throw new Error(error.message);
    },
    async signUp(i) {
      const { error } = await sb.auth.signUp({
        email: i.email.trim(), password: i.password,
        options: { data: { full_name: i.full_name, department: i.department, course: i.course, account_type: i.account_type ?? 'teacher' }, emailRedirectTo: window.location.origin },
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
      const rows = ok(await sb.from('pcs').update({ status, note, updated_at: new Date().toISOString() }).eq('id', pcId).select('id'));
      if (!rows.length) throw new Error('Not allowed for your role.');
      if (status === 'free') {
        try {
          await sb.from('pc_reports')
            .update({ resolved_at: new Date().toISOString(), resolution: 'fixed' })
            .eq('pc_id', pcId)
            .or('resolution.is.null,resolution.eq.broken');
        } catch { /* best effort update */ }
      }
    },
    subscribePcs(labId, cb) {
      const ch = sb.channel(`pcs:${labId ?? 'all'}:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pcs', ...(labId ? { filter: `lab_id=eq.${labId}` } : {}) },
          (p) => cb(p.new as Pc))
        .subscribe();
      return () => { sb.removeChannel(ch); };
    },
    subscribeReservations(cb) {
      // One channel per table: if a table isn't published for realtime yet, only that table goes quiet
      // (a rejected binding fails its whole channel). Bursts of changes trigger a single reload.
      let t: ReturnType<typeof setTimeout> | undefined;
      const fire = () => { clearTimeout(t); t = setTimeout(cb, 150); };
      const id = Math.random().toString(36).slice(2);
      const chs = ['reservations', 'class_schedules', 'class_changes', 'pc_reports', 'profiles'].map((table) =>
        sb.channel(`${table}:${id}`).on('postgres_changes', { event: '*', schema: 'public', table }, fire).subscribe());
      return () => { clearTimeout(t); chs.forEach((ch) => sb.removeChannel(ch)); };
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
    async deleteReservation(id) { ok(await sb.rpc('archive_row', { kind: 'reservation', row_id: id })); },

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
    async sectionSizes() { return ok(await sb.rpc('section_sizes')) ?? []; },
    async saveStudent({ id, ...s }) {
      if (id) ok(await sb.from('students').update(s).eq('id', id));
      else ok(await sb.from('students').insert(s));
    },
    async deleteStudent(id) { ok(await sb.rpc('archive_row', { kind: 'student', row_id: id })); },

    async listEvents() {
      return (ok(await sb.from('events').select('*').order('event_date')) as { event_time: string }[])
        .map((e) => ({ ...e, event_time: hhmm(e.event_time) })) as never;
    },
    async saveEvent({ id, ...e }) {
      if (id) ok(await sb.from('events').update(e).eq('id', id));
      else ok(await sb.from('events').insert(e));
    },
    async deleteEvent(id) { ok(await sb.rpc('archive_row', { kind: 'event', row_id: id })); },

    async listSchedules() {
      // each class with its one-day changes (embedded through the class_changes.schedule_id foreign key)
      return (ok(await sb.from('class_schedules').select('*, changes:class_changes(*)').order('day_of_week').order('start_time')) as ClassSchedule[])
        .map((c) => ({ ...c, start_time: hhmm(c.start_time), end_time: hhmm(c.end_time),
          changes: (c.changes ?? []).map((x) => ({ ...x, new_start: x.new_start && hhmm(x.new_start), new_end: x.new_end && hhmm(x.new_end) })) }));
    },
    async saveSchedule({ id, ...c }) {
      const rows = ok(await (id ? sb.from('class_schedules').update(c).eq('id', id) : sb.from('class_schedules').insert(c)).select('id'));
      if (!rows.length) throw new Error('Not allowed for your role.');
    },
    async deleteSchedule(id) { ok(await sb.rpc('archive_row', { kind: 'class', row_id: id })); },
    async saveClassChange(c) {
      // permission and clash checks run in the database trigger (migration 0020)
      ok(await sb.from('class_changes').upsert(c, { onConflict: 'schedule_id,date' }));
    },
    async deleteClassChange(id) {
      const rows = ok(await sb.from('class_changes').delete().eq('id', id).select('id'));
      if (!rows.length) throw new Error('Not allowed for your role.');
    },

    async stats() {
      const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
        const r = await q;
        if (r.error) throw friendlyError(r.error);
        return r.count ?? 0;
      };
      const head = { count: 'exact' as const, head: true };
      const [students, staff, teachers, pending, pendingTeachers, courses, openReports] = await Promise.all([
        count(sb.from('students').select('*', head)),
        count(sb.from('profiles').select('*', head).eq('role', 'staff').eq('approved', true)),
        count(sb.from('profiles').select('*', head).eq('role', 'teacher').eq('approved', true)),
        count(sb.from('reservations').select('*', head).eq('status', 'pending')),
        count(sb.from('profiles').select('*', head).eq('approved', false)),
        sb.from('students').select('course').then((r) => new Set((r.data ?? []).map((x) => x.course)).size),
        // 0 until migration 0008 adds the table
        sb.from('pc_reports').select('*', head).is('resolved_at', null).then((r) => r.count ?? 0),
      ]);
      return { students, staff, teachers, courses, pending, pendingTeachers, openReports };
    },

    async listCheckIns(labId, since) {
      // Without `since`: open check-ins from today (ones left open from earlier days don't count).
      let q = since
        ? sb.from('checkins').select('*').gte('checked_in_at', `${since}T00:00:00+08:00`)
        : sb.from('checkins').select('*').is('checked_out_at', null).gte('checked_in_at', `${manilaNow().date}T00:00:00+08:00`);
      if (labId) q = q.eq('lab_id', labId);
      return ok(await q) as CheckIn[];
    },
    async checkIn(pcId) {
      // lab, user, name and time are filled in (and the rules checked) by the database trigger
      return ok(await sb.from('checkins').insert({ pc_id: pcId }).select().single()) as CheckIn;
    },
    async listReports(o = {}) {
      let q = sb.from('pc_reports').select('*').order('created_at', { ascending: false });
      if (!o.all) q = q.is('resolved_at', null);
      if (o.labId) q = q.eq('lab_id', o.labId);
      return ok(await q) as PcReport[];
    },
    async reportProblem(pcId, problem, note = null) {
      // lab, reporter and time are filled in by the database trigger
      ok(await sb.from('pc_reports').insert({ pc_id: pcId, problem, note: note?.trim() || null }));
    },
    async deleteReports(ids) {
      const rows = ok(await sb.from('pc_reports').delete().in('id', ids).select('id'));
      if (rows.length < ids.length) throw new Error('Some reports could not be deleted (only handled reports, admins only).');
    },
    async resolveReport(id, action) {
      const r = ok(await sb.from('pc_reports').select('*').eq('id', id).single()) as PcReport;
      if (action === 'broken') {
        const rows = ok(await sb.from('pcs').update({ status: 'broken', note: (r.note ? `${r.problem}: ${r.note}` : r.problem).slice(0, 120) }).eq('id', r.pc_id).select('id'));
        if (!rows.length) throw new Error('Not allowed for your role.');
      }
      // closes every open report for that PC, not just this one
      const rows = ok(await sb.from('pc_reports').update({ resolved_at: new Date().toISOString(), resolution: action })
        .eq('pc_id', r.pc_id).is('resolved_at', null).select('id'));
      if (!rows.length) throw new Error('Not allowed for your role.');
    },
    async listArchive() {
      return ok(await sb.from('archive').select('*').order('archived_at', { ascending: false })) as ArchivedItem[];
    },
    async restoreArchived(id) { ok(await sb.rpc('restore_row', { archive_id: id })); },
    async purgeArchived(id) {
      const rows = ok(await sb.from('archive').delete().eq('id', id).select('id'));
      if (!rows.length) throw new Error('Not allowed for your role.');
    },
    async updateAccountEmail(profileId, email) { ok(await sb.rpc('admin_update_email', { profile_id: profileId, new_email: email })); },
    async setAccountArchived(profileId, archived) {
      const rows = ok(await sb.from('profiles').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', profileId).select('id'));
      if (!rows.length) throw new Error('Not allowed for your role.');
    },
    async checkOut() {
      const me = await uid();
      ok(await sb.from('checkins').update({ checked_out_at: new Date().toISOString() }).eq('user_id', me ?? '').is('checked_out_at', null));
    },
  };
}
