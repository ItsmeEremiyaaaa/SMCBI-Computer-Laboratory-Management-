import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, ContactShadows, Html, OrbitControls, RoundedBox } from '@react-three/drei';
import type { LivePc } from '../hooks/useLabLive';
import type { Lab } from '../lib/types';
import type { SceneProps } from './SeatGrid';
import { STATUS_COLOR, STATUS_LABEL } from './ui';

// Modeled on the SMCBI labs: Lab 1/2 have long white benches with white partitions;
// Netlab has separate dark-top tables on metal legs. Both use white monobloc chairs.
type Style = 'bench' | 'table';
const styleOf = (lab: Lab): Style => (/netlab/i.test(lab.id + lab.name) ? 'table' : 'bench');

const DX = 1.15; // seat width along a bench
const DZ = 1.9; // row spacing
const AISLE = 1.3; // center aisle
const DESK_D = 0.7;
const DESK_H = 0.75;

function seatX(col: number, cols: number) {
  const half = Math.ceil(cols / 2);
  const x = (col - (cols - 1) / 2) * DX;
  return x + (col >= half ? AISLE / 2 : -AISLE / 2);
}
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

function Workstation({ pc, pos, style, selected, onSelect }:
  { pc: LivePc; pos: [number, number, number]; style: Style; selected: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  const color = STATUS_COLOR[pc.shown];
  const glow = pc.shown === 'broken' ? 0.7 : pc.shown === 'free' ? 0.85 : 1.5;
  const black = <meshStandardMaterial color="#15181d" roughness={0.45} />;
  return (
    <group position={pos}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
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
      <RoundedBox args={[0.62, 0.4, 0.035]} radius={0.01} position={[0, DESK_H + 0.4, -0.2]} castShadow>{black}</RoundedBox>
      <mesh position={[0, DESK_H + 0.41, -0.181]}>
        <planeGeometry args={[0.57, 0.33]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} toneMapped={false} />
      </mesh>
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
      {(selected || hover) && (
        <Html position={[0, DESK_H + 0.78, -0.2]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded bg-rail px-2 py-1 text-xs font-medium text-white shadow">
            {pc.label} · {STATUS_LABEL[pc.shown]}
          </div>
        </Html>
      )}
    </group>
  );
}

// Lab 1/2: one continuous white bench per row and side, with partitions between seats.
function Benches({ lab }: { lab: Lab }) {
  const half = Math.ceil(lab.cols / 2);
  const blocks = [[0, half - 1], [half, lab.cols - 1]].filter(([a, b]) => a <= b);
  const white = <meshStandardMaterial color="#f7f7f5" roughness={0.35} />;
  return (
    <>
      {Array.from({ length: lab.rows }, (_, r) => blocks.map(([a, b]) => {
        const x0 = seatX(a, lab.cols) - DX / 2;
        const x1 = seatX(b, lab.cols) + DX / 2;
        const w = x1 - x0;
        const cx = (x0 + x1) / 2;
        const z = rowZ(r, lab.rows);
        return (
          <group key={`${r}-${a}`} position={[cx, 0, z]}>
            <mesh position={[0, DESK_H, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.04, DESK_D]} />{white}</mesh>
            {/* front modesty panel rising above the desk, like the photos */}
            <mesh position={[0, DESK_H / 2 + 0.17, -DESK_D / 2]} castShadow><boxGeometry args={[w, DESK_H + 0.34, 0.025]} />{white}</mesh>
            {/* end panels */}
            {[-w / 2, w / 2].map((x) => (
              <mesh key={x} position={[x, DESK_H / 2, 0]} castShadow><boxGeometry args={[0.03, DESK_H, DESK_D]} />
                <meshStandardMaterial color="#e9e3d6" /></mesh>
            ))}
            {/* partitions between seats */}
            {Array.from({ length: b - a }, (_, i) => (
              <mesh key={i} position={[x0 - cx + (i + 1) * DX, DESK_H + 0.16, -0.05]} castShadow>
                <boxGeometry args={[0.025, 0.32, DESK_D - 0.12]} />{white}
              </mesh>
            ))}
          </group>
        );
      }))}
    </>
  );
}

function Frame({ position, w, h, color }: { position: [number, number, number]; w: number; h: number; color: string }) {
  return (
    <group position={position}>
      <mesh><boxGeometry args={[w, h, 0.02]} /><meshStandardMaterial color="#e6e8ee" /></mesh>
      <mesh position={[0, 0, 0.012]}><planeGeometry args={[w - 0.06, h - 0.06]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, h / 2 - 0.08, 0.013]}><planeGeometry args={[w - 0.1, 0.07]} /><meshStandardMaterial color="#1e3a8a" /></mesh>
    </group>
  );
}

function Room({ w, d, style }: { w: number; d: number; style: Style }) {
  const wall = <meshStandardMaterial color="#f1efe8" roughness={0.9} />;
  const frosted = <meshStandardMaterial color="#b9cdd4" roughness={0.25} metalness={0.1} />;
  const front = -d / 2;
  return (
    <group>
      {/* white tile floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[w, d]} /><meshStandardMaterial color="#eef0f2" roughness={0.6} /></mesh>
      <gridHelper args={[Math.max(w, d), Math.round(Math.max(w, d) / 0.6), '#d7dbe0', '#dfe2e6']} position={[0, 0.002, 0]} />

      {/* front wall */}
      <mesh position={[0, 1.6, front]} receiveShadow><boxGeometry args={[w, 3.2, 0.1]} />{wall}</mesh>
      {style === 'bench' ? <>
        {/* whiteboard in a light wood frame, frosted glass panels on both sides */}
        <mesh position={[0, 1.45, front + 0.06]}><boxGeometry args={[3.4, 1.5, 0.04]} /><meshStandardMaterial color="#d8c39b" /></mesh>
        <mesh position={[0, 1.45, front + 0.085]}><boxGeometry args={[3.25, 1.36, 0.01]} /><meshStandardMaterial color="#fbfbfb" roughness={0.15} /></mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (1.7 + 1.2), 1.45, front + 0.06]}><boxGeometry args={[2.1, 1.4, 0.03]} />{frosted}</mesh>
        ))}
        <Frame position={[-1.2, 2.65, front + 0.07]} w={0.9} h={0.62} color="#f4f6fb" />
        <Frame position={[1.2, 2.65, front + 0.07]} w={0.9} h={0.62} color="#f4f6fb" />
      </> : <>
        {/* Netlab: frosted board/windows, red curtain, door */}
        <mesh position={[-1.4, 1.55, front + 0.06]}><boxGeometry args={[2.4, 1.3, 0.03]} />{frosted}</mesh>
        <mesh position={[1.9, 1.55, front + 0.06]}><boxGeometry args={[2.6, 1.4, 0.03]} />{frosted}</mesh>
        <mesh position={[-w / 2 + 0.5, 1.4, front + 0.12]}><boxGeometry args={[0.8, 2.4, 0.06]} /><meshStandardMaterial color="#9b1c22" roughness={0.9} /></mesh>
        <mesh position={[w / 2 - 0.7, 1.05, front + 0.07]}><boxGeometry args={[0.95, 2.1, 0.05]} /><meshStandardMaterial color="#e4d6c4" /></mesh>
      </>}
      {/* crucifix */}
      <group position={[0, 2.65, front + 0.08]}>
        <mesh><boxGeometry args={[0.05, 0.42, 0.03]} /><meshStandardMaterial color="#4a2f1d" /></mesh>
        <mesh position={[0, 0.08, 0]}><boxGeometry args={[0.24, 0.045, 0.03]} /><meshStandardMaterial color="#4a2f1d" /></mesh>
      </group>

      {/* side walls kept low so you can see in; window AC unit on the right */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * w) / 2, 0.7, 0]} receiveShadow><boxGeometry args={[0.1, 1.4, d]} />{wall}</mesh>
      ))}
      <group position={[w / 2 - 0.12, 1.15, front + 2.2]}>
        <mesh><boxGeometry args={[0.18, 0.42, 0.66]} /><meshStandardMaterial color="#e8e6df" /></mesh>
        <mesh position={[-0.095, 0, 0]}><boxGeometry args={[0.01, 0.3, 0.55]} /><meshStandardMaterial color="#b9b7ae" /></mesh>
      </group>

      {/* teacher's table + chair at the front */}
      <group position={[-w / 2 + 2.2, 0, front + 1.3]}>
        <mesh position={[0, DESK_H, 0]} castShadow><boxGeometry args={[1.5, 0.04, 0.7]} />
          <meshStandardMaterial color={style === 'table' ? '#2b2f36' : '#f7f7f5'} /></mesh>
        <mesh position={[0, DESK_H / 2, -0.3]}><boxGeometry args={[1.45, DESK_H, 0.03]} /><meshStandardMaterial color="#e9e3d6" /></mesh>
        <mesh position={[0, DESK_H + 0.25, -0.1]} rotation-y={Math.PI}><boxGeometry args={[0.55, 0.36, 0.03]} />
          <meshStandardMaterial color="#15181d" /></mesh>
      </group>
    </group>
  );
}

