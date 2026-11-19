import { createMock } from './mock';
import type { ReservationInput } from './types';

const input = (over: Partial<ReservationInput> = {}): ReservationInput => ({
  title: 'Class', lab_id: 'lab1', pc_id: null, purpose: 'Lab', date: '2099-01-05',
  start_time: '08:00', end_time: '10:00', participants: 20, requirements: null, ...over,
});

async function asAdmin() {
  const api = createMock(null);
  await api.signIn('admin@smcbi.edu.ph', 'x');
  return api;
}

describe('mock api', () => {
  it('seeds 3 labs with their real PC counts', async () => {
    const api = await asAdmin();
    const labs = await api.listLabs();
    expect(labs.map((l) => l.name)).toEqual(['Computer Laboratory 1', 'Computer Laboratory 2', 'Networking Laboratory']);
    expect((await Promise.all(labs.map((l) => api.listPcs(l.id)))).map((p) => p.length)).toEqual([40, 44, 30]);
  });

  it('seeds admin, staff, approved teacher and pending teacher', async () => {
    const api = await asAdmin();
    const ps = await api.listProfiles();
    expect(ps.some((p) => p.role === 'admin')).toBe(true);
    expect(ps.some((p) => p.role === 'staff')).toBe(true);
    expect(ps.some((p) => p.role === 'teacher' && p.approved)).toBe(true);
    expect(ps.some((p) => p.role === 'teacher' && !p.approved)).toBe(true);
  });

  it('rejects a reservation with a past date', async () => {
    const api = await asAdmin();
    await expect(api.createReservation(input({ date: '2000-01-01' }))).rejects.toThrow(/today or later/);
  });

  it('new reservations are pending', async () => {
    const api = await asAdmin();
    expect((await api.createReservation(input())).status).toBe('pending');
  });

  it('approving an overlapping reservation fails with a conflict', async () => {
    const api = await asAdmin();
    const a = await api.createReservation(input());
    const b = await api.createReservation(input({ pc_id: 'lab1-pc05', start_time: '09:00', end_time: '11:00' }));
    await api.reviewReservation(a.id, 'approved');
    await expect(api.reviewReservation(b.id, 'approved')).rejects.toThrow(/overlaps/);
  });

  it('only an admin can delete (archive) an approved reservation', async () => {
    const api = createMock(null);
    await api.signIn('teacher@smcbi.edu.ph', 'x');
    const a = await api.createReservation(input());
    await api.signIn('admin@smcbi.edu.ph', 'x');
    await api.reviewReservation(a.id, 'approved');
    await api.signIn('teacher@smcbi.edu.ph', 'x');
    await expect(api.deleteReservation(a.id)).rejects.toThrow(/not allowed/i);
    await api.signIn('admin@smcbi.edu.ph', 'x');
    await api.deleteReservation(a.id);
    expect((await api.listArchive())[0]).toMatchObject({ kind: 'reservation', row_id: a.id });
  });

  it('teachers cannot approve reservations or change PC status', async () => {
    const api = createMock(null);
    await api.signIn('teacher@smcbi.edu.ph', 'x');
    const a = await api.createReservation(input());
    await expect(api.reviewReservation(a.id, 'approved')).rejects.toThrow(/not allowed/i);
    await expect(api.setPcStatus('lab1-pc01', 'broken')).rejects.toThrow(/not allowed/i);
  });

  it('notifies PC subscribers after a status change', async () => {
    const api = await asAdmin();
    const seen: string[] = [];
    const off = api.subscribePcs('lab1', (pc) => seen.push(`${pc.label}:${pc.status}`));
    await api.setPcStatus('lab1-pc03', 'broken', 'No display');
    off();
    await api.setPcStatus('lab1-pc03', 'free');
    expect(seen).toEqual(['PC-03:broken']);
  });

  it('sign-up requires a school email and creates a pending teacher', async () => {
    const api = createMock(null);
    await expect(api.signUp({ full_name: 'X', email: 'x@gmail.com', password: 'Passw0rd!', department: 'BSIT', course: 'IT' }))
      .rejects.toThrow(/smcbi/);
    await api.signUp({ full_name: 'New T', email: 'new@smcbi.edu.ph', password: 'Passw0rd!', department: 'BSIT', course: 'IT' });
    expect(await api.getSession()).toMatchObject({ role: 'teacher', approved: false });
  });

  it('persists state to storage', async () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const a = createMock(storage);
    await a.signIn('admin@smcbi.edu.ph', 'x');
    await a.setPcStatus('lab2-pc10', 'in_use');
    const b = createMock(storage);
    expect((await b.listPcs('lab2')).find((p) => p.id === 'lab2-pc10')?.status).toBe('in_use');
  });
});

