import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei';
import { CanvasTexture, MathUtils, type Group, type MeshStandardMaterial } from 'three';
import type { LivePc } from '../hooks/useLabLive';
import type { Lab } from '../lib/types';
import type { SceneProps } from './SeatGrid';
import { LAYOUTS } from '../lib/layouts';
import { STATUS_COLOR } from './ui';
import LabCharacters3D, { type SimMode } from './LabCharacters3D';

// Modeled on the SMCBI labs: Lab 1/2 have long white benches with white partitions;
// Netlab has separate dark-top tables on metal legs. Both use white monobloc chairs.
const DX = 1.15; // seat width (Netlab tables)
const DZ = 1.9; // row spacing (Netlab tables)
const DESK_D = 0.7;
const DESK_H = 0.75;

// Labs with wooden-support islands (Comlab 1 and 2) vs. separate dark tables (Netlab).
type Style = 'island' | 'table';
const styleOf = (lab: Lab): Style => (LAYOUTS[lab.id]?.island ? 'island' : 'table');

// Island geometry. Layout columns per island: 0 = left, 1 = wood, 2 = right, 3 = gap.
const ISLAND_GAP = 3.6; // centre-to-centre between islands
const ISLAND_ROW = 1.2; // seat spacing along the wood

const islandCount = (lab: Lab) => Math.ceil(lab.cols / 4);
const islandX = (i: number, n: number) => (i - (n - 1) / 2) * ISLAND_GAP;
// Rows along the wood (the end row, if any, sits across the back end instead).
const sideRows = (lab: Lab) => LAYOUTS[lab.id]?.island?.endRow ?? lab.rows;
const sideZ = (row: number, lab: Lab) => (row - (sideRows(lab) - 1) / 2) * ISLAND_ROW - 0.4;

// Where a PC sits and which way it faces (rotation about Y; 0 = monitor toward the front).
function place(pc: LivePc, lab: Lab, style: Style): { pos: [number, number, number]; rot: number } {
  if (style !== 'island') return { pos: [seatX(pc.col, lab.cols), 0, rowZ(pc.row, lab.rows)], rot: 0 };
  const cx = islandX(Math.floor(pc.col / 4), islandCount(lab));
  const left = pc.col % 4 === 0;
  if (pc.row !== LAYOUTS[lab.id]?.island?.endRow) {
    // side seats: monitor against the wood, student sits outside
    return { pos: [cx + (left ? -0.55 : 0.55), 0, sideZ(pc.row, lab)], rot: left ? -Math.PI / 2 : Math.PI / 2 };
  }
  // end seats across the back end of the wood, facing it
  return { pos: [cx + (left ? -0.58 : 0.58), 0, sideZ(sideRows(lab) - 1, lab) + ISLAND_ROW / 2 + 0.65], rot: 0 };
}

// One wooden support per island, as long as that island's run of side seats.
function Spines({ lab, pcs }: { lab: Lab; pcs: LivePc[] }) {
  const n = islandCount(lab);
  const endRow = LAYOUTS[lab.id]?.island?.endRow;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const rows = pcs.filter((p) => Math.floor(p.col / 4) === i && p.row !== endRow).map((p) => p.row);
        if (!rows.length) return null;
        const z0 = sideZ(Math.min(...rows), lab) - ISLAND_ROW / 2;
        const z1 = sideZ(Math.max(...rows), lab) + ISLAND_ROW / 2;
        return (
          <mesh key={i} position={[islandX(i, n), (DESK_H + 0.3) / 2, (z0 + z1) / 2]} castShadow receiveShadow>
            <boxGeometry args={[0.12, DESK_H + 0.3, z1 - z0]} />
            <meshStandardMaterial color="#b98a58" roughness={0.75} />
          </mesh>
        );
      })}
    </>
  );
}