export default function LabScene({ lab, pcs, selectedId, onSelect }: SceneProps) {
  const style = styleOf(lab);
  const w = lab.cols * DX + AISLE + 3;
  const d = lab.rows * DZ + 4.5;
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, w * 0.4, d / 2 + w * 0.6], fov: 45 }} onPointerMissed={() => onSelect('')}>
      <color attach="background" args={['#dfe5ee']} />
      <hemisphereLight args={['#ffffff', '#c4ccd6', 1]} />
      <directionalLight position={[5, 10, 6]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      {/* Bounds frames the room for whatever aspect the canvas has (phone or desktop). */}
      <Bounds fit margin={0.8}>
        <Room w={w} d={d} style={style} />
      </Bounds>
      {style === 'bench' && <Benches lab={lab} />}
      {pcs.map((pc) => (
        <Workstation key={pc.id} pc={pc} style={style} selected={pc.id === selectedId} onSelect={() => onSelect(pc.id)}
          pos={[seatX(pc.col, lab.cols), 0, rowZ(pc.row, lab.rows)]} />
      ))}
      <ContactShadows position={[0, 0.003, 0]} scale={Math.max(w, d)} opacity={0.2} blur={2.5} far={2} />
      <OrbitControls makeDefault maxPolarAngle={1.35} minDistance={3} maxDistance={40} enableDamping />
    </Canvas>
  );
}
