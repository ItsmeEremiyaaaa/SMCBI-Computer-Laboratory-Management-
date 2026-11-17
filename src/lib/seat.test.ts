import { classesOn, manilaNow, shownStatus, slotsOverlap } from './seat';
import type { Pc, Reservation } from './types';

const slot = (pc_id: string | null, start_time: string, end_time: string, lab_id = 'lab1') => ({
  lab_id, pc_id, date: '2026-11-20', start_time, end_time,
});

const res = (over: Partial<Reservation>): Reservation => ({
  id: 'r1', title: 'Class', lab_id: 'lab1', pc_id: null, purpose: 'x', date: '2026-11-20',
  start_time: '08:00', end_time: '10:00', requester_id: 'u1', requester_name: 'T', participants: null,
  requirements: null, status: 'approved', admin_notes: null, reviewed_at: null, ...over,
});

const pc = (status: Pc['status']): Pc => ({
  id: 'p5', lab_id: 'lab1', label: 'PC-05', row: 0, col: 4, status, note: null, updated_at: '',
});

describe('slotsOverlap', () => {
  it('whole-lab conflicts with a PC booking in the same lab, both ways', () => {
    expect(slotsOverlap(slot(null, '08:00', '10:00'), slot('p5', '09:00', '11:00'))).toBe(true);
    expect(slotsOverlap(slot('p5', '09:00', '11:00'), slot(null, '08:00', '10:00'))).toBe(true);
  });
  it('different PCs at the same time do not conflict', () => {
    expect(slotsOverlap(slot('p5', '08:00', '10:00'), slot('p6', '08:00', '10:00'))).toBe(false);
  });
  it('back-to-back slots do not conflict', () => {
    expect(slotsOverlap(slot(null, '08:00', '10:00'), slot(null, '10:00', '12:00'))).toBe(false);
  });
  it('different labs do not conflict', () => {
    expect(slotsOverlap(slot(null, '08:00', '10:00'), slot(null, '08:00', '10:00', 'lab2'))).toBe(false);
  });
  it('different dates do not conflict', () => {
    expect(slotsOverlap(slot(null, '08:00', '10:00'), { ...slot(null, '08:00', '10:00'), date: '2026-11-21' })).toBe(false);
  });
});

describe('shownStatus', () => {
  const now = { date: '2026-11-20', time: '09:00' };
  it('broken PC with no reservation stays broken', () => {
    expect(shownStatus(pc('broken'), [], now)).toBe('broken');
  });
  it('free PC under an approved whole-lab reservation covering now is reserved', () => {
    expect(shownStatus(pc('free'), [res({})], now)).toBe('reserved');
  });
  it('PC reservation for another PC does not reserve this one', () => {
    expect(shownStatus(pc('free'), [res({ pc_id: 'p6' })], now)).toBe('free');
  });
  it('reservation that ended exactly now does not reserve', () => {
    expect(shownStatus(pc('free'), [res({ end_time: '09:00' })], now)).toBe('free');
  });
  it('pending reservations are ignored', () => {
    expect(shownStatus(pc('in_use'), [res({ status: 'pending' })], now)).toBe('in_use');
  });
});

describe('manilaNow', () => {
  it('uses Asia/Manila time across midnight', () => {
    expect(manilaNow(new Date('2026-11-16T16:30:00Z'))).toEqual({ date: '2026-11-17', time: '00:30' });
  });
});

describe('classesOn', () => {
  const cls = {
    id: 'c1', lab_id: 'lab2', section: 'BSIT 1A', subject: 'IT121 Computer Programming 2', instructor: 'Caballero',
    day_of_week: 3, start_time: '09:00', end_time: '12:00', starts_on: '2026-11-02', ends_on: '2027-03-31',
  };
  it('turns a weekly class into an approved whole-lab booking on its weekday', () => {
    expect(classesOn('2026-11-18', [cls])).toEqual([expect.objectContaining({
      lab_id: 'lab2', pc_id: null, date: '2026-11-18', start_time: '09:00', end_time: '12:00', status: 'approved',
      title: 'BSIT 1A: IT121 Computer Programming 2', requester_name: 'Caballero',
    })]);
  });
  it('skips other weekdays and dates outside the semester', () => {
    expect(classesOn('2026-11-19', [cls])).toEqual([]);
    expect(classesOn('2026-10-28', [cls])).toEqual([]);
    expect(classesOn('2027-04-07', [cls])).toEqual([]);
  });
  it('treats Sunday as day 7', () => {
    expect(classesOn('2026-11-22', [{ ...cls, day_of_week: 7 }])).toHaveLength(1);
  });
  it('makes the lab show as in_use during class', () => {
    const p = { ...pc('free'), lab_id: 'lab2' };
    expect(shownStatus(p, classesOn('2026-11-18', [cls]), { date: '2026-11-18', time: '10:00' })).toBe('in_use');
  });
});
