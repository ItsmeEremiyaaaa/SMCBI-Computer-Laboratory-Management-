import { act, renderHook, waitFor } from '@testing-library/react';
import { useLabLive } from './useLabLive';
import { api } from '../lib/api';

describe('useLabLive', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('picks up the new day’s bookings after midnight (Manila time)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2099-03-10T15:59:30Z')); // 23:59:30 in Manila
    await api.signIn('admin@smcbi.edu.ph', 'x');
    const r = await api.createReservation({
      title: 'Early class', lab_id: 'lab1', pc_id: null, purpose: 'x', date: '2099-03-11',
      start_time: '00:00', end_time: '02:00', participants: null, requirements: null,
    });
    await api.reviewReservation(r.id, 'approved');

    const { result } = renderHook(() => useLabLive('lab1'));
    await waitFor(() => expect(result.current.pcs).toHaveLength(40));
    expect(result.current.pcs.some((p) => p.shown === 'reserved')).toBe(false);

    await act(async () => { vi.advanceTimersByTime(60_000); });
    await waitFor(() => expect(result.current.pcs.filter((p) => p.shown !== 'broken').every((p) => p.shown === 'reserved')).toBe(true));
  });
});
