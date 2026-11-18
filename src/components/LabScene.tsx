import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import { CanvasTexture, MathUtils, RepeatWrapping, SRGBColorSpace, type Group, type Vector3, type MeshStandardMaterial } from 'three';
import type { LivePc } from '../hooks/useLabLive';
import type { Lab } from '../lib/types';
import type { SceneProps } from './SeatGrid';
import { LAYOUTS, roomSize, seatPlacement } from '../lib/layouts';
import { STATUS_COLOR } from './ui';
import LabCharacters3D from './LabCharacters3D';

// Modeled on the SMCBI labs: Lab 1/2 have long white benches with white partitions;
// Netlab has separate dark-top tables on metal legs. Both use white monobloc chairs.
const DX = 1.15; // seat width (Netlab tables)
const DESK_D = 0.7;
const DESK_H = 0.75;
const CEIL = 3.2; // ceiling height; the camera is kept inside the room below it

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
function place(pc: LivePc, lab: Lab): { pos: [number, number, number]; rot: number } {
  return seatPlacement(lab, pc.row, pc.col);
}

// Modern Central Divider Partition between island rows
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
          <group key={i} position={[islandX(i, n), 0, (z0 + z1) / 2]}>
            {/* Center cable spine structure */}
            <mesh position={[0, (DESK_H + 0.28) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.08, DESK_H + 0.28, z1 - z0]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.4} />
            </mesh>
            {/* Aluminum top rail trim */}
            <mesh position={[0, DESK_H + 0.29, 0]}>
              <boxGeometry args={[0.10, 0.02, z1 - z0]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.25} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}


