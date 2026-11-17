// Real seat layouts of the SMCBI labs, as a sparse grid seen from the back of the room
// (row 0 = front, by the whiteboard). Empty columns/rows are aisles. Every view (3D,
// floor plan, overview mini-maps) places PCs by these row/col values.

// island: seats sit on both sides of a wooden support, in groups of 4 columns
// (left, wood, right, gap). endRow: a row of seats across the back end of each support.
type Grid = { rows: number; cols: number; seats: [row: number, col: number][]; island?: { endRow?: number } };

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const block = (rows: number[], cols: number[]) => rows.flatMap((r) => cols.map((c) => [r, c] as [number, number]));

export const LAYOUTS: Record<string, Grid> = {
  // Comlab 1: 5 islands side by side. Each island (4 grid columns: left, wooden support,
  // right, gap) has 3 PCs down each side of the wood and 2 across the back end (row 3).
  lab1: {
    rows: 4, cols: 19, island: { endRow: 3 },
    seats: range(0, 4).flatMap((i) => block(range(0, 3), [i * 4, i * 4 + 2])),
  },
  // Comlab 2: 3 islands front to back: 8 + 8 on the left, 6 + 6 in the centre, 8 + 8 on the right.
  lab2: {
    rows: 8, cols: 11, island: {},
    seats: [...block(range(0, 7), [0, 2, 8, 10]), ...block(range(1, 6), [4, 6])],
  },
  // Netlab: tables of 3. Left and right groups are 4 rows each; the centre group is
  // 2 rows level with the middle of the room. Teacher's table at the front centre.
  netlab: {
    rows: 4, cols: 11,
    seats: [...block(range(0, 3), [0, 1, 2, 8, 9, 10]), ...block([1, 2], [4, 5, 6])],
  },
};

const pad = (n: number) => String(n).padStart(2, '0');

// Seats in walking order (front to back, left to right), numbered PC-01, PC-02, …
export function seatsFor(labId: string) {
  return [...(LAYOUTS[labId]?.seats ?? [])]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([row, col], i) => ({ id: `${labId}-pc${pad(i + 1)}`, label: `PC-${pad(i + 1)}`, row, col }));
}
