import { studentNotes } from './StudentBell';

const now = { date: '2026-11-18', time: '08:30' };
const recent = new Date().toISOString();
const booking = (o: Record<string, unknown>) => ({
  id: 'b1', title: 'Packet Tracer', lab_id: 'netlab', pc_id: 'netlab-pc05', date: '2026-11-20', start_time: '13:00', end_time: '15:00',
  status: 'pending', reviewed_at: null, admin_notes: null, requester_id: 'me', ...o,
});
const base = { now, section: 'BSIT 1A', userId: 'me', bookings: [], reports: [], classes: [], pcLabel: (id: string) => id.split('-').pop()!.toUpperCase() };
const titles = (o: Partial<Parameters<typeof studentNotes>[0]>) => studentNotes({ ...base, ...o }).map((n) => n.title);

describe('studentNotes', () => {
  it('tells students when a booking is approved or rejected, with the admin note', () => {
    const notes = studentNotes({ ...base, bookings: [booking({ status: 'rejected', reviewed_at: recent, admin_notes: 'Lab closed' })] });
    expect(notes[0]).toMatchObject({ title: 'Booking rejected: Packet Tracer', tone: 'bad', group: 'booking' });
    expect(notes[0].sub).toContain('“Lab closed”');
    expect(titles({ bookings: [booking({ status: 'approved', reviewed_at: recent })] })).toEqual(['Booking approved: Packet Tracer']);
  });

  it("tells students when a teacher books a lab for their section, not other sections'", () => {
    const t = { requester_id: 'teacher1', requester_name: 'Ms. Cruz', pc_id: null, section: 'BSIT 1A', created_at: recent };
    expect(titles({ bookings: [booking(t)] })).toEqual(['Ms. Cruz requested a lab for your class']);
    expect(titles({ bookings: [booking({ ...t, status: 'approved', reviewed_at: recent })] })).toEqual(['Ms. Cruz booked a lab for your class']);
    expect(titles({ bookings: [booking({ ...t, status: 'approved', date: now.date })] })).toEqual(['Today: Packet Tracer']);
    expect(titles({ bookings: [booking({ ...t, section: 'BSIT 2B' })] })).toEqual([]);
    expect(titles({ bookings: [booking({ ...t, status: 'rejected', reviewed_at: recent })] })).toEqual(['Lab booking for your class was not approved']);
  });

  it('warns when the PC on an upcoming booking breaks, but not for past ones', () => {
    const brokenPcs = [{ id: 'netlab-pc05', updated_at: recent }];
    expect(titles({ bookings: [booking({})], brokenPcs })).toEqual(['PC05 you booked is broken']);
    expect(titles({ bookings: [booking({ date: '2026-11-17' })], brokenPcs })).toEqual([]);
  });

  it('reminds about their own class within the hour, only for their section', () => {
    const classes = [
      { id: 'c1', title: 'BSIT 1A: IT112 Programming', lab_id: 'lab2', start_time: '09:00', end_time: '12:00' },
      { id: 'c2', title: 'BSIT 2B: IT213 Info Mgmt', lab_id: 'lab1', start_time: '09:00', end_time: '12:00' },
      { id: 'c3', title: 'BSIT 1A: IT111 Later', lab_id: 'lab2', start_time: '13:00', end_time: '16:00' },
    ];
    expect(titles({ classes })).toEqual(['Class soon: IT112 Programming']);
    expect(titles({ classes, section: null })).toEqual([]);
  });

  it('tells reporters how their problem report was handled', () => {
    const reports = [{ id: 'r1', pc_id: 'netlab-pc02', problem: 'No internet', resolved_at: recent, resolution: 'broken', user_id: 'me' },
      { id: 'r2', pc_id: 'netlab-pc03', problem: 'No display', resolved_at: recent, resolution: 'broken', user_id: 'someone-else' }];
    const notes = studentNotes({ ...base, reports });
    expect(notes.map((n) => n.title)).toEqual(['Your report on PC02 was handled']);
    expect(notes[0].sub).toMatch(/marked broken/);
  });

  it('notifies the student when their reported PC is fixed and ready to use', () => {
    const reports = [{ id: 'r1', pc_id: 'netlab-pc02', problem: 'Keyboard / mouse', resolved_at: recent, resolution: 'fixed', user_id: 'me' }];
    const notes = studentNotes({ ...base, reports });
    expect(notes[0]).toMatchObject({
      title: 'Fixed: PC02 is ready to use!',
      tone: 'good',
      group: 'report',
    });
    expect(notes[0].sub).toMatch(/repaired and is now available/);
  });
});

describe('class change notices', () => {
  const ch = { id: 'k1', date: '2026-11-23', kind: 'moved', new_date: '2026-11-25', new_start: '13:00', new_end: '16:00', new_lab: 'lab2', note: 'Bring USB', created_at: recent };
  const schedules = [{ section: 'BSIT 1A', subject: 'IT111 Intro', changes: [ch] }, { section: 'BSIT 2B', subject: 'IT213', changes: [{ ...ch, id: 'k2', kind: 'cancelled' }] }];
  it("tells a section's students when their class is moved or cancelled, not other sections", () => {
    const notes = studentNotes({ ...base, schedules });
    expect(notes.map((n) => n.title)).toEqual(['BSIT 1A IT111 Intro on Mon, Nov 23 is moved to Wed, Nov 25, 1:00 PM–4:00 PM']);
    expect(notes[0]).toMatchObject({ group: 'class', sub: 'ComLab 2 · “Bring USB”' });
  });
  it('drops notices once the class date has passed', () => {
    expect(studentNotes({ ...base, now: { date: '2026-11-26', time: '08:00' }, schedules })).toEqual([]);
  });
});
