import { act, renderHook, waitFor } from '@testing-library/react';
import { useLabLive } from './useLabLive';
import { api } from '../../../shared/data/api';

describe('useLabLive', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('picks up the new day’s bookings after midnight (Manila time)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2099-03-10T15:59:30Z')); // 23:59:30 in Manila
    await api.signIn('admin@smcbi.edu.ph', 'x');
    const r = await api.createReservation({
      // labs open 8 AM: an approved single-PC booking shows that PC as Reserved from the start of its day
      title: 'Early thesis run', lab_id: 'lab1', pc_id: 'lab1-pc05', purpose: 'x', date: '2099-03-11',
      start_time: '08:00', end_time: '10:00', participants: null, requirements: null,
    });
    await api.reviewReservation(r.id, 'approved');
    const pc05 = () => result.current.pcs.find((p) => p.id === 'lab1-pc05')?.shown;

    const { result } = renderHook(() => useLabLive('lab1'));
    await waitFor(() => expect(result.current.pcs).toHaveLength(40));
    expect(pc05()).not.toBe('reserved');

    await act(async () => { vi.advanceTimersByTime(60_000); });
    await waitFor(() => expect(pc05()).toBe('reserved'));
  });
});
