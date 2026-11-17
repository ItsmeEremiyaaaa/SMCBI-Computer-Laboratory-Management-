import { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import { LAYOUTS } from '../lib/layouts';
import type { Lab } from '../lib/types';
import type { LivePc } from '../hooks/useLabLive';

export type SimMode = 'walk_in' | 'in_session' | 'walk_out' | 'empty';

export function isFemaleTeacher(name?: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  if (
    n.includes('ms.') ||
    n.includes('mrs.') ||
    n.includes('miss') ||
    n.includes('sister') ||
    n.includes('sr.') ||
    n.includes('s.')
  ) return true;
  if (
    n.includes('kaye') ||
    n.includes('maria') ||
    n.includes('mariae') ||
    n.includes('april') ||
    n.includes('carla') ||
    n.includes('ella') ||
    n.includes('grace') ||
    n.includes('mary')
  ) return true;
  return false;
}

interface LabCharacters3DProps {
  lab: Lab;
  pcs: LivePc[];
  w: number;
  d: number;
  style: 'island' | 'table';
  simMode: SimMode;
  teacherName?: string | null;
  onSimulationComplete?: () => void;
}

interface Waypoint {
  x: number;
  z: number;
}

interface StudentAgentData {
  id: string;
  pcId: string;
  isMale: boolean;
  hash: number;
  chairPos: [number, number, number];
  pcPos: [number, number, number];
  targetRotY: number;
  waypoints: Waypoint[];
  totalWalkDist: number;
  enterDelay: number;
  exitDelay: number;
  walkSpeed: number;
}

// SMCBI Lab Spacing
const ISLAND_GAP = 3.6;
const ISLAND_ROW = 1.2;
const islandCount = (lab: Lab) => Math.ceil(lab.cols / 4);
const islandX = (i: number, n: number) => (i - (n - 1) / 2) * ISLAND_GAP;
const sideRows = (lab: Lab) => LAYOUTS[lab.id]?.island?.endRow ?? lab.rows;
const sideZ = (row: number, lab: Lab) => (row - (sideRows(lab) - 1) / 2) * ISLAND_ROW - 0.4;
const DX = 1.15;
const DZ = 1.9;
const seatX = (col: number, cols: number) => (col - (cols - 1) / 2) * DX;
const rowZ = (row: number, rows: number) => (row - (rows - 1) / 2) * DZ + 1.2;

function getWorkstationPlacement(pc: LivePc, lab: Lab, style: 'island' | 'table'): { pos: [number, number, number]; rot: number } {
  if (style !== 'island') return { pos: [seatX(pc.col, lab.cols), 0, rowZ(pc.row, lab.rows)], rot: 0 };
  const cx = islandX(Math.floor(pc.col / 4), islandCount(lab));
  const left = pc.col % 4 === 0;
  if (pc.row !== LAYOUTS[lab.id]?.island?.endRow) {
    return { pos: [cx + (left ? -0.55 : 0.55), 0, sideZ(pc.row, lab)], rot: left ? -Math.PI / 2 : Math.PI / 2 };
  }
  return { pos: [cx + (left ? -0.58 : 0.58), 0, sideZ(sideRows(lab) - 1, lab) + ISLAND_ROW / 2 + 0.65], rot: 0 };
}

// 3D Low-Poly Teacher at the whiteboard
export function Teacher3D({ gender }: { gender: 'male' | 'female' }) {
  const isMale = gender === 'male';
  const skinMat = <meshStandardMaterial color="#f0c29e" roughness={0.6} />;
  const hairMat = <meshStandardMaterial color="#2b1d14" roughness={0.7} />;
  const pantsMat = <meshStandardMaterial color="#1e293b" roughness={0.6} />;
  const whiteMat = <meshStandardMaterial color="#f8fafc" roughness={0.4} />;
  const brownVestMat = <meshStandardMaterial color="#78350f" roughness={0.5} />;
  const navyBlazerMat = <meshStandardMaterial color="#1e3a8a" roughness={0.5} />;
  const skirtMat = <meshStandardMaterial color="#475569" roughness={0.6} />;
  const shoesMat = <meshStandardMaterial color="#0f172a" roughness={0.4} />;
  const glassesMat = <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.8} />;

  return (
    <group>
      {/* Legs */}
      {isMale ? (
        [-0.10, 0.10].map((lx) => (
          <group key={lx} position={[lx, 0, 0]}>
            <mesh position={[0, 0.44, 0]} castShadow>
              <boxGeometry args={[0.13, 0.84, 0.13]} />
              {pantsMat}
            </mesh>
            <mesh position={[0, 0.04, 0.04]} castShadow>
              <boxGeometry args={[0.13, 0.08, 0.22]} />
              {shoesMat}
            </mesh>
          </group>
        ))
      ) : (
        <>
          <mesh position={[0, 0.62, 0]} castShadow>
            <boxGeometry args={[0.34, 0.42, 0.22]} />
            {skirtMat}
          </mesh>
          {[-0.09, 0.09].map((lx) => (
            <group key={lx} position={[lx, 0, 0]}>
              <mesh position={[0, 0.24, 0]} castShadow>
                <boxGeometry args={[0.09, 0.44, 0.09]} />
                {skinMat}
              </mesh>
              <mesh position={[0, 0.04, 0.03]} castShadow>
                <boxGeometry args={[0.10, 0.07, 0.18]} />
                {shoesMat}
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* Torso */}
      <group position={[0, 1.10, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.46, 0.22]} />
          {isMale ? brownVestMat : navyBlazerMat}
        </mesh>
        {isMale ? (
          <>
            <mesh position={[0, 0.12, 0.113]}>
              <boxGeometry args={[0.12, 0.18, 0.01]} />
              {whiteMat}
            </mesh>
            <mesh position={[0, 0.08, 0.116]}>
              <boxGeometry args={[0.04, 0.22, 0.01]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          </>
        ) : (
          <mesh position={[0, 0.10, 0.113]}>
            <boxGeometry args={[0.12, 0.16, 0.01]} />
            {whiteMat}
          </mesh>
        )}
      </group>

      {/* Arms */}
      <mesh position={[-0.22, 1.05, 0]} castShadow>
        <boxGeometry args={[0.09, 0.44, 0.09]} />
        {isMale ? whiteMat : navyBlazerMat}
      </mesh>
      {/* Right arm gesturing toward classroom */}
      <group position={[0.22, 1.25, 0]} rotation-z={-0.6} rotation-y={0.3}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <boxGeometry args={[0.09, 0.38, 0.09]} />
          {isMale ? whiteMat : navyBlazerMat}
        </mesh>
        <mesh position={[0, -0.40, 0]}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          {skinMat}
        </mesh>
      </group>

      {/* Head */}
      <group position={[0, 1.48, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.21, 0.24, 0.20]} />
          {skinMat}
        </mesh>
        <mesh position={[0, 0.07, 0]} castShadow>
          <boxGeometry args={[0.23, 0.14, 0.22]} />
          {hairMat}
        </mesh>
        {!isMale && (
          <mesh position={[0, 0.06, -0.14]} castShadow>
            <sphereGeometry args={[0.07, 8, 8]} />
            {hairMat}
          </mesh>
        )}
        <mesh position={[0, 0.01, 0.11]}>
          <boxGeometry args={[0.18, 0.04, 0.02]} />
          {glassesMat}
        </mesh>
      </group>
    </group>
  );
}

// Procedural 3D Low-Poly Animated Student Character
function StudentAgent3D({
  agent,
  simMode,
  elapsedTime,
}: {
  agent: StudentAgentData;
  simMode: SimMode;
  elapsedTime: number;
}) {
  const rootRef = useRef<Group>(null);
  const leftHipRef = useRef<Group>(null);
  const rightHipRef = useRef<Group>(null);
  const leftKneeRef = useRef<Group>(null);
  const rightKneeRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftElbowRef = useRef<Group>(null);
  const rightElbowRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const bodyRootRef = useRef<Group>(null);

  const { isMale, hash } = agent;

  // Materials matching SMCBI uniforms
  const skinMat = <meshStandardMaterial color="#f0c29e" roughness={0.6} />;
  const hairMat = <meshStandardMaterial color={hash % 3 === 0 ? '#1c140e' : hash % 3 === 1 ? '#261a12' : '#2d1e16'} roughness={0.7} />;
  const maleShirtMat = <meshStandardMaterial color="#4f8ee6" roughness={0.5} />;
  const malePantsMat = <meshStandardMaterial color="#1e293b" roughness={0.6} />;
  const femaleBlouseMat = <meshStandardMaterial color="#f8fafc" roughness={0.4} />;
  const femaleNavyMat = <meshStandardMaterial color="#1e3a8a" roughness={0.5} />;
  const socksMat = <meshStandardMaterial color="#f1f5f9" roughness={0.5} />;
  const shoesMat = <meshStandardMaterial color="#0f172a" roughness={0.4} />;

  useFrame(({ clock }) => {
    const root = rootRef.current;
    const bodyRoot = bodyRootRef.current;
    const leftHip = leftHipRef.current;
    const rightHip = rightHipRef.current;
    const leftKnee = leftKneeRef.current;
    const rightKnee = rightKneeRef.current;
    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    const leftElbow = leftElbowRef.current;
    const rightElbow = rightElbowRef.current;
    const head = headRef.current;

    if (!root || !bodyRoot || !leftHip || !rightHip || !leftKnee || !rightKnee || !leftArm || !rightArm || !leftElbow || !rightElbow || !head) return;

    if (simMode === 'empty') {
      root.visible = false;
      return;
    }

    if (simMode === 'in_session') {
      root.visible = true;
      root.position.set(agent.chairPos[0], 0, agent.chairPos[2]);
      root.rotation.y = agent.targetRotY;

      // Seated pose: hips dropped to chair height
      bodyRoot.position.y = -0.34;

      // Thighs horizontal on chair
      leftHip.rotation.x = -Math.PI / 2;
      rightHip.rotation.x = -Math.PI / 2;
      // Calves hanging vertically to floor
      leftKnee.rotation.x = Math.PI / 2;
      rightKnee.rotation.x = Math.PI / 2;

      // Arms resting on desk / typing at keyboard
      const typeSpeed = 5 + (hash % 3);
      const leftTap = Math.sin(clock.elapsedTime * typeSpeed + hash) * 0.03;
      const rightTap = Math.sin(clock.elapsedTime * (typeSpeed + 1) + hash * 2) * 0.03;

      leftArm.rotation.x = -0.58;
      leftElbow.rotation.x = -0.72 + leftTap;
      rightArm.rotation.x = -0.58;
      rightElbow.rotation.x = -0.72 + rightTap;

      // Head looking forward directly at monitor
      head.rotation.x = 0.10 + Math.sin(clock.elapsedTime * 1.2 + hash) * 0.02;
      head.rotation.y = Math.sin(clock.elapsedTime * 0.7 + hash) * 0.03;
      return;
    }

    if (simMode === 'walk_in') {
      const t = elapsedTime - agent.enterDelay;
      if (t < 0) {
        root.visible = false;
        return;
      }
      root.visible = true;

      const walkDuration = agent.totalWalkDist / agent.walkSpeed;
      const sitDuration = 0.9;

      if (t < walkDuration) {
        // WALKING PHASE: calm, natural pace along open aisle
        const covered = t * agent.walkSpeed;
        const pts = agent.waypoints;

        let acc = 0;
        let seg = 0;
        let segDist = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
          if (acc + d >= covered) {
            seg = i;
            segDist = d;
            break;
          }
          acc += d;
          if (i === pts.length - 2) {
            seg = i;
            segDist = d;
          }
        }

        const segProgress = segDist > 0.001 ? Math.min(1, Math.max(0, (covered - acc) / segDist)) : 1;
        const p0 = pts[seg];
        const p1 = pts[seg + 1] ?? p0;
        const curX = p0.x + (p1.x - p0.x) * segProgress;
        const curZ = p0.z + (p1.z - p0.z) * segProgress;
        root.position.set(curX, 0, curZ);

        const dx = p1.x - p0.x;
        const dz = p1.z - p0.z;
        if (Math.hypot(dx, dz) > 0.01) {
          const targetHeading = Math.atan2(dx, dz);
          // Smooth rotation when turning corners
          root.rotation.y = MathUtils.lerp(root.rotation.y, targetHeading, 0.2);
        }

        // Natural, gentle low-poly walking cycle (simple & calm, not running)
        const walkPhase = t * 4.4;
        const legSwing = Math.sin(walkPhase) * 0.38;
        const armSwing = Math.sin(walkPhase) * 0.28;

        bodyRoot.position.y = Math.abs(Math.sin(walkPhase * 2)) * 0.02;

        leftHip.rotation.x = legSwing;
        rightHip.rotation.x = -legSwing;
        leftKnee.rotation.x = Math.max(0, -legSwing * 0.35);
        rightKnee.rotation.x = Math.max(0, legSwing * 0.35);

        leftArm.rotation.x = -armSwing;
        rightArm.rotation.x = armSwing;
        leftElbow.rotation.x = -0.22;
        rightElbow.rotation.x = -0.22;

        head.rotation.x = 0.02;
        head.rotation.y = 0;
        return;
      }

      // SITTING DOWN TRANSITION: Arrived at chair, turn to monitor and sit
      const sitProgress = Math.min(1, (t - walkDuration) / sitDuration);
      root.position.set(agent.chairPos[0], 0, agent.chairPos[2]);

      // Rotate smoothly to face the monitor
      root.rotation.y = MathUtils.lerp(root.rotation.y, agent.targetRotY, sitProgress);

      // Smoothly lower hips from standing (0) to chair height (-0.34)
      bodyRoot.position.y = MathUtils.lerp(0, -0.34, sitProgress);

      // Thighs bend forward 90 degrees
      const thighAngle = MathUtils.lerp(0, -Math.PI / 2, sitProgress);
      leftHip.rotation.x = thighAngle;
      rightHip.rotation.x = thighAngle;

      // Knees bend 90 degrees so calves stay vertical to floor
      const kneeAngle = MathUtils.lerp(0, Math.PI / 2, sitProgress);
      leftKnee.rotation.x = kneeAngle;
      rightKnee.rotation.x = kneeAngle;

      // Arms swing up from sides onto keyboard
      leftArm.rotation.x = MathUtils.lerp(0, -0.58, sitProgress);
      rightArm.rotation.x = MathUtils.lerp(0, -0.58, sitProgress);
      leftElbow.rotation.x = MathUtils.lerp(-0.22, -0.72, sitProgress);
      rightElbow.rotation.x = MathUtils.lerp(-0.22, -0.72, sitProgress);

      head.rotation.x = MathUtils.lerp(0.02, 0.10, sitProgress);
      return;
    }

    if (simMode === 'walk_out') {
      const t = elapsedTime - agent.exitDelay;
      if (t < 0) {
        // Still seated
        root.visible = true;
        root.position.set(agent.chairPos[0], 0, agent.chairPos[2]);
        root.rotation.y = agent.targetRotY;
        bodyRoot.position.y = -0.34;
        leftHip.rotation.x = -Math.PI / 2;
        rightHip.rotation.x = -Math.PI / 2;
        leftKnee.rotation.x = Math.PI / 2;
        rightKnee.rotation.x = Math.PI / 2;
        leftArm.rotation.x = -0.58;
        rightArm.rotation.x = -0.58;
        return;
      }

      const standDuration = 0.8;
      const revPts = [...agent.waypoints].reverse();
      const walkDuration = agent.totalWalkDist / agent.walkSpeed;

      if (t < standDuration) {
        // STANDING UP PHASE
        root.visible = true;
        const standProgress = t / standDuration;
        root.position.set(agent.chairPos[0], 0, agent.chairPos[2]);

        const firstRev = revPts[1] ?? revPts[0];
        const exitAngle = Math.atan2(firstRev.x - revPts[0].x, firstRev.z - revPts[0].z);
        root.rotation.y = MathUtils.lerp(agent.targetRotY, exitAngle, standProgress);

        bodyRoot.position.y = MathUtils.lerp(-0.34, 0, standProgress);
        leftHip.rotation.x = MathUtils.lerp(-Math.PI / 2, 0, standProgress);
        rightHip.rotation.x = MathUtils.lerp(-Math.PI / 2, 0, standProgress);
        leftKnee.rotation.x = MathUtils.lerp(Math.PI / 2, 0, standProgress);
        rightKnee.rotation.x = MathUtils.lerp(Math.PI / 2, 0, standProgress);
        leftArm.rotation.x = MathUtils.lerp(-0.58, 0, standProgress);
        rightArm.rotation.x = MathUtils.lerp(-0.58, 0, standProgress);
        return;
      }

      const walkT = t - standDuration;
      if (walkT >= walkDuration) {
        // Exited through door
        root.visible = false;
        return;
      }

      root.visible = true;
      const covered = walkT * agent.walkSpeed;

      let acc = 0;
      let seg = 0;
      let segDist = 0;
      for (let i = 0; i < revPts.length - 1; i++) {
        const d = Math.hypot(revPts[i + 1].x - revPts[i].x, revPts[i + 1].z - revPts[i].z);
        if (acc + d >= covered) {
          seg = i;
          segDist = d;
          break;
        }
        acc += d;
        if (i === revPts.length - 2) {
          seg = i;
          segDist = d;
        }
      }

      const segProgress = segDist > 0.001 ? Math.min(1, Math.max(0, (covered - acc) / segDist)) : 1;
      const p0 = revPts[seg];
      const p1 = revPts[seg + 1] ?? p0;
      const curX = p0.x + (p1.x - p0.x) * segProgress;
      const curZ = p0.z + (p1.z - p0.z) * segProgress;
      root.position.set(curX, 0, curZ);

      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      if (Math.hypot(dx, dz) > 0.01) {
        const targetHeading = Math.atan2(dx, dz);
        root.rotation.y = MathUtils.lerp(root.rotation.y, targetHeading, 0.2);
      }

      const walkPhase = walkT * 4.4;
      const legSwing = Math.sin(walkPhase) * 0.38;
      const armSwing = Math.sin(walkPhase) * 0.28;

      bodyRoot.position.y = Math.abs(Math.sin(walkPhase * 2)) * 0.02;
      leftHip.rotation.x = legSwing;
      rightHip.rotation.x = -legSwing;
      leftKnee.rotation.x = Math.max(0, -legSwing * 0.35);
      rightKnee.rotation.x = Math.max(0, legSwing * 0.35);
      leftArm.rotation.x = -armSwing;
      rightArm.rotation.x = armSwing;
      leftElbow.rotation.x = -0.22;
      rightElbow.rotation.x = -0.22;
      head.rotation.x = 0.02;
      head.rotation.y = 0;
    }
  });

  return (
    <group ref={rootRef} position={agent.chairPos}>
      {/* Articulated Body Hierarchy */}
      <group ref={bodyRootRef}>
        {/* Pelvis / Hips */}
        <mesh position={[0, 0.78, 0]} castShadow>
          <boxGeometry args={[0.34, 0.14, 0.22]} />
          {isMale ? malePantsMat : femaleNavyMat}
        </mesh>

        {/* Female Navy Skirt */}
        {!isMale && (
          <mesh position={[0, 0.68, 0]} castShadow>
            <boxGeometry args={[0.36, 0.26, 0.26]} />
            {femaleNavyMat}
          </mesh>
        )}

        {/* Left Leg (Thigh + Knee + Calf + Shoe) */}
        <group ref={leftHipRef} position={[-0.09, 0.78, 0]}>
          <mesh position={[0, -0.20, 0]} castShadow>
            <boxGeometry args={[0.13, 0.40, 0.13]} />
            {isMale ? malePantsMat : skinMat}
          </mesh>
          <group ref={leftKneeRef} position={[0, -0.40, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow>
              <boxGeometry args={[0.11, 0.36, 0.11]} />
              {isMale ? malePantsMat : socksMat}
            </mesh>
            <mesh position={[0, -0.34, 0.04]} castShadow>
              <boxGeometry args={[0.12, 0.08, 0.20]} />
              {shoesMat}
            </mesh>
          </group>
        </group>

        {/* Right Leg (Thigh + Knee + Calf + Shoe) */}
        <group ref={rightHipRef} position={[0.09, 0.78, 0]}>
          <mesh position={[0, -0.20, 0]} castShadow>
            <boxGeometry args={[0.13, 0.40, 0.13]} />
            {isMale ? malePantsMat : skinMat}
          </mesh>
          <group ref={rightKneeRef} position={[0, -0.40, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow>
              <boxGeometry args={[0.11, 0.36, 0.11]} />
              {isMale ? malePantsMat : socksMat}
            </mesh>
            <mesh position={[0, -0.34, 0.04]} castShadow>
              <boxGeometry args={[0.12, 0.08, 0.20]} />
              {shoesMat}
            </mesh>
          </group>
        </group>

        {/* Torso */}
        <group position={[0, 1.05, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.38, 0.20]} />
            {isMale ? maleShirtMat : femaleBlouseMat}
          </mesh>

          {/* Female Sailor Collar & Tie */}
          {!isMale && (
            <>
              <mesh position={[0, 0.13, 0.106]}>
                <boxGeometry args={[0.22, 0.12, 0.015]} />
                {femaleNavyMat}
              </mesh>
              <mesh position={[0, 0.03, 0.108]}>
                <boxGeometry args={[0.04, 0.16, 0.015]} />
                {femaleNavyMat}
              </mesh>
            </>
          )}

          {/* Male Polo Collar */}
          {isMale && (
            <mesh position={[0, 0.15, 0.104]}>
              <boxGeometry args={[0.16, 0.08, 0.015]} />
              <meshStandardMaterial color="#2563eb" roughness={0.4} />
            </mesh>
          )}
        </group>

        {/* Left Arm (Shoulder + Elbow + Forearm + Hand) */}
        <group ref={leftArmRef} position={[-0.20, 1.20, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <boxGeometry args={[0.09, 0.24, 0.09]} />
            {isMale ? maleShirtMat : femaleBlouseMat}
          </mesh>
          <group ref={leftElbowRef} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.12, 0]} castShadow>
              <boxGeometry args={[0.08, 0.22, 0.08]} />
              {skinMat}
            </mesh>
            <mesh position={[0, -0.24, 0]} castShadow>
              <boxGeometry args={[0.08, 0.06, 0.08]} />
              {skinMat}
            </mesh>
          </group>
        </group>

        {/* Right Arm (Shoulder + Elbow + Forearm + Hand) */}
        <group ref={rightArmRef} position={[0.20, 1.20, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow>
            <boxGeometry args={[0.09, 0.24, 0.09]} />
            {isMale ? maleShirtMat : femaleBlouseMat}
          </mesh>
          <group ref={rightElbowRef} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.12, 0]} castShadow>
              <boxGeometry args={[0.08, 0.22, 0.08]} />
              {skinMat}
            </mesh>
            <mesh position={[0, -0.24, 0]} castShadow>
              <boxGeometry args={[0.08, 0.06, 0.08]} />
              {skinMat}
            </mesh>
          </group>
        </group>

        {/* Neck & Head */}
        <group ref={headRef} position={[0, 1.38, 0]}>
          {/* Neck */}
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.08, 8]} />
            {skinMat}
          </mesh>
          {/* Face */}
          <mesh castShadow>
            <boxGeometry args={[0.20, 0.22, 0.19]} />
            {skinMat}
          </mesh>
          {/* Hair top */}
          <mesh position={[0, 0.07, 0.01]} castShadow>
            <boxGeometry args={[0.22, 0.14, 0.21]} />
            {hairMat}
          </mesh>
          {/* Hair back */}
          <mesh position={[0, -0.02, -0.08]} castShadow>
            <boxGeometry args={[0.21, 0.18, 0.08]} />
            {hairMat}
          </mesh>
          {/* Female long hair */}
          {!isMale && (
            <mesh position={[0, -0.14, -0.08]} castShadow>
              <boxGeometry args={[0.23, 0.20, 0.08]} />
              {hairMat}
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

// Master Simulation Component for all 3D Low-Poly Characters
export default function LabCharacters3D({
  lab,
  pcs,
  w,
  d,
  style,
  simMode,
  teacherName,
  onSimulationComplete,
}: LabCharacters3DProps) {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startTimeRef.current = null;
    setElapsed(0);
  }, [simMode, lab.id]);

  const front = -d / 2;
  const bayCount = Math.max(4, Math.floor(d / 2.0));
  const bayLength = d / bayCount;
  const exitDoorZ = front + bayLength * 0.5;

  // Door is on the left wall
  const doorPoint: Waypoint = { x: -w / 2 + 0.90, z: exitDoorZ };
  // Front corridor in front of all desk islands
  const frontHallZ = front + 2.3;

  // Precompute waypoint routes and student agent data
  const workingPcs = useMemo(() => pcs.filter((p) => p.shown !== 'broken'), [pcs]);

  const agents = useMemo<StudentAgentData[]>(() => {
    return workingPcs.map((pc, idx) => {
      let h = 0;
      for (let i = 0; i < pc.id.length; i++) h = (h * 31 + pc.id.charCodeAt(i)) >>> 0;
      const isMale = h % 2 === 0;

      const { pos: pcPos, rot: pcRot } = getWorkstationPlacement(pc, lab, style);

      // Monobloc chair is at [0, 0, 0.62] in local workstation coordinates
      const chairX = pcPos[0] + Math.sin(pcRot) * 0.62;
      const chairZ = pcPos[2] + Math.cos(pcRot) * 0.62;

      // Mathematically exact angle to look directly at the PC monitor
      const toMonitorX = pcPos[0] - chairX;
      const toMonitorZ = pcPos[2] - chairZ;
      const targetRotY = Math.atan2(toMonitorX, toMonitorZ);

      // Determine dedicated collision-free aisle corridor for this student
      let aisleX = chairX;
      if (style === 'island') {
        const nIslands = islandCount(lab);
        const iIsland = Math.floor(pc.col / 4);
        const cx = islandX(iIsland, nIslands);

        if (pc.row !== LAYOUTS[lab.id]?.island?.endRow) {
          if (pc.col % 4 === 0) {
            // Left column of this island: walks down the corridor to the left of the seats
            aisleX = cx - 1.80;
          } else {
            // Right column of this island: walks down the corridor to the right of the seats
            aisleX = cx + 1.80;
          }
        } else {
          // End seat across the back end of the spine
          aisleX = chairX;
        }
      } else {
        // Table lab (NetLab): 3 table blocks
        // Walk down open corridors between table blocks
        if (pc.col <= 2) {
          aisleX = -2.10;
        } else if (pc.col <= 6) {
          aisleX = pc.col <= 4 ? -2.10 : 2.10;
        } else {
          aisleX = 2.10;
        }
      }

      // Waypoints: Door -> Front hallway -> Turn into dedicated aisle corridor -> Walk down open aisle -> Step into chair
      const waypoints: Waypoint[] = [
        { ...doorPoint },
        { x: doorPoint.x, z: frontHallZ },
        { x: aisleX, z: frontHallZ },
        { x: aisleX, z: chairZ },
        { x: chairX, z: chairZ },
      ];

      // Remove redundant waypoints if adjacent are identical
      const cleaned: Waypoint[] = [waypoints[0]];
      for (let i = 1; i < waypoints.length; i++) {
        const prev = cleaned[cleaned.length - 1];
        const cur = waypoints[i];
        if (Math.hypot(cur.x - prev.x, cur.z - prev.z) > 0.05) {
          cleaned.push(cur);
        }
      }

      // Calculate total walking distance
      let totalWalkDist = 0;
      for (let i = 0; i < cleaned.length - 1; i++) {
        totalWalkDist += Math.hypot(cleaned[i + 1].x - cleaned[i].x, cleaned[i + 1].z - cleaned[i].z);
      }

      // Staggered entry: arrive naturally 1 by 1 or 2 by 2 through the door (no huge crowd)
      const pairIdx = Math.floor(idx / 2);
      const isSecondInPair = idx % 2 === 1;
      const enterDelay = 0.3 + pairIdx * 1.7 + (isSecondInPair ? 0.38 : 0);

      const revIdx = workingPcs.length - 1 - idx;
      const exitPairIdx = Math.floor(revIdx / 2);
      const isSecondExit = revIdx % 2 === 1;
      const exitDelay = 0.3 + exitPairIdx * 1.5 + (isSecondExit ? 0.35 : 0);
      const walkSpeed = 1.05 + ((h % 5) - 2) * 0.04; // Calm, steady indoor pace (1.01 to 1.09 m/s)

      return {
        id: pc.id,
        pcId: pc.id,
        isMale,
        hash: h,
        chairPos: [chairX, 0, chairZ],
        pcPos,
        targetRotY,
        waypoints: cleaned,
        totalWalkDist,
        enterDelay,
        exitDelay,
        walkSpeed,
      };
    });
  }, [workingPcs, lab, style, doorPoint.x, doorPoint.z, frontHallZ]);

  // Max simulation time calculation
  const maxEnterTime = useMemo(() => {
    return Math.max(
      ...agents.map((a) => a.enterDelay + a.totalWalkDist / a.walkSpeed + 1.0),
      4
    );
  }, [agents]);

  useFrame(({ clock }) => {
    if (simMode === 'in_session' || simMode === 'empty') return;

    if (startTimeRef.current === null) {
      startTimeRef.current = clock.elapsedTime;
    }
    const curElapsed = clock.elapsedTime - startTimeRef.current;
    setElapsed(curElapsed);

    if (curElapsed >= maxEnterTime + 0.5 && onSimulationComplete) {
      onSimulationComplete();
    }
  });

  const showTeacher = simMode !== 'empty';

  return (
    <group>
      {/* Exactly 1 Teacher per comlab matching schedule (Mr. or Ms.) */}
      {showTeacher && (
        <group position={[0, 0, front + 1.45]}>
          <Teacher3D gender={isFemaleTeacher(teacherName) ? 'female' : 'male'} />
        </group>
      )}

      {/* 3D Animated Student Agents */}
      {agents.map((agent) => (
        <StudentAgent3D
          key={agent.id}
          agent={agent}
          simMode={simMode}
          elapsedTime={elapsed}
        />
      ))}
    </group>
  );
}
