import { placeLanes } from './lanes';
import type { Reservation } from '../../../shared/data/types';

const r = (id: string, start_time: string, end_time: string) => ({ id, start_time, end_time }) as Reservation;

it('puts overlapping blocks in separate lanes and reuses a lane once it is free', () => {
  const { items, lanes } = placeLanes([r('orig', '09:00', '12:00'), r('moved', '10:00', '13:00'), r('later', '13:00', '16:00'), r('night', '19:00', '23:00')], 8, 20);
  expect(lanes).toBe(2);
  expect(Object.fromEntries(items.map((x) => [x.r.id, x.lane]))).toEqual({ orig: 0, moved: 1, later: 0, night: 0 });
  expect(items.find((x) => x.r.id === 'night')!.e).toBe(20); // clipped to the timeline
  expect(placeLanes([], 8, 20).lanes).toBe(1);
});