// Aisles are empty grid columns/rows in the layout, so placement is a plain grid.
const seatX = (col: number, cols: number) => (col - (cols - 1) / 2) * DX;
const rowZ = (row: number, rows: number) => (row - (rows - 1) / 2) * DZ + 1.2;

function Monobloc({ position }: { position: [number, number, number] }) {
  const white = <meshStandardMaterial color="#f2f3f1" roughness={0.6} />;
  return (
    <group position={position}>
      <mesh position={[0, 0.44, 0]} castShadow><boxGeometry args={[0.44, 0.04, 0.42]} />{white}</mesh>
      <mesh position={[0, 0.74, 0.2]} rotation-x={-0.12} castShadow><boxGeometry args={[0.42, 0.5, 0.035]} />{white}</mesh>
      {[[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.18], [0.19, 0.18]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.21, z]} castShadow><cylinderGeometry args={[0.022, 0.03, 0.44]} />{white}</mesh>
      ))}
    </group>
  );
}

let crackTextureCache: CanvasTexture | null = null;

function getCrackTexture(): CanvasTexture {
  if (crackTextureCache) return crackTextureCache;
  if (typeof document === 'undefined') return new CanvasTexture({} as HTMLCanvasElement);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new CanvasTexture(canvas);

  ctx.clearRect(0, 0, 512, 300);

  // Impact center (off-center for natural shattered realism)
  const cx = 190;
  const cy = 125;

  // Dark LCD fluid leak / pressure bruise around impact
  const grad = ctx.createRadialGradient(cx, cy, 3, cx, cy, 80);
  grad.addColorStop(0, 'rgba(10, 15, 30, 0.95)');
  grad.addColorStop(0.35, 'rgba(25, 15, 25, 0.8)');
  grad.addColorStop(0.7, 'rgba(50, 15, 20, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 80, 0, Math.PI * 2);
  ctx.fill();

  // Helper to draw jagged lightning fracture
  const drawJagged = (x0: number, y0: number, x1: number, y1: number, segs: number, spread: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'bevel';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const tx = x0 + (x1 - x0) * t;
      const ty = y0 + (y1 - y0) * t;
      const px = tx + Math.sin(i * 4.3 + x0 * 0.1) * spread;
      const py = ty + Math.cos(i * 3.7 + y0 * 0.1) * spread;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };

  // Radial crack paths to the screen edges
  const rays = [
    [10, 15], [75, 0], [195, 0], [340, 0], [512, 35],
    [512, 120], [512, 220], [440, 300], [300, 300],
    [170, 300], [25, 300], [0, 200], [0, 85], [115, 55], [300, 175]
  ];

  // Dark fracture drop-shadow for 3D depth
  rays.forEach(([rx, ry]) => {
    drawJagged(cx, cy, rx, ry, 7, 12, 'rgba(0, 0, 0, 0.85)', 3.5);
  });

  // Bright white/cyan sharp shattered glass crack lines
  rays.forEach(([rx, ry]) => {
    drawJagged(cx, cy, rx, ry, 7, 10, 'rgba(255, 255, 255, 0.95)', 1.6);
  });

  // Concentric spiderweb impact rings
  for (let r = 18; r <= 78; r += 16) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.3; a += Math.PI / 5) {
      const jx = Math.sin(a * 4) * 4;
      const jy = Math.cos(a * 3) * 3;
      const x = cx + Math.cos(a) * (r + jx);
      const y = cy + Math.sin(a) * (r * 0.65 + jy);
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  crackTextureCache = new CanvasTexture(canvas);
  return crackTextureCache;
}

function Workstation({ pc, pos, rot = 0, style, selected, onSelect }:
  { pc: LivePc; pos: [number, number, number]; rot?: number; style: Style; selected: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  const monitor = useRef<Group>(null);
  const screen = useRef<MeshStandardMaterial>(null);
  // Selected monitor lifts, grows and tilts toward the seat; its screen pulses. Hover lifts it slightly.
  useFrame(({ clock }, dt) => {
    const m = monitor.current;
    if (!m) return;
    const k = 1 - Math.exp(-dt * 10);
    m.position.y = MathUtils.lerp(m.position.y, DESK_H + 0.4 + (selected ? 0.16 : hover ? 0.05 : 0), k);
    m.rotation.x = MathUtils.lerp(m.rotation.x, selected ? 0.22 : 0, k);
    m.scale.setScalar(MathUtils.lerp(m.scale.x, selected ? 1.15 : 1, k));
    if (screen.current) screen.current.emissiveIntensity = glow + (selected ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4) : 0);
  });
  const color = STATUS_COLOR[pc.shown];
  const glow = pc.shown === 'broken' ? 0.7 : pc.shown === 'free' ? 0.85 : 1.5;
  const black = <meshStandardMaterial color="#15181d" roughness={0.45} />;
  return (
    <group position={pos} rotation-y={rot} name={`pc:${pc.id}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
      {style === 'island' && <>
        {/* Comlab 1: white desk against the wooden support */}
        <mesh position={[0, DESK_H, -0.02]} castShadow receiveShadow>
          <boxGeometry args={[1.08, 0.04, DESK_D - 0.04]} />
          <meshStandardMaterial color={selected || hover ? '#dce8f8' : '#f7f7f5'} roughness={0.35} />
        </mesh>
        {[-0.52, 0.52].map((x) => (
          <mesh key={x} position={[x, DESK_H / 2, -0.02]} castShadow><boxGeometry args={[0.03, DESK_H, DESK_D - 0.08]} />
            <meshStandardMaterial color="#ebe6dc" /></mesh>
        ))}
      </>}
      {style === 'table' && <>
        {/* Netlab: own dark table on metal legs */}
        <mesh position={[0, DESK_H, 0]} castShadow receiveShadow>
          <boxGeometry args={[DX - 0.04, 0.035, DESK_D]} />
          <meshStandardMaterial color={selected || hover ? '#3a4658' : '#2b2f36'} roughness={0.5} />
        </mesh>
        {[[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, DESK_H / 2, z]}><boxGeometry args={[0.035, DESK_H, 0.035]} />
            <meshStandardMaterial color="#8d939c" metalness={0.6} roughness={0.35} /></mesh>
        ))}
      </>}
      {/* system unit under the desk */}
      <mesh position={[0.38, 0.22, -0.08]} castShadow><boxGeometry args={[0.19, 0.42, 0.42]} />{black}</mesh>
      <mesh position={[0.38, 0.36, 0.131]}>
        <boxGeometry args={[0.025, 0.025, 0.01]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* monitor: black bezel, screen shows status */}
      <mesh position={[0, DESK_H + 0.025, -0.18]}><boxGeometry args={[0.22, 0.02, 0.16]} />{black}</mesh>
      <mesh position={[0, DESK_H + 0.13, -0.21]}><boxGeometry args={[0.05, 0.2, 0.03]} />{black}</mesh>
      <group ref={monitor} position={[0, DESK_H + 0.4, -0.2]}>
        <RoundedBox args={[0.62, 0.4, 0.035]} radius={0.01} castShadow>{black}</RoundedBox>
        <mesh position={[0, 0.01, 0.019]}>
          <planeGeometry args={[0.57, 0.33]} />
          <meshStandardMaterial ref={screen} color={color} emissive={color} emissiveIntensity={glow} toneMapped={false} />
        </mesh>
        {/* Broken glass crack fracture overlay */}
        {pc.shown === 'broken' && (
          <mesh position={[0, 0.01, 0.02]}>
            <planeGeometry args={[0.57, 0.33]} />
            <meshStandardMaterial
              map={getCrackTexture()}
              transparent
              opacity={0.96}
              roughness={0.1}
              metalness={0.1}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
      {/* keyboard + mouse */}
      <mesh position={[0, DESK_H + 0.025, 0.1]}><boxGeometry args={[0.44, 0.018, 0.14]} />{black}</mesh>
      <mesh position={[0.32, DESK_H + 0.025, 0.12]}><boxGeometry args={[0.06, 0.02, 0.1]} />{black}</mesh>
      <Monobloc position={[0, 0, 0.62]} />
      {(selected || hover) && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0.3]}>
          <ringGeometry args={[0.62, 0.69, 48]} />
          <meshBasicMaterial color={selected ? '#1f5fbf' : '#7fa6dd'} />
        </mesh>
      )}
    </group>
  );
}

// Detailed 3D Architectural Doorway with realistic frame, oak slab, frosted vision glass, and stainless lever handle
function Doorway({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  return (
    <group position={position} rotation-y={rotationY}>
      {/* Outer door frame casing */}
      <mesh position={[-0.54, 1.15, 0]} castShadow>
        <boxGeometry args={[0.08, 2.3, 0.14]} />
        <meshStandardMaterial color="#2d3748" roughness={0.4} />
      </mesh>
      <mesh position={[0.54, 1.15, 0]} castShadow>
        <boxGeometry args={[0.08, 2.3, 0.14]} />
        <meshStandardMaterial color="#2d3748" roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.26, 0]} castShadow>
        <boxGeometry args={[1.16, 0.08, 0.14]} />
        <meshStandardMaterial color="#2d3748" roughness={0.4} />
      </mesh>

      {/* Door threshold plate on floor */}
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[1.0, 0.01, 0.16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Door slab (warm oak wood finish with aluminum trims) */}
      <group position={[0, 1.1, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.98, 2.16, 0.045]} />
          <meshStandardMaterial color="#8a532d" roughness={0.6} />
        </mesh>
        {/* Door vision glass pane */}
        <mesh position={[0, 0.35, 0.024]}>
          <boxGeometry args={[0.34, 0.84, 0.01]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.35, 0.026]}>
          <planeGeometry args={[0.3, 0.8]} />
          <meshStandardMaterial color="#bae6fd" transparent opacity={0.5} roughness={0.1} metalness={0.2} />
        </mesh>

        {/* Stainless steel door kickplate at bottom */}
        <mesh position={[0, -0.92, 0.024]}>
          <boxGeometry args={[0.96, 0.22, 0.005]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Stainless steel lever handle and escutcheon */}
        <mesh position={[0.38, -0.05, 0.035]}>
          <boxGeometry args={[0.05, 0.16, 0.015]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.34, -0.05, 0.065]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.012, 0.012, 0.09, 16]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

// Glass Window Wall with aluminum mullions, transparent panes, sills, and integrated doorways
function GlassWindowWall({
  side,
  w,
  d,
  front,
  doorZList = [],
}: {
  side: -1 | 1; // -1 for left wall, 1 for right wall
  w: number;
  d: number;
  front: number;
  doorZList?: number[];
}) {
  const x = (side * w) / 2;
  const wallMat = <meshStandardMaterial color="#f1efe8" roughness={0.85} />;
  const mullionMat = <meshStandardMaterial color="#2d3748" roughness={0.4} />;
  const glassMat = <meshStandardMaterial color="#9ec9eb" transparent opacity={0.32} roughness={0.08} metalness={0.25} />;
  const sillMat = <meshStandardMaterial color="#1e293b" roughness={0.4} />;

  // Window bay subdivisions along the depth of the room
  const bayCount = Math.max(4, Math.floor(d / 2.0));
  const bayLength = d / bayCount;

  return (
    <group position={[x, 0, 0]}>
      {Array.from({ length: bayCount }, (_, i) => {
        const zCenter = front + (i + 0.5) * bayLength;
        const hasDoor = doorZList.some((dz) => Math.abs(zCenter - dz) < bayLength * 0.45);

        if (hasDoor) {
          // Open doorway bay (wall header above 2.3m, open below for the Doorway component)
          return (
            <group key={i}>
              {/* Wall header above door up to 2.8m */}
              <mesh position={[0, 2.55, zCenter]}>
                <boxGeometry args={[0.1, 0.5, bayLength]} />
                {wallMat}
              </mesh>
            </group>
          );
        }

        // Standard Glass Window Bay
        return (
          <group key={i}>
            {/* Base knee wall up to 0.85m */}
            <mesh position={[0, 0.425, zCenter]} receiveShadow>
              <boxGeometry args={[0.1, 0.85, bayLength]} />
              {wallMat}
            </mesh>
            {/* Interior baseboard skirting */}
            <mesh position={[-side * 0.055, 0.05, zCenter]}>
              <boxGeometry args={[0.015, 0.1, bayLength]} />
              {sillMat}
            </mesh>
            {/* Interior window sill ledge */}
            <mesh position={[-side * 0.07, 0.85, zCenter]}>
              <boxGeometry args={[0.06, 0.03, bayLength]} />
              {sillMat}
            </mesh>

            {/* Vertical mullions / pillars */}
            <mesh position={[0, 1.6, zCenter - bayLength / 2]}>
              <boxGeometry args={[0.08, 1.5, 0.08]} />
              {mullionMat}
            </mesh>

            {/* Architectural Glass Pane */}
            <mesh position={[0, 1.6, zCenter]}>
              <boxGeometry args={[0.02, 1.44, bayLength - 0.08]} />
              {glassMat}
            </mesh>

            {/* Horizontal window transom divider */}
            <mesh position={[0, 1.65, zCenter]}>
              <boxGeometry args={[0.04, 0.035, bayLength - 0.08]} />
              {mullionMat}
            </mesh>

            {/* Top window header beam at 2.35m */}
            <mesh position={[0, 2.35, zCenter]}>
              <boxGeometry args={[0.08, 0.06, bayLength]} />
              {mullionMat}
            </mesh>
            {/* Upper wall above window */}
            <mesh position={[0, 2.58, zCenter]}>
              <boxGeometry args={[0.1, 0.4, bayLength]} />
              {wallMat}
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Front Wall Glass Window (between connecting doors and the whiteboard)
function FrontWallWindow({
  position,
  w = 1.8,
  h = 1.4,
}: {
  position: [number, number, number];
  w?: number;
  h?: number;
}) {
  return (
    <group position={position}>
      {/* Outer aluminum frame */}
      <mesh castShadow>
        <boxGeometry args={[w, h, 0.06]} />
        <meshStandardMaterial color="#2d3748" roughness={0.4} />
      </mesh>
      {/* Transparent architectural glass pane */}
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[w - 0.1, h - 0.1, 0.02]} />
        <meshStandardMaterial color="#9ec9eb" transparent opacity={0.35} roughness={0.08} metalness={0.25} />
      </mesh>
      {/* Horizontal transom bar */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[w - 0.08, 0.035, 0.04]} />
        <meshStandardMaterial color="#2d3748" roughness={0.4} />
      </mesh>
      {/* Vertical center mullion */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.035, h - 0.08, 0.04]} />
        <meshStandardMaterial color="#2d3748" roughness={0.4} />
      </mesh>
      {/* Interior window sill ledge */}
      <mesh position={[0, -h / 2 - 0.02, 0.04]}>
        <boxGeometry args={[w + 0.08, 0.04, 0.1]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>
    </group>
  );
}

// Split Inverter Air Conditioning Unit
function AirConditioner({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh castShadow>
        <boxGeometry args={[0.22, 0.38, 1.05]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.25} />
      </mesh>
      <mesh position={[-0.105, -0.08, 0]}>
        <boxGeometry args={[0.015, 0.12, 0.94]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
      </mesh>
      <mesh position={[-0.112, 0.08, 0]}>
        <planeGeometry args={[0.16, 0.04]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[-0.112, 0.08, 0.38]}>
        <circleGeometry args={[0.012, 16]} />
        <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  );
}

// Wall-mounted Fire Extinguisher Safety Station
function FireExtinguisher({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[0.24, 0.55, 0.02]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.04, 0.09]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.38, 16]} />
        <meshStandardMaterial color="#dc2626" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.18, 0.09]}>
        <cylinderGeometry args={[0.03, 0.04, 0.07, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
      </mesh>
      <mesh position={[0, 0.22, 0.09]}>
        <boxGeometry args={[0.025, 0.02, 0.1]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      <mesh position={[0, -0.04, 0.171]}>
        <planeGeometry args={[0.09, 0.14]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

// Front Wall Features: Clean Whiteboard with pen tray & eraser, and Centered Teacher Station
function FrontWallDecor({
  w,
  front,
}: {
  lab: Lab;
  w: number;
  front: number;
  style: Style;
}) {
  return (
    <group>
      {/* Wall skirting baseboard */}
      <mesh position={[0, 0.06, front + 0.06]}>
        <boxGeometry args={[w, 0.12, 0.03]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* SMCBI Navy Blue Accent Stripe */}
      <mesh position={[0, 3.05, front + 0.06]}>
        <boxGeometry args={[w, 0.25, 0.03]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.3} />
      </mesh>

      {/* Magnetic Whiteboard with frame, glossy surface, pen tray & eraser */}
      <group position={[0, 1.48, front + 0.06]}>
        <mesh castShadow>
          <boxGeometry args={[3.5, 1.44, 0.04]} />
          <meshStandardMaterial color="#334155" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[3.38, 1.32]} />
          <meshStandardMaterial color="#fcfcfc" roughness={0.08} />
        </mesh>
        {/* Pen tray with markers & eraser */}
        <mesh position={[0, -0.74, 0.05]}>
          <boxGeometry args={[2.8, 0.03, 0.08]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.6} />
        </mesh>
        {/* Dry erase markers */}
        {[-0.4, -0.2, 0].map((mx, mi) => (
          <mesh key={mi} position={[mx, -0.72, 0.06]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
            <meshStandardMaterial color={mi === 0 ? '#ef4444' : mi === 1 ? '#3b82f6' : '#1e293b'} />
          </mesh>
        ))}
        {/* Eraser */}
        <mesh position={[0.3, -0.72, 0.06]}>
          <boxGeometry args={[0.14, 0.035, 0.05]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </group>

      {/* Teacher's Station: Centered in front of the whiteboard */}
      <group position={[0, 0, front + 1.4]}>
        <mesh position={[0, DESK_H, 0]} castShadow>
          <boxGeometry args={[1.5, 0.04, 0.7]} />
          <meshStandardMaterial color="#ffffff" roughness={0.35} />
        </mesh>
        <mesh position={[0, DESK_H / 2, -0.32]}>
          <boxGeometry args={[1.45, DESK_H, 0.03]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* Desk legs */}
        {[-0.68, 0.68].map((lx) => (
          <mesh key={lx} position={[lx, DESK_H / 2, 0]}>
            <boxGeometry args={[0.04, DESK_H, 0.64]} />
            <meshStandardMaterial color="#64748b" metalness={0.6} />
          </mesh>
        ))}
        {/* Teacher's Laptop */}
        <group position={[0, DESK_H + 0.02, 0]}>
          <mesh><boxGeometry args={[0.34, 0.015, 0.24]} /><meshStandardMaterial color="#0f172a" /></mesh>
          <mesh position={[0, 0.11, -0.1]} rotation-x={0.25}><boxGeometry args={[0.34, 0.22, 0.012]} /><meshStandardMaterial color="#0f172a" /></mesh>
          <mesh position={[0, 0.11, -0.093]} rotation-x={0.25}><planeGeometry args={[0.32, 0.2]} /><meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.8} /></mesh>
        </group>
        {/* Ergonomic teacher chair */}
        <group position={[0, 0, -0.45]}>
          <mesh position={[0, 0.48, 0]} castShadow><boxGeometry args={[0.48, 0.06, 0.46]} /><meshStandardMaterial color="#1e293b" /></mesh>
          <mesh position={[0, 0.82, -0.21]} rotation-x={-0.08} castShadow><boxGeometry args={[0.46, 0.58, 0.04]} /><meshStandardMaterial color="#1e293b" /></mesh>
          <mesh position={[0, 0.24, 0]}><cylinderGeometry args={[0.03, 0.03, 0.48, 12]} /><meshStandardMaterial color="#64748b" metalness={0.8} /></mesh>
        </group>
      </group>
    </group>
  );
}

function Room({ lab, w, d, style }: { lab: Lab; w: number; d: number; style: Style }) {
  const wall = <meshStandardMaterial color="#f1efe8" roughness={0.9} />;
  const front = -d / 2;
  const back = d / 2;

  // Window bay subdivisions along the depth of the room
  const bayCount = Math.max(4, Math.floor(d / 2.0));
  const bayLength = d / bayCount;
  // Exit door integrated in the window wall at the cactus location (front-left corner bay)
  const exitDoorZ = front + bayLength * 0.5;

  // Left wall has the exit door for all labs at the cactus location
  const leftDoorZs = [exitDoorZ];
  // Right wall has continuous full windows
  const rightDoorZs: number[] = [];

  return (
    <group>
      {/* Polished white tile floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#f0f2f5" roughness={0.45} />
      </mesh>
      <gridHelper args={[Math.max(w, d), Math.round(Math.max(w, d) / 0.6), '#cbd5e1', '#e2e8f0']} position={[0, 0.002, 0]} />

      {/* Front Wall */}
      <mesh position={[0, 1.6, front]} receiveShadow>
        <boxGeometry args={[w, 3.2, 0.1]} />
        {wall}
      </mesh>

      {/* Back edge low floor threshold skirting (open dollhouse cutaway with no tall wall blocking the camera view) */}
      <mesh position={[0, 0.04, back]}>
        <boxGeometry args={[w, 0.08, 0.05]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Front Wall Decor (Clean Whiteboard & Centered Teacher Station) */}
      <FrontWallDecor lab={lab} w={w} front={front} style={style} />

      {/* Glass Windows on Left and Right Walls */}
      <GlassWindowWall side={-1} w={w} d={d} front={front} doorZList={leftDoorZs} />
      <GlassWindowWall side={1} w={w} d={d} front={front} doorZList={rightDoorZs} />

      {/* Exit Door in the window at the cactus location (left wall) for all labs */}
      <Doorway position={[-w / 2, 0, exitDoorZ]} rotationY={Math.PI / 2} />

      {/* Fire Extinguisher mounted right beside the exit door */}
      <FireExtinguisher position={[-w / 2 + 0.08, 1.05, exitDoorZ + 0.9]} rotationY={Math.PI / 2} />

      {/* ComLab 1: Door to ComLab 2 on the front wall & Window beside it */}
      {lab.id === 'lab1' && (
        <>
          <Doorway position={[-w / 2 + 1.4, 0, front + 0.06]} rotationY={0} />
          <FrontWallWindow position={[-w / 2 + 3.6, 1.6, front + 0.06]} w={2.0} h={1.4} />
        </>
      )}

      {/* ComLab 2: Door to NetLab (front left), Window, Door to ComLab 1 (front right) */}
      {lab.id === 'lab2' && (
        <>
          <Doorway position={[-w / 2 + 1.25, 0, front + 0.06]} rotationY={0} />
          <FrontWallWindow position={[w / 2 - 3.4, 1.6, front + 0.06]} w={1.8} h={1.4} />
          <Doorway position={[w / 2 - 1.35, 0, front + 0.06]} rotationY={0} />
        </>
      )}

      {/* NetLab: "as netlab in the end, just the exit put" - only the exit door, no extra doors */}

      {/* Wall-Mounted Split Inverter Air Conditioner on right wall */}
      <AirConditioner position={[w / 2 - 0.14, 2.1, front + 1.8]} rotationY={-Math.PI / 2} />
    </group>
  );
}

function ReadySignal({ onReady }: { onReady?: () => void }) {
  const signaled = useRef(false);
  useFrame(() => {
    if (!signaled.current) {
      signaled.current = true;
      onReady?.();
    }
  });
  return null;
}

// Tuned default cameras per lab: perfectly framed with generous breathing margins
const LAB_CAMERAS: Record<string, { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  lab1: {
    pos: [0, 10.4, 10.8],
    target: [0, 0.7, -1.1],
    fov: 46,
  },
  lab2: {
    pos: [0, 12.8, 14.2],
    target: [0, 0.7, -1.4],
    fov: 46,
  },
  netlab: {
    pos: [0, 9.8, 10.6],
    target: [0, 0.7, -0.9],
    fov: 46,
  },
};

function SceneContent({
  lab,
  pcs,
  selectedId,
  onSelect,
  isOccupied,
  simMode,
  teacherName,
}: {
  lab: Lab;
  pcs: LivePc[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isOccupied?: boolean;
  simMode?: SimMode;
  teacherName?: string | null;
}) {
  const style = styleOf(lab);
  const w = style === 'island' ? islandCount(lab) * ISLAND_GAP + 2.4 : lab.cols * DX + 3;
  const d = style === 'island' ? (sideRows(lab) + (lab.rows > sideRows(lab) ? 1 : 0)) * ISLAND_ROW + 7.5 : lab.rows * DZ + 4.5;

  return (
    <>
      <Room lab={lab} w={w} d={d} style={style} />
      {style === 'island' && <Spines lab={lab} pcs={pcs} />}
      {pcs.map((pc) => {
        const { pos, rot } = place(pc, lab, style);
        return (
          <Workstation
            key={pc.id}
            pc={pc}
            style={style}
            pos={pos}
            rot={rot}
            selected={pc.id === selectedId}
            onSelect={() => onSelect(pc.id)}
          />
        );
      })}

      {/* 3D Animated Students & Single Whiteboard Instructor */}
      <LabCharacters3D
        lab={lab}
        pcs={pcs}
        w={w}
        d={d}
        style={style}
        simMode={simMode ?? (isOccupied ? 'in_session' : 'empty')}
        teacherName={teacherName}
      />

      <ContactShadows position={[0, 0.003, 0]} scale={Math.max(w, d)} opacity={0.2} blur={2.5} far={2} />
    </>
  );
}

export default function LabScene({
  lab,
  pcs,
  selectedId,
  onSelect,
  onReady,
  isOccupied = false,
  simMode,
  teacherName,
}: SceneProps) {
  const cam = LAB_CAMERAS[lab.id] ?? {
    pos: [0, 10.4, 10.8],
    target: [0, 0.7, -1.1],
    fov: 46,
  };

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: cam.pos, fov: cam.fov }}
      onPointerMissed={() => onSelect('')}
      onCreated={() => onReady?.()}
    >
      <ReadySignal onReady={onReady} />
      <color attach="background" args={['#dfe5ee']} />
      <hemisphereLight args={['#ffffff', '#c4ccd6', 1]} />
      <directionalLight
        position={[5, 10, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <SceneContent
        lab={lab}
        pcs={pcs}
        selectedId={selectedId}
        onSelect={onSelect}
        isOccupied={isOccupied}
        simMode={simMode}
        teacherName={teacherName}
      />
      <OrbitControls makeDefault target={cam.target} maxPolarAngle={1.35} minDistance={3} maxDistance={40} enableDamping />
    </Canvas>
  );
}