// Modern Ergonomic Black Mesh Office Task Chair (matching reference photo)
function ErgonomicMeshChair({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const black = <meshStandardMaterial color="#18181b" roughness={0.65} />;
  const meshMat = <meshStandardMaterial color="#d6d6d9" roughness={0.85} />; // light grey fabric cushion
  const chrome = <meshStandardMaterial color="#94a3b8" metalness={0.75} roughness={0.25} />;
  return (
    <group position={position} rotation-y={rotationY}>
      {/* 5-Star Caster Wheel Base */}
      <group position={[0, 0.04, 0]}>
        {[0, 72, 144, 216, 288].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <group key={deg} rotation-y={rad}>
              {/* Star leg ray */}
              <mesh position={[0, 0, 0.15]}>
                <boxGeometry args={[0.035, 0.025, 0.26]} />
                {black}
              </mesh>
              {/* Caster wheel */}
              <mesh position={[0, -0.02, 0.26]}>
                <cylinderGeometry args={[0.022, 0.022, 0.028, 8]} />
                {black}
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Hydraulic pneumatic lift cylinder */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.024, 0.03, 0.34, 12]} />
        {chrome}
      </mesh>

      {/* Seat cushion (contoured ergonomic foam, height 0.44m) */}
      <group position={[0, 0.43, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[0.46, 0.055, 0.44]} />
          {black}
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.44, 0.05, 0.42]} />
          {meshMat}
        </mesh>
      </group>

      {/* Ergonomic Curved Mesh Backrest */}
      <group position={[0, 0.70, 0.18]} rotation-x={-0.08}>
        {/* Central spine support */}
        <mesh position={[0, -0.06, 0.02]}>
          <boxGeometry args={[0.05, 0.36, 0.025]} />
          {black}
        </mesh>
        {/* Outer backrest frame */}
        <mesh>
          <boxGeometry args={[0.44, 0.46, 0.024]} />
          {black}
        </mesh>
        {/* Breathable Mesh panel */}
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[0.42, 0.42, 0.05]} />
          {meshMat}
        </mesh>
        {/* Lumbar support contour */}
        <mesh position={[0, -0.10, -0.012]}>
          <boxGeometry args={[0.32, 0.06, 0.018]} />
          {black}
        </mesh>
      </group>

      {/* Left and Right Armrests */}
      {[-0.22, 0.22].map((armX) => (
        <group key={armX} position={[armX, 0.53, 0.03]}>
          {/* Vertical upright arm post */}
          <mesh>
            <boxGeometry args={[0.028, 0.18, 0.035]} />
            {black}
          </mesh>
          {/* Soft padded armrest pad */}
          <mesh position={[0, 0.09, -0.04]}>
            <boxGeometry args={[0.055, 0.022, 0.20]} />
            {black}
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Where each lab's right-wall door leads.
const SIDE_DOOR: Record<string, string> = { lab1: 'ADMIN OFFICE', lab2: 'COMLAB 1', netlab: 'COMLAB 2' };
const BACK_DOOR_INSET = 1.6; // metres from the side wall to the door centre

// Door sign: white text on a navy plate.
const signTex = (text: string) => paintTex([512, 120], (ctx, w, h) => {
  ctx.fillStyle = '#1e3a8a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 56px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
});

// Painted canvas texture (tiles, wood, wall graphic). Falls back to a blank texture where canvas 2D is unavailable (tests).
function paintTex(size: [number, number], draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat: [number, number] = [1, 1]) {
  if (typeof document === 'undefined') return new CanvasTexture({} as HTMLCanvasElement);
  const c = document.createElement('canvas');
  [c.width, c.height] = size;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, c.width, c.height);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

// White ceramic floor tile with grey grout and faint marbling (one 0.6 m tile per repeat).
const floorTex = (rx: number, ry: number) => paintTex([256, 256], (ctx, w, h) => {
  ctx.fillStyle = '#eceef0'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(150,160,175,${0.04 + (i % 5) * 0.012})`;
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath(); ctx.moveTo((i * 53) % w, 0); ctx.bezierCurveTo((i * 31) % w, h / 3, (i * 71) % w, h / 2, (i * 17) % w, h); ctx.stroke();
  }
  ctx.strokeStyle = '#a9b0ba'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, w, h);
}, [rx, ry]);

// Grey acoustic drop-ceiling tile with a dark T-bar grid.
const ceilingTex = (rx: number, ry: number) => paintTex([128, 128], (ctx, w, h) => {
  ctx.fillStyle = '#c9c5bd'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(80,75,70,0.18)';
  for (let i = 0; i < 260; i++) ctx.fillRect((i * 37) % w, (i * 61) % h, 1.5, 1.5);
  ctx.strokeStyle = '#6b665f'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, w, h);
}, [rx, ry]);

let woodCache: CanvasTexture | null = null;
// Warm beech/oak laminate grain for desks.
function woodTex() {
  return (woodCache ??= paintTex([256, 128], (ctx, w, h) => {
    ctx.fillStyle = '#c98f57'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      ctx.strokeStyle = `rgba(${y % 2 ? '120,70,30' : '230,180,120'},${0.08 + ((y * 7) % 10) / 80})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + y * 0.4) * 2);
      ctx.stroke();
    }
  }));
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
    m.position.y = MathUtils.lerp(m.position.y, DESK_H + 0.36 + (selected ? 0.16 : hover ? 0.05 : 0), k);
    m.rotation.x = MathUtils.lerp(m.rotation.x, selected ? 0.22 : 0, k);
    m.scale.setScalar(MathUtils.lerp(m.scale.x, selected ? 1.15 : 1, k));
    if (screen.current) screen.current.emissiveIntensity = glow + (selected ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 4) : 0);
  });

  const color = STATUS_COLOR[pc.shown];
  const glow = pc.shown === 'broken' ? 0.7 : pc.shown === 'free' ? 0.85 : 1.5;
  const silverMetal = <meshStandardMaterial color="#1f1f22" roughness={0.45} />; // black monitor stand
  const whiteShell = <meshStandardMaterial color="#141416" roughness={0.35} />; // black LCD casing
  const wood = <meshStandardMaterial map={woodTex()} color="#ffffff" roughness={0.5} />;

  const deskWidth = style === 'table' ? DX - 0.04 : 1.12;

  return (
    <group position={pos} rotation-y={rot} name={`pc:${pc.id}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
      
      {/* Light natural warm wood tabletop (beech/warm oak matching reference photo) */}
      <mesh position={[0, DESK_H, -0.01]} castShadow receiveShadow>
        <boxGeometry args={[deskWidth, 0.038, DESK_D - 0.02]} />
        <meshStandardMaterial map={woodTex()} color={selected || hover ? '#fff3e0' : '#ffffff'} roughness={0.42} />
      </mesh>

      {/* Solid wooden side panels and back modesty panel */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (deskWidth / 2 - 0.02), DESK_H / 2, -0.01]} castShadow receiveShadow>
          <boxGeometry args={[0.03, DESK_H, DESK_D - 0.04]} />
          {wood}
        </mesh>
      ))}
      <mesh position={[0, DESK_H / 2 + 0.1, -DESK_D / 2 + 0.04]} receiveShadow>
        <boxGeometry args={[deskWidth - 0.06, DESK_H - 0.2, 0.02]} />
        {wood}
      </mesh>

      {/* Black CPU tower under the desk */}
      <mesh position={[deskWidth / 2 - 0.16, 0.22, -0.12]} castShadow>
        <boxGeometry args={[0.18, 0.42, 0.4]} />
        <meshStandardMaterial color="#18181b" roughness={0.4} />
      </mesh>

      {/* Center Acoustic Divider Partition between facing desks (low frosted screen with silver clips) */}
      {style === 'island' && (
        <group position={[0, DESK_H + 0.16, -DESK_D / 2]}>
          <mesh castShadow>
            <boxGeometry args={[deskWidth, 0.28, 0.022]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.35} />
          </mesh>
          {[-deskWidth * 0.32, deskWidth * 0.32].map((bx) => (
            <mesh key={bx} position={[bx, -0.14, 0]}>
              <boxGeometry args={[0.028, 0.05, 0.038]} />
              {silverMetal}
            </mesh>
          ))}
        </group>
      )}

      {/* Modern All-in-One PC Stand (sleek silver aluminum L-stand) */}
      <group position={[0, DESK_H + 0.015, -0.17]}>
        <mesh position={[0, 0.005, 0.02]}><boxGeometry args={[0.18, 0.01, 0.15]} />{silverMetal}</mesh>
        <mesh position={[0, 0.10, -0.03]} rotation-x={0.12}><boxGeometry args={[0.075, 0.20, 0.018]} />{silverMetal}</mesh>
      </group>

      {/* Modern All-in-One Display Monitor */}
      <group ref={monitor} position={[0, DESK_H + 0.36, -0.18]}>
        {/* Sleek white/silver rear casing */}
        <RoundedBox args={[0.62, 0.40, 0.026]} radius={0.01} castShadow>
          {whiteShell}
        </RoundedBox>
        {/* Front glass bezel */}
        <mesh position={[0, 0, 0.014]}>
          <planeGeometry args={[0.61, 0.39]} />
          <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.2} />
        </mesh>
        {/* Active glowing display screen */}
        <mesh position={[0, 0.01, 0.015]}>
          <planeGeometry args={[0.57, 0.33]} />
          <meshStandardMaterial ref={screen} color={color} emissive={color} emissiveIntensity={glow} toneMapped={false} />
        </mesh>
        {/* Broken glass crack fracture overlay */}
        {pc.shown === 'broken' && (
          <mesh position={[0, 0.01, 0.017]}>
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

      {/* Black keyboard */}
      <mesh position={[0, DESK_H + 0.022, 0.10]} castShadow>
        <boxGeometry args={[0.42, 0.012, 0.13]} />
        <meshStandardMaterial color="#1c1c1f" roughness={0.4} />
      </mesh>
      <mesh position={[0, DESK_H + 0.028, 0.10]}>
        <boxGeometry args={[0.39, 0.005, 0.11]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.5} />
      </mesh>

      {/* Black optical mouse */}
      <mesh position={[0.30, DESK_H + 0.024, 0.11]} castShadow>
        <boxGeometry args={[0.055, 0.018, 0.09]} />
        <meshStandardMaterial color="#1c1c1f" roughness={0.3} />
      </mesh>

      {/* Modern Ergonomic Black Mesh Office Task Chair */}
      <ErgonomicMeshChair position={[0, 0, 0.62]} />

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
  // Frosted glass so nothing outside the room shows through
  const glassMat = <meshStandardMaterial color="#d7e8f3" transparent opacity={0.85} roughness={0.2} emissive="#cfe3f0" emissiveIntensity={0.35} />;
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
              {/* Wall header above door up to the ceiling */}
              <mesh position={[0, (2.3 + CEIL) / 2, zCenter]}>
                <boxGeometry args={[0.1, CEIL - 2.3, bayLength]} />
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
            <mesh position={[0, (2.38 + CEIL) / 2, zCenter]}>
              <boxGeometry args={[0.1, CEIL - 2.38, bayLength]} />
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
        <meshStandardMaterial color="#d7e8f3" transparent opacity={0.85} roughness={0.2} emissive="#cfe3f0" emissiveIntensity={0.35} />
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
        <meshStandardMaterial color="#64748b" />
      </mesh>

      {/* Wall speakers in the upper front corners */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.5), 2.45, front + 0.16]} castShadow>
          <boxGeometry args={[0.24, 0.38, 0.2]} />
          <meshStandardMaterial color="#1c1c1f" roughness={0.5} />
        </mesh>
      ))}

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
        {/* Wooden teacher desk: top, side panels and front modesty panel */}
        <mesh position={[0, DESK_H, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.04, 0.7]} />
          <meshStandardMaterial map={woodTex()} roughness={0.4} />
        </mesh>
        <mesh position={[0, DESK_H / 2, 0.32]}>
          <boxGeometry args={[1.42, DESK_H - 0.08, 0.02]} />
          <meshStandardMaterial map={woodTex()} roughness={0.5} />
        </mesh>
        {[-0.72, 0.72].map((lx) => (
          <mesh key={lx} position={[lx, DESK_H / 2, 0]} castShadow>
            <boxGeometry args={[0.04, DESK_H, 0.68]} />
            <meshStandardMaterial map={woodTex()} roughness={0.5} />
          </mesh>
        ))}
        {/* Teacher's Modern Laptop */}
        <group position={[0, DESK_H + 0.02, 0]}>
          <mesh><boxGeometry args={[0.34, 0.015, 0.24]} /><meshStandardMaterial color="#e2e8f0" metalness={0.5} /></mesh>
          <mesh position={[0, 0.11, -0.1]} rotation-x={0.25}><boxGeometry args={[0.34, 0.22, 0.012]} /><meshStandardMaterial color="#0f172a" /></mesh>
          <mesh position={[0, 0.11, -0.093]} rotation-x={0.25}><planeGeometry args={[0.32, 0.2]} /><meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.8} /></mesh>
        </group>
        {/* Ergonomic teacher chair */}
        <ErgonomicMeshChair position={[0, 0, -0.45]} />
      </group>
    </group>
  );
}

function Room({ lab, w, d, style }: { lab: Lab; w: number; d: number; style: Style }) {
  const wall = <meshStandardMaterial color="#f2f1ec" roughness={0.8} />;
  const front = -d / 2;
  const back = d / 2;

  // Window bay subdivisions along the depth of the room
  const bayCount = Math.max(4, Math.floor(d / 2.0));
  const bayLength = d / bayCount;
  // Exit door integrated in the window wall at the cactus location (front-left corner bay)
  const exitDoorZ = front + bayLength * 0.5;

  // Left wall has the exit door for all labs at the cactus location
  const leftDoorZs = [exitDoorZ];
  // Right wall: continuous windows. The connecting door is in the back wall, near the corner
  // on the right when standing at the whiteboard looking toward the back (x = -w/2 side).
  const rightDoorZs: number[] = [];
  const sideDoorTo = SIDE_DOOR[lab.id];
  const backDoorX = -w / 2 + BACK_DOOR_INSET;
  const sign = useMemo(() => sideDoorTo && signTex(sideDoorTo), [sideDoorTo]);

  const floor = useMemo(() => floorTex(w / 0.6, d / 0.6), [w, d]);
  const ceiling = useMemo(() => ceilingTex(w / 0.6, d / 0.6), [w, d]);
  // Recessed light panels on a 2.4 m grid
  const lights = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = -w / 2 + 1.8; x < w / 2 - 1; x += 2.4) for (let z = front + 1.8; z < back - 1; z += 2.4) out.push([x, z]);
    return out;
  }, [w, front, back]);

  return (
    <group>
      {/* White ceramic tile floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w + 0.2, d + 0.2]} />
        <meshStandardMaterial map={floor} roughness={0.3} />
      </mesh>

      {/* Drop ceiling with acoustic tiles (does not cast shadows, so the room stays lit) */}
      <mesh rotation-x={Math.PI / 2} position={[0, CEIL, 0]}>
        <planeGeometry args={[w + 0.2, d + 0.2]} />
        <meshStandardMaterial map={ceiling} roughness={0.9} />
      </mesh>
      {lights.map(([x, z]) => (
        <mesh key={`${x}:${z}`} rotation-x={Math.PI / 2} position={[x, CEIL - 0.01, z]}>
          <planeGeometry args={[0.6, 1.2]} />
          <meshStandardMaterial color="#ffffff" emissive="#fffaf0" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      ))}

      {/* Ceiling-mounted projector aimed at the front wall */}
      <group position={[0, CEIL - 0.35, front + 3]}>
        <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.02, 0.02, 0.3, 8]} /><meshStandardMaterial color="#27272a" /></mesh>
        <mesh castShadow><boxGeometry args={[0.45, 0.14, 0.38]} /><meshStandardMaterial color="#111113" roughness={0.35} /></mesh>
        <mesh position={[0.1, 0, -0.2]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.05, 0.05, 0.04, 16]} /><meshStandardMaterial color="#38bdf8" emissive="#7dd3fc" emissiveIntensity={1.5} toneMapped={false} /></mesh>
      </group>

      {/* Front Wall */}
      <mesh position={[0, CEIL / 2, front]} receiveShadow>
        <boxGeometry args={[w + 0.1, CEIL, 0.1]} />
        {wall}
      </mesh>

      {/* Back wall */}
      <mesh position={[0, CEIL / 2, back]} receiveShadow>
        <boxGeometry args={[w + 0.1, CEIL, 0.1]} />
        {wall}
      </mesh>
      <mesh position={[0, 0.06, back - 0.06]}>
        <boxGeometry args={[w, 0.12, 0.03]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>

      {/* Front Wall Decor (Clean Whiteboard & Centered Teacher Station) */}
      <FrontWallDecor lab={lab} w={w} front={front} style={style} />

      {/* Glass Windows on Left and Right Walls */}
      <GlassWindowWall side={-1} w={w} d={d} front={front} doorZList={leftDoorZs} />
      <GlassWindowWall side={1} w={w} d={d} front={front} doorZList={rightDoorZs} />

      {/* Connecting door in the back wall, with a sign saying where it leads */}
      {sideDoorTo && (
        <>
          <Doorway position={[backDoorX, 0, back - 0.06]} rotationY={Math.PI} />
          <mesh position={[backDoorX, 2.5, back - 0.07]} rotation-y={Math.PI}>
            <planeGeometry args={[1.1, 0.26]} />
            <meshStandardMaterial map={sign || undefined} roughness={0.5} />
          </mesh>
        </>
      )}

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

      {/* ComLab 2: Door to NetLab (front left) and window */}
      {lab.id === 'lab2' && (
        <>
          <Doorway position={[-w / 2 + 1.25, 0, front + 0.06]} rotationY={0} />
          <FrontWallWindow position={[w / 2 - 3.4, 1.6, front + 0.06]} w={1.8} h={1.4} />
        </>
      )}

      {/* NetLab: "as netlab in the end, just the exit put" - only the exit door, no extra doors */}

      {/* Wall-Mounted Split Inverter Air Conditioner on right wall */}
      <AirConditioner position={[w / 2 - 0.14, 2.1, front + 1.8]} rotationY={-Math.PI / 2} />
    </group>
  );
}

// Reports ready only once the orbit controls have aimed the camera and textures/shaders have
// had a few frames to upload, so the scene is revealed already settled instead of jumping.
function ReadySignal({ onReady }: { onReady?: () => void }) {
  const frames = useRef(0);
  useFrame((state) => {
    if (!state.controls || frames.current > 30) return;
    if (++frames.current === 30) onReady?.();
  });
  return null;
}

// Starts the camera in a back corner under the ceiling (like a photo of the room) and keeps it,
// and the orbit target, inside the walls so nothing outside the lab is ever visible.
function RoomCamera({ w, d }: { w: number; d: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  useEffect(() => {
    camera.position.set(w / 2 - 0.5, CEIL - 0.45, d / 2 - 0.5);
    controls?.target.set(0, 0.6, -d / 6);
    controls?.update();
  }, [camera, controls, w, d]);
  useFrame(() => {
    const m = 0.3;
    camera.position.set(
      MathUtils.clamp(camera.position.x, -w / 2 + m, w / 2 - m),
      MathUtils.clamp(camera.position.y, 0.5, CEIL - 0.2),
      MathUtils.clamp(camera.position.z, -d / 2 + m, d / 2 - m),
    );
    const t = controls?.target;
    if (t) t.set(MathUtils.clamp(t.x, -w / 2 + m, w / 2 - m), MathUtils.clamp(t.y, 0, CEIL - 0.3), MathUtils.clamp(t.z, -d / 2 + m, d / 2 - m));
  });
  return null;
}

function SceneContent({
  lab,
  pcs,
  selectedId,
  onSelect,
  isOccupied,
  simMode,
  teacherName,
  ...live
}: Pick<SceneProps, 'lab' | 'pcs' | 'selectedId' | 'onSelect' | 'isOccupied' | 'simMode' | 'teacherName' | 'phaseOffset' | 'phaseLength' | 'students' | 'onStudentSelect'>) {
  const style = styleOf(lab);
  const { w, d } = roomSize(lab);

  return (
    <>
      <Room lab={lab} w={w} d={d} style={style} />
      {style === 'island' && <Spines lab={lab} pcs={pcs} />}
      {pcs.map((pc) => {
        const { pos, rot } = place(pc, lab);
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
        phaseOffset={live.phaseOffset}
        phaseLength={live.phaseLength}
        students={live.students}
        onStudentSelect={live.onStudentSelect}
      />

      
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
  ...live
}: SceneProps) {
  const { w, d } = roomSize(lab);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [w / 2 - 0.5, CEIL - 0.45, d / 2 - 0.5], fov: 62, near: 0.1, far: 60 }} // tight near/far keeps depth precise so small parts don't flicker
      onPointerMissed={() => onSelect('')}
    >
      <ReadySignal onReady={onReady} />
      <RoomCamera key={lab.id} w={w} d={d} />
      <color attach="background" args={['#f2f1ec']} />
      <hemisphereLight args={['#ffffff', '#bdb6aa', 1.1]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 10, 6]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
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
        {...live}
      />
      <OrbitControls makeDefault maxPolarAngle={1.45} minDistance={1.5} maxDistance={Math.hypot(w, d)} enableDamping />
    </Canvas>
  );
}
