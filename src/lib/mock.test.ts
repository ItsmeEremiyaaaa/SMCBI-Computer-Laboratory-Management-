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
  it('seeds 3 labs with 30 PCs each', async () => {
    const api = await asAdmin();
    const labs = await api.listLabs();
    expect(labs.map((l) => l.name)).toEqual(['Computer Laboratory 1', 'Computer Laboratory 2', 'Computer Laboratory Netlab']);
    for (const l of labs) expect(await api.listPcs(l.id)).toHaveLength(30);
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

  it('cannot delete an approved reservation', async () => {
    const api = await asAdmin();
    const a = await api.createReservation(input());
    await api.reviewReservation(a.id, 'approved');
    await expect(api.deleteReservation(a.id)).rejects.toThrow(/pending/);
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
  it('blocks approving a booking during a weekly class', async () => {
    const api = await asAdmin();
    await api.saveSchedule(cls);
    const r = await api.createReservation(input({ date: '2099-01-05', start_time: '10:00', end_time: '12:00' })); // a Monday
    await expect(api.reviewReservation(r.id, 'approved')).rejects.toThrow(/class/i);
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