describe('mock class schedule', () => {
  const cls = {
    lab_id: 'lab1', section: 'BSIT 9Z', subject: 'Test class', instructor: 'T', day_of_week: 1,
    start_time: '08:00', end_time: '11:00', starts_on: '2099-01-01', ends_on: '2099-12-31',
  };
  it('refuses a booking during a weekly class when it is requested', async () => {
    const api = await asAdmin();
    await api.saveSchedule(cls);
    await expect(api.createReservation(input({ date: '2099-01-05', start_time: '10:00', end_time: '12:00' }))).rejects.toThrow(/class/i); // a Monday
  });
  it('lets a student sign up with their school email and book only NetLab PCs', async () => {
    const api = createMock(null);
    await api.signUp({ full_name: 'x', email: 'C260001@smcbi.edu.ph', password: 'password1', department: '', course: '', account_type: 'student' });
    const me = await api.getSession();
    expect(me).toMatchObject({ role: 'student', approved: true, full_name: '1st Year Student 001' });
    await expect(api.createReservation(input({ lab_id: 'lab1', pc_id: 'lab1-pc01', date: '2099-01-06' }))).rejects.toThrow(/only book the Networking/);
    await expect(api.createReservation(input({ lab_id: 'netlab', pc_id: 'netlab-pc18', date: '2099-01-06' }))).rejects.toThrow(/broken/);
    await expect(api.createReservation(input({ lab_id: 'netlab', pc_id: 'netlab-pc01', date: '2099-01-06' }))).resolves.toMatchObject({ status: 'pending' });
  });
  it('rejects two classes in the same lab at the same time', async () => {
    const api = await asAdmin();
    await api.saveSchedule(cls);
    await expect(api.saveSchedule({ ...cls, section: 'BSIT 9Y', start_time: '10:00', end_time: '12:00' })).rejects.toThrow(/overlaps/i);
  });
  it('only admins can change the schedule', async () => {
    const api = createMock(null);
    await api.signIn('teacher@smcbi.edu.ph', 'x');
    await expect(api.saveSchedule(cls)).rejects.toThrow(/not allowed/i);
    expect((await api.listSchedules()).length).toBeGreaterThan(0);
  });
});

describe('mock problem reports', () => {
  it('students report, cannot spam the same PC, and staff mark it broken', async () => {
    const api = createMock(null);
    await api.signIn('c230001@smcbi.edu.ph', 'x');
    await api.reportProblem('netlab-pc01', 'No display', 'black screen');
    await expect(api.reportProblem('netlab-pc01', 'No internet')).rejects.toThrow(/already reported/);
    await expect(api.resolveReport((await api.listReports())[0].id, 'broken')).rejects.toThrow(/not allowed/i);

    await api.signIn('staff@smcbi.edu.ph', 'x');
    expect((await api.stats()).openReports).toBe(1);
    const [r] = await api.listReports({ labId: 'netlab' });
    expect(r).toMatchObject({ problem: 'No display', user_name: '4th Year Student 001', resolved_at: null });
    await api.resolveReport(r.id, 'broken');
    const pc = (await api.listPcs('netlab')).find((p) => p.id === 'netlab-pc01');
    expect(pc).toMatchObject({ status: 'broken', note: 'No display: black screen' });
    expect(await api.listReports()).toEqual([]);
    expect((await api.listReports({ all: true }))[0].resolution).toBe('broken');
  });
});

