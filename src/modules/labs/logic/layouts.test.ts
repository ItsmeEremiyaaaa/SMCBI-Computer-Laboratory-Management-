import { LAYOUTS, seatsFor } from './layouts';

describe('lab layouts (from the real rooms)', () => {
  it('has the right number of PCs per lab', () => {
    expect(seatsFor('lab1')).toHaveLength(40);
    expect(seatsFor('lab2')).toHaveLength(44);
    expect(seatsFor('netlab')).toHaveLength(30);
  });

  it('never puts two PCs in the same spot and stays inside the grid', () => {
    for (const id of Object.keys(LAYOUTS)) {
      const seats = seatsFor(id);
      expect(new Set(seats.map((s) => `${s.row},${s.col}`)).size).toBe(seats.length);
      for (const s of seats) {
        expect(s.row).toBeLessThan(LAYOUTS[id].rows);
        expect(s.col).toBeLessThan(LAYOUTS[id].cols);
      }
    }
  });

  it('numbers PCs front to back, left to right, starting at PC-01', () => {
    const s = seatsFor('lab2');
    expect(s[0]).toMatchObject({ label: 'PC-01', row: 0, col: 0 });
    expect(s.at(-1)!.label).toBe('PC-44');
  });

  it('comlab 1 is 5 islands of 8: 3 + 3 along the wood, 2 at the end', () => {
    const seats = seatsFor('lab1');
    for (let i = 0; i < 5; i++) {
      const island = seats.filter((s) => Math.floor(s.col / 4) === i);
      expect(island).toHaveLength(8);
      expect(island.filter((s) => s.row === 3)).toHaveLength(2);
      expect(island.some((s) => s.col % 4 === 1)).toBe(false); // the wooden support
    }
  });

  it('comlab 2 is 3 islands: 8 + 8, 6 + 6, 8 + 8', () => {
    const seats = seatsFor('lab2');
    expect([0, 1, 2].map((i) => seats.filter((s) => Math.floor(s.col / 4) === i).length)).toEqual([16, 12, 16]);
    expect(seats.some((s) => s.col % 4 === 1)).toBe(false); // wooden supports
    expect(LAYOUTS.lab2.island).toBeTruthy();
  });

  it('netlab: left 4 rows of 3, centre 2 rows of 3 in the middle, right 4 rows of 3', () => {
    const s = seatsFor('netlab');
    const group = (a: number, b: number) => s.filter((x) => x.col >= a && x.col <= b);
    expect(group(0, 2)).toHaveLength(12);
    expect(group(4, 6)).toHaveLength(6);
    expect(new Set(group(4, 6).map((x) => x.row))).toEqual(new Set([1, 2]));
    expect(group(8, 10)).toHaveLength(12);
  });
});
