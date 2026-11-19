// Calendar module logic: lay out one lab's blocks for a day without drawing any on top of another.
import type { Reservation } from '../../../shared/data/types';

const hours = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;

/**
 * Overlapping blocks (e.g. a moved class next to its crossed-out original, or a booking over a
 * cancelled class) go into separate lanes, stacked in the lab's row. Times are clipped to [from, to] hours.
 */
export function placeLanes(rows: Reservation[], from: number, to: number) {
  const items = rows.map((r) => ({ r, s: Math.max(from, hours(r.start_time)), e: Math.min(to, hours(r.end_time)), lane: 0 }))
    .filter((x) => x.e > x.s).sort((a, b) => a.s - b.s || b.e - a.e);
  const ends: number[] = [];
  for (const x of items) {
    let i = ends.findIndex((end) => end <= x.s);
    if (i < 0) { i = ends.length; ends.push(0); }
    ends[i] = x.e; x.lane = i;
  }
  return { items, lanes: Math.max(1, ends.length) };
}