describe('mock archive', () => {
  it('delete moves records to the archive and restore puts them back', async () => {
    const api = createMock(null);
    await api.signIn('admin@smcbi.edu.ph', 'x');
    const before = (await api.listStudents()).length;
    const s = (await api.listStudents())[0];
    await api.deleteStudent(s.id);
    expect((await api.listStudents()).length).toBe(before - 1);
    const [a] = await api.listArchive();
    expect(a).toMatchObject({ kind: 'student', row_id: s.id, label: `${s.student_id} · ${s.full_name}` });
    await api.restoreArchived(a.id);
    expect((await api.listStudents()).find((x) => x.id === s.id)).toEqual(s);
    expect(await api.listArchive()).toEqual([]);

    await api.deleteSchedule((await api.listSchedules())[0].id);
    await api.purgeArchived((await api.listArchive())[0].id);
    expect(await api.listArchive()).toEqual([]);
  });

  it('an archived account loses access until restored; others cannot archive', async () => {
    const api = createMock(null);
    await api.signIn('teacher@smcbi.edu.ph', 'x');
    await expect(api.deleteStudent('stu-C260001')).rejects.toThrow(/not allowed/i);
    await api.signIn('admin@smcbi.edu.ph', 'x');
    await expect(api.setAccountArchived('admin', true)).rejects.toThrow(/own account/);
    await api.setAccountArchived('teacher', true);
    await api.signIn('teacher@smcbi.edu.ph', 'x');
    await expect(api.listLabs()).rejects.toThrow(/not allowed/i);
    await api.signIn('admin@smcbi.edu.ph', 'x');
    await api.setAccountArchived('teacher', false);
    await api.signIn('teacher@smcbi.edu.ph', 'x');
    await expect(api.listLabs()).resolves.toHaveLength(3);
  });

  it('supports maintenance status and marks reports fixed when restored to free', async () => {
    const api = createMock(null);
    await api.signIn('c230001@smcbi.edu.ph', 'x');
    await api.reportProblem('lab1-pc04', 'Broken keyboard');

    await api.signIn('admin@smcbi.edu.ph', 'x');
    await api.setPcStatus('lab1-pc04', 'maintenance', 'Scheduled check');
    let pcs = await api.listPcs('lab1');
    expect(pcs.find((p) => p.id === 'lab1-pc04')?.status).toBe('maintenance');

    await api.setPcStatus('lab1-pc04', 'free');
    pcs = await api.listPcs('lab1');
    expect(pcs.find((p) => p.id === 'lab1-pc04')?.status).toBe('free');

    const reports = await api.listReports({ all: true });
    const rep = reports.find((r) => r.pc_id === 'lab1-pc04');
    expect(rep?.resolution).toBe('fixed');
    expect(rep?.resolved_at).toBeTruthy();
  });
});

describe('mock account email', () => {
  it('admin changes a student login email; the student record follows', async () => {
    const api = createMock(null);
    await api.signIn('admin@smcbi.edu.ph', 'x');
    await expect(api.updateAccountEmail('student', 'someone@gmail.com')).rejects.toThrow(/smcbi/);
    await expect(api.updateAccountEmail('student', 'teacher@smcbi.edu.ph')).rejects.toThrow(/already uses/);
    await api.updateAccountEmail('student', 'C230505@smcbi.edu.ph');
    expect((await api.listProfiles('student'))[0].email).toBe('c230505@smcbi.edu.ph');
    expect((await api.listStudents()).find((s) => s.student_id === 'C230001')?.email).toBe('c230505@smcbi.edu.ph');
    await api.signIn('c230505@smcbi.edu.ph', 'x');
    expect((await api.getSession())?.role).toBe('student');
  });
});
