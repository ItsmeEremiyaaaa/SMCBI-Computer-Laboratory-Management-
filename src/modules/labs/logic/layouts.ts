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

// Room geometry in metres, shared by the 3D scene, the 3D students and the 2D floor plan.
// x: left → right, z: front (whiteboard) → back. rot: rotation about Y, 0 = monitor toward the front.
type LabDims = { id: string; rows: number; cols: number };
const ISLAND_GAP = 3.6; // centre-to-centre between islands
const ISLAND_ROW = 1.2; // seat spacing along the wood
const DX = 1.15; // seat width (tables)
const DZ = 1.9; // row spacing (tables)

const islandCount = (lab: LabDims) => Math.ceil(lab.cols / 4);
const islandX = (i: number, n: number) => (i - (n - 1) / 2) * ISLAND_GAP;
const sideRows = (lab: LabDims) => LAYOUTS[lab.id]?.island?.endRow ?? lab.rows;
const sideZ = (row: number, lab: LabDims) => (row - (sideRows(lab) - 1) / 2) * ISLAND_ROW - 0.4;

export function seatPlacement(lab: LabDims, row: number, col: number): { pos: [number, number, number]; rot: number } {
  if (!LAYOUTS[lab.id]?.island) {
    return { pos: [(col - (lab.cols - 1) / 2) * DX, 0, (row - (lab.rows - 1) / 2) * DZ + 1.2], rot: 0 };
  }
  const cx = islandX(Math.floor(col / 4), islandCount(lab));
  const left = col % 4 === 0;
  if (row !== LAYOUTS[lab.id]?.island?.endRow) {
    // side seats: monitor against the wood, student sits outside
    return { pos: [cx + (left ? -0.55 : 0.55), 0, sideZ(row, lab)], rot: left ? -Math.PI / 2 : Math.PI / 2 };
  }
  // end seats across the back end of the wood, facing it
  return { pos: [cx + (left ? -0.58 : 0.58), 0, sideZ(sideRows(lab) - 1, lab) + ISLAND_ROW / 2 + 0.65], rot: 0 };
}

export function roomSize(lab: LabDims) {
  const island = !!LAYOUTS[lab.id]?.island;
  const w = island ? islandCount(lab) * ISLAND_GAP + 2.4 : lab.cols * DX + 3;
  const d = island ? (sideRows(lab) + (lab.rows > sideRows(lab) ? 1 : 0)) * ISLAND_ROW + 7.5 : lab.rows * DZ + 4.5;
  return { w, d };
}

// The wooden supports of island labs: x centre and z extent for each island that has side seats.
export function islandSpines(lab: LabDims, seats: { row: number; col: number }[]) {
  const endRow = LAYOUTS[lab.id]?.island?.endRow;
  return Array.from({ length: islandCount(lab) }, (_, i) => {
    const rows = seats.filter((p) => Math.floor(p.col / 4) === i && p.row !== endRow).map((p) => p.row);
    if (!rows.length) return null;
    return { x: islandX(i, islandCount(lab)), z0: sideZ(Math.min(...rows), lab) - ISLAND_ROW / 2, z1: sideZ(Math.max(...rows), lab) + ISLAND_ROW / 2 };
  }).filter((s): s is { x: number; z0: number; z1: number } => s !== null);
}

// Doors (positions mirror the 3D room). side: which wall; along: position along that wall in metres.
export function labDoors(lab: LabDims): { wall: 'left' | 'front' | 'back'; at: number; label: string }[] {
  const { w, d } = roomSize(lab);
  const bayCount = Math.max(4, Math.floor(d / 2.0));
  const bay = d / bayCount;
  const front = -d / 2;
  const doors: { wall: 'left' | 'front' | 'back'; at: number; label: string }[] = [
    { wall: 'left', at: front + bay * 0.5, label: 'Exit' },
  ];
  const side: Record<string, string> = { lab1: 'Admin Office', lab2: 'ComLab 1', netlab: 'ComLab 2' };
  if (side[lab.id]) doors.push({ wall: 'back', at: -w / 2 + 1.6, label: side[lab.id] }); // same spot as LabScene BACK_DOOR_INSET
  if (lab.id === 'lab1') doors.push({ wall: 'front', at: -w / 2 + 1.4, label: 'ComLab 2' });
  if (lab.id === 'lab2') doors.push({ wall: 'front', at: -w / 2 + 1.25, label: 'NetLab' });
  return doors;
}
