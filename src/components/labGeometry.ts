// Shared, merged geometry for the 3D labs. Furniture that never moves (chairs, desk panels, PC
// towers, keyboards, stands, dividers) is merged into one geometry per material and drawn as
// instances: a whole lab's chairs are 3 draw calls instead of ~21 per chair.
import {
  BoxGeometry, BufferGeometry, CylinderGeometry, Euler, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---- one geometry per shape, shared by every mesh that uses it ----
const geoCache = new Map<string, BufferGeometry>();
const cached = <T extends BufferGeometry>(key: string, make: () => T): T => {
  let g = geoCache.get(key) as T | undefined;
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
};
export const box = (w: number, h: number, d: number) => cached(`b${w},${h},${d}`, () => new BoxGeometry(w, h, d));
export const cyl = (rt: number, rb: number, h: number, seg = 8) => cached(`c${rt},${rb},${h},${seg}`, () => new CylinderGeometry(rt, rb, h, seg));
export const plane = (w: number, h: number) => cached(`p${w},${h}`, () => new PlaneGeometry(w, h));

// ---- one material per look, shared ----
const matCache = new Map<string, MeshStandardMaterial>();
export const mat = (color: string, roughness = 0.5, metalness = 0) => {
  const key = `${color}|${roughness}|${metalness}`;
  let m = matCache.get(key);
  if (!m) { m = new MeshStandardMaterial({ color, roughness, metalness }); matCache.set(key, m); }
  return m;
};

// A shape placed in its parent's space (position, rotation in radians), as a fresh geometry.
type Part = { g: BufferGeometry; pos?: [number, number, number]; rot?: [number, number, number] };
const place = (parts: Part[], parent = new Matrix4()) => parts.map(({ g, pos = [0, 0, 0], rot = [0, 0, 0] }) =>
  g.clone().applyMatrix4(parent.clone().multiply(new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(1, 1, 1)))));
const at = (pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) =>
  new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(1, 1, 1));
const merge = (geos: BufferGeometry[]) => mergeGeometries(geos.map((g) => (g.index ? g : g)), false)!;

// ---- the task chair, centred on its own base (same layout the old per-part chair used) ----
let chairCache: { black: BufferGeometry; chrome: BufferGeometry; cushion: BufferGeometry } | null = null;
export function chairGeometry() {
  if (chairCache) return chairCache;
  const black: BufferGeometry[] = [], cushion: BufferGeometry[] = [];
  for (const deg of [0, 72, 144, 216, 288]) {
    const leg = at([0, 0.04, 0], [0, (deg * Math.PI) / 180, 0]);
    black.push(...place([{ g: new BoxGeometry(0.035, 0.025, 0.26), pos: [0, 0, 0.15] }, { g: new CylinderGeometry(0.022, 0.022, 0.028, 8), pos: [0, -0.02, 0.26] }], leg));
  }
  const seat = at([0, 0.43, 0]);
  black.push(...place([{ g: new BoxGeometry(0.46, 0.055, 0.44) }], seat));
  cushion.push(...place([{ g: new BoxGeometry(0.44, 0.05, 0.42), pos: [0, 0.04, 0] }], seat));
  const back = at([0, 0.7, 0.18], [-0.08, 0, 0]);
  black.push(...place([
    { g: new BoxGeometry(0.05, 0.36, 0.025), pos: [0, -0.06, 0.02] },
    { g: new BoxGeometry(0.44, 0.46, 0.024) },
    { g: new BoxGeometry(0.32, 0.06, 0.018), pos: [0, -0.1, -0.012] },
  ], back));
  cushion.push(...place([{ g: new BoxGeometry(0.42, 0.42, 0.05), pos: [0, 0, -0.03] }], back));
  for (const x of [-0.22, 0.22]) {
    black.push(...place([{ g: new BoxGeometry(0.028, 0.18, 0.035) }, { g: new BoxGeometry(0.055, 0.022, 0.2), pos: [0, 0.09, -0.04] }], at([x, 0.53, 0.03])));
  }
  const chrome = place([{ g: new CylinderGeometry(0.024, 0.03, 0.34, 12), pos: [0, 0.22, 0] }]);
  chairCache = { black: merge(black), chrome: merge(chrome), cushion: merge(cushion) };
  return chairCache;
}

// ---- the fixed parts of one desk (everything except the clickable top and the animated monitor) ----
const deskCache = new Map<string, { wood: BufferGeometry; dark: BufferGeometry; keys: BufferGeometry; screen: BufferGeometry | null }>();
export function deskGeometry(deskWidth: number, deskH: number, deskD: number, island: boolean) {
  const key = `${deskWidth}|${island}`;
  const hit = deskCache.get(key);
  if (hit) return hit;
  const wood = place([
    { g: new BoxGeometry(0.03, deskH, deskD - 0.04), pos: [-(deskWidth / 2 - 0.02), deskH / 2, -0.01] },
    { g: new BoxGeometry(0.03, deskH, deskD - 0.04), pos: [deskWidth / 2 - 0.02, deskH / 2, -0.01] },
    { g: new BoxGeometry(deskWidth - 0.06, deskH - 0.2, 0.02), pos: [0, deskH / 2 + 0.1, -deskD / 2 + 0.04] },
  ]);
  const dark = place([
    { g: new BoxGeometry(0.18, 0.42, 0.4), pos: [deskWidth / 2 - 0.16, 0.22, -0.12] },                 // PC tower
    { g: new BoxGeometry(0.42, 0.012, 0.13), pos: [0, deskH + 0.022, 0.1] },                             // keyboard
    { g: new BoxGeometry(0.055, 0.018, 0.09), pos: [0.3, deskH + 0.024, 0.11] },                         // mouse
    { g: new BoxGeometry(0.18, 0.01, 0.15), pos: [0, deskH + 0.02, -0.15] },                             // stand foot
    { g: new BoxGeometry(0.075, 0.2, 0.018), pos: [0, deskH + 0.115, -0.2], rot: [0.12, 0, 0] },         // stand arm
    ...(island ? [-deskWidth * 0.32, deskWidth * 0.32].map((bx) => ({ g: new BoxGeometry(0.028, 0.05, 0.038), pos: [bx, deskH + 0.02, -deskD / 2] as [number, number, number] })) : []),
  ]);
  const keys = place([{ g: new BoxGeometry(0.39, 0.005, 0.11), pos: [0, deskH + 0.028, 0.1] }]);
  const screen = island ? merge(place([{ g: new BoxGeometry(deskWidth, 0.28, 0.022), pos: [0, deskH + 0.16, -deskD / 2] }])) : null;
  const out = { wood: merge(wood), dark: merge(dark), keys: merge(keys), screen };
  deskCache.set(key, out);
  return out;
}

/** Instance matrix for an item placed at pos with a Y rotation, plus a local offset (e.g. the chair 0.62 m behind the desk). */
export function placementMatrix(pos: [number, number, number], rotY: number, local: [number, number, number] = [0, 0, 0]) {
  return at(pos, [0, rotY, 0]).multiply(at(local));
}
