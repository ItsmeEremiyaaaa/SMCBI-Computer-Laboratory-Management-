import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, ContactShadows, Html, OrbitControls, RoundedBox } from '@react-three/drei';
import type { LivePc } from '../hooks/useLabLive';
import type { SceneProps } from './SeatGrid';
import { STATUS_COLOR, STATUS_LABEL } from './ui';

const DX = 1.55; // desk spacing across
const DZ = 1.9; // row spacing
const AISLE = 0.7; // center aisle width

function deskPos(pc: LivePc, cols: number, rows: number): [number, number, number] {
  const half = Math.floor(cols / 2);
  const x = (pc.col - (cols - 1) / 2) * DX + (pc.col >= half ? AISLE / 2 : -AISLE / 2);
  const z = (pc.row - (rows - 1) / 2) * DZ + 1;
  return [x, 0, z];
}

function Workstation({ pc, pos, selected, onSelect }: { pc: LivePc; pos: [number, number, number]; selected: boolean; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  const color = STATUS_COLOR[pc.shown];
  const glow = pc.shown === 'broken' ? 0.6 : pc.shown === 'free' ? 0.9 : 1.6;
  return (
    <group position={pos}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
      {/* desk */}
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.04, 0.72]} />
        <meshStandardMaterial color={selected || hover ? '#d8e4f5' : '#c9b79c'} roughness={0.7} />
      </mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]} castShadow>
          <boxGeometry args={[0.04, 0.72, 0.66]} />
          <meshStandardMaterial color="#8e9aab" />
        </mesh>
      ))}
      {/* tower */}
      <mesh position={[0.42, 0.24, -0.05]} castShadow>
        <boxGeometry args={[0.2, 0.44, 0.44]} />
        <meshStandardMaterial color="#2a3342" roughness={0.5} />
      </mesh>
      <mesh position={[0.42, 0.38, 0.175]}>
        <boxGeometry args={[0.03, 0.03, 0.01]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {/* monitor */}
      <mesh position={[0, 0.82, -0.18]}>
        <boxGeometry args={[0.18, 0.02, 0.14]} />
        <meshStandardMaterial color="#222a36" />
      </mesh>
      <mesh position={[0, 0.92, -0.2]}>
        <boxGeometry args={[0.04, 0.2, 0.04]} />
        <meshStandardMaterial color="#222a36" />
      </mesh>
      <RoundedBox args={[0.68, 0.42, 0.04]} radius={0.015} position={[0, 1.18, -0.2]} castShadow>
        <meshStandardMaterial color="#1a212c" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 1.18, -0.177]}>
        <planeGeometry args={[0.62, 0.36]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} toneMapped={false} />
      </mesh>
      {/* keyboard */}
      <mesh position={[0, 0.77, 0.12]}>
        <boxGeometry args={[0.44, 0.015, 0.14]} />
        <meshStandardMaterial color="#3a4352" />
      </mesh>
      {/* chair */}
      <group position={[0, 0, 0.62]}>
        <mesh position={[0, 0.46, 0]} castShadow>
          <boxGeometry args={[0.46, 0.06, 0.44]} />
          <meshStandardMaterial color="#33415a" />
        </mesh>
        <mesh position={[0, 0.78, 0.2]} castShadow>
          <boxGeometry args={[0.44, 0.52, 0.05]} />
          <meshStandardMaterial color="#33415a" />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.44]} />
          <meshStandardMaterial color="#6b7686" />
        </mesh>
      </group>
      {/* selection ring */}
      {(selected || hover) && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0.25]}>
          <ringGeometry args={[0.82, 0.9, 48]} />
          <meshBasicMaterial color={selected ? '#1f5fbf' : '#7fa6dd'} />
        </mesh>
      )}
      {(selected || hover) && (
        <Html position={[0, 1.55, -0.2]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded bg-rail px-2 py-1 text-xs font-medium text-white shadow">
            {pc.label} · {STATUS_LABEL[pc.shown]}
          </div>
        </Html>
      )}
    </group>
  );
}

function Room({ w, d }: { w: number; d: number }) {
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#e6e9ee" roughness={0.9} />
      </mesh>
      {/* floor tile lines */}
      <gridHelper args={[Math.max(w, d), Math.round(Math.max(w, d) / 0.6), '#cfd5de', '#d9dee6']} position={[0, 0.002, 0]} />
      {/* front wall + whiteboard */}
      <mesh position={[0, 1.5, -d / 2]} receiveShadow>
        <boxGeometry args={[w, 3, 0.1]} />
        <meshStandardMaterial color="#f4f6f9" />
      </mesh>
      <mesh position={[0, 1.6, -d / 2 + 0.06]}>
        <boxGeometry args={[4.2, 1.3, 0.03]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.93, -d / 2 + 0.1]}>
        <boxGeometry args={[4.2, 0.04, 0.08]} />
        <meshStandardMaterial color="#9aa5b4" />
      </mesh>
      {/* side walls, low so the camera can see in */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * w) / 2, 0.6, 0]} receiveShadow>
          <boxGeometry args={[0.1, 1.2, d]} />
          <meshStandardMaterial color="#f4f6f9" />
        </mesh>
      ))}
      {/* teacher's desk */}
      <group position={[-2.6, 0, -d / 2 + 1.4]}>
        <mesh position={[0, 0.74, 0]} castShadow>
          <boxGeometry args={[1.8, 0.05, 0.8]} />
          <meshStandardMaterial color="#9c7f5c" />
        </mesh>
        <mesh position={[0, 0.37, 0]} castShadow>
          <boxGeometry args={[1.7, 0.72, 0.7]} />
          <meshStandardMaterial color="#86694a" />
        </mesh>
        <mesh position={[0, 1.08, 0.1]} rotation-y={Math.PI}>
          <boxGeometry args={[0.6, 0.38, 0.04]} />
          <meshStandardMaterial color="#1a212c" />
        </mesh>
      </group>
    </group>
  );
}

export default function LabScene({ lab, pcs, selectedId, onSelect }: SceneProps) {
  const w = lab.cols * DX + AISLE + 2.4;
  const d = lab.rows * DZ + 4.5;
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [0, w * 0.62, d / 2 + w * 0.5], fov: 45 }} onPointerMissed={() => onSelect('')}>
      <color attach="background" args={['#dfe5ee']} />
      <hemisphereLight args={['#ffffff', '#b8c2d0', 0.9]} />
      <directionalLight position={[5, 10, 6]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      {/* Bounds frames the room for whatever aspect the canvas has (phone or desktop). */}
      <Bounds fit margin={0.95}>
        <Room w={w} d={d} />
      </Bounds>
      {pcs.map((pc) => (
        <Workstation key={pc.id} pc={pc} pos={deskPos(pc, lab.cols, lab.rows)} selected={pc.id === selectedId}
          onSelect={() => onSelect(pc.id)} />
      ))}
      <ContactShadows position={[0, 0.003, 0]} scale={Math.max(w, d)} opacity={0.25} blur={2.5} far={2} />
      <OrbitControls makeDefault maxPolarAngle={1.35} minDistance={4} maxDistance={40} enableDamping />
    </Canvas>
  );
}
