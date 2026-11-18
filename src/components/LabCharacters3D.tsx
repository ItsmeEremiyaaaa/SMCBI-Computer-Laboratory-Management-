import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import { LAYOUTS, seatPlacement } from '../lib/layouts';
import type { Lab, Student } from '../lib/types';
import type { LivePc } from '../hooks/useLabLive';
import { box, cyl } from './labGeometry';

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
  /** Seconds already elapsed in the current walk_in / walk_out window (realtime sync). */
  phaseOffset?: number;
  /** Length of the current walk_in / walk_out window in seconds; arrivals are spread across it. */
  phaseLength?: number;
  /** Enrolled students of the class, one per seat; avatars become clickable when given. */
  students?: Student[];
  onStudentSelect?: (s: Student, pcId: string) => void;
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
  student?: Student;
}

// SMCBI Lab Spacing
const ISLAND_GAP = 3.6;
const islandCount = (lab: Lab) => Math.ceil(lab.cols / 4);
const islandX = (i: number, n: number) => (i - (n - 1) / 2) * ISLAND_GAP;

function getWorkstationPlacement(pc: LivePc, lab: Lab, _style?: 'island' | 'table'): { pos: [number, number, number]; rot: number } {
  return seatPlacement(lab, pc.row, pc.col);
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
            <mesh position={[0, 0.44, 0]}>
              <primitive object={box(0.13, 0.84, 0.13)} attach="geometry" />
              {pantsMat}
            </mesh>
            <mesh position={[0, 0.04, 0.04]}>
              <primitive object={box(0.13, 0.08, 0.22)} attach="geometry" />
              {shoesMat}
            </mesh>
          </group>
        ))
      ) : (
        <>
          <mesh position={[0, 0.62, 0]}>
            <primitive object={box(0.34, 0.42, 0.22)} attach="geometry" />
            {skirtMat}
          </mesh>
          {[-0.09, 0.09].map((lx) => (
            <group key={lx} position={[lx, 0, 0]}>
              <mesh position={[0, 0.24, 0]}>
                <primitive object={box(0.09, 0.44, 0.09)} attach="geometry" />
                {skinMat}
              </mesh>
              <mesh position={[0, 0.04, 0.03]}>
                <primitive object={box(0.10, 0.07, 0.18)} attach="geometry" />
                {shoesMat}
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* Torso */}
      <group position={[0, 1.10, 0]}>
        <mesh>
          <primitive object={box(0.36, 0.46, 0.22)} attach="geometry" />
          {isMale ? brownVestMat : navyBlazerMat}
        </mesh>
        {isMale ? (
          <>
            <mesh position={[0, 0.12, 0.113]}>
              <primitive object={box(0.12, 0.18, 0.01)} attach="geometry" />
              {whiteMat}
            </mesh>
            <mesh position={[0, 0.08, 0.116]}>
              <primitive object={box(0.04, 0.22, 0.01)} attach="geometry" />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          </>
        ) : (
          <mesh position={[0, 0.10, 0.113]}>
            <primitive object={box(0.12, 0.16, 0.01)} attach="geometry" />
            {whiteMat}
          </mesh>
        )}
      </group>

      {/* Arms */}
      <mesh position={[-0.22, 1.05, 0]}>
        <primitive object={box(0.09, 0.44, 0.09)} attach="geometry" />
        {isMale ? whiteMat : navyBlazerMat}
      </mesh>
      {/* Right arm gesturing toward classroom */}
      <group position={[0.22, 1.25, 0]} rotation-z={-0.6} rotation-y={0.3}>
        <mesh position={[0, -0.18, 0]}>
          <primitive object={box(0.09, 0.38, 0.09)} attach="geometry" />
          {isMale ? whiteMat : navyBlazerMat}
        </mesh>
        <mesh position={[0, -0.40, 0]}>
          <primitive object={box(0.08, 0.08, 0.08)} attach="geometry" />
          {skinMat}
        </mesh>
      </group>

      {/* Head */}
      <group position={[0, 1.48, 0]}>
        <mesh>
          <primitive object={box(0.21, 0.24, 0.20)} attach="geometry" />
          {skinMat}
        </mesh>
        <mesh position={[0, 0.07, 0]}>
          <primitive object={box(0.23, 0.14, 0.22)} attach="geometry" />
          {hairMat}
        </mesh>
        {!isMale && (
          <mesh position={[0, 0.06, -0.14]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            {hairMat}
          </mesh>
        )}
        <mesh position={[0, 0.01, 0.11]}>
          <primitive object={box(0.18, 0.04, 0.02)} attach="geometry" />
          {glassesMat}
        </mesh>
      </group>
    </group>
  );
}

// Helper to smoothly interpolate angles avoiding 360-degree wrap-around spins
function lerpAngle(a: number, b: number, t: number) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

// Procedural 3D Low-Poly Animated Student Character
function StudentAgent3D({
  agent,
  simMode,
  elapsedRef,
  onSelect,
}: {
  agent: StudentAgentData;
  simMode: SimMode;
  elapsedRef: { current: number };
  onSelect?: () => void;
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
      const t = elapsedRef.current - agent.enterDelay;
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
          root.rotation.y = lerpAngle(root.rotation.y, targetHeading, 0.2);
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
      root.rotation.y = lerpAngle(root.rotation.y, agent.targetRotY, sitProgress);

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
      const t = elapsedRef.current - agent.exitDelay;
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
        root.rotation.y = lerpAngle(agent.targetRotY, exitAngle, standProgress);

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
        root.rotation.y = lerpAngle(root.rotation.y, targetHeading, 0.2);
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
    <group ref={rootRef} position={agent.chairPos}
      onClick={onSelect && ((e) => { e.stopPropagation(); onSelect(); })}
      onPointerOver={onSelect && ((e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; })}
      onPointerOut={onSelect && (() => { document.body.style.cursor = ''; })}>
      {/* Articulated Body Hierarchy */}
      <group ref={bodyRootRef}>
        {/* Pelvis / Hips */}
        <mesh position={[0, 0.78, 0]}>
          <primitive object={box(0.34, 0.14, 0.22)} attach="geometry" />
          {isMale ? malePantsMat : femaleNavyMat}
        </mesh>

        {/* Female Navy Skirt */}
        {!isMale && (
          <mesh position={[0, 0.68, 0]}>
            <primitive object={box(0.36, 0.26, 0.26)} attach="geometry" />
            {femaleNavyMat}
          </mesh>
        )}

        {/* Left Leg (Thigh + Knee + Calf + Shoe) */}
        <group ref={leftHipRef} position={[-0.09, 0.78, 0]}>
          <mesh position={[0, -0.20, 0]}>
            <primitive object={box(0.13, 0.40, 0.13)} attach="geometry" />
            {isMale ? malePantsMat : skinMat}
          </mesh>
          <group ref={leftKneeRef} position={[0, -0.40, 0]}>
            <mesh position={[0, -0.18, 0]}>
              <primitive object={box(0.11, 0.36, 0.11)} attach="geometry" />
              {isMale ? malePantsMat : socksMat}
            </mesh>
            <mesh position={[0, -0.34, 0.04]}>
              <primitive object={box(0.12, 0.08, 0.20)} attach="geometry" />
              {shoesMat}
            </mesh>
          </group>
        </group>

        {/* Right Leg (Thigh + Knee + Calf + Shoe) */}
        <group ref={rightHipRef} position={[0.09, 0.78, 0]}>
          <mesh position={[0, -0.20, 0]}>
            <primitive object={box(0.13, 0.40, 0.13)} attach="geometry" />
            {isMale ? malePantsMat : skinMat}
          </mesh>
          <group ref={rightKneeRef} position={[0, -0.40, 0]}>
            <mesh position={[0, -0.18, 0]}>
              <primitive object={box(0.11, 0.36, 0.11)} attach="geometry" />
              {isMale ? malePantsMat : socksMat}
            </mesh>
            <mesh position={[0, -0.34, 0.04]}>
              <primitive object={box(0.12, 0.08, 0.20)} attach="geometry" />
              {shoesMat}
            </mesh>
          </group>
        </group>

        {/* Torso */}
        <group position={[0, 1.05, 0]}>
          <mesh>
            <primitive object={box(0.34, 0.38, 0.20)} attach="geometry" />
            {isMale ? maleShirtMat : femaleBlouseMat}
          </mesh>

          {/* Female Sailor Collar & Tie */}
          {!isMale && (
            <>
              <mesh position={[0, 0.13, 0.106]}>
                <primitive object={box(0.22, 0.12, 0.015)} attach="geometry" />
                {femaleNavyMat}
              </mesh>
              <mesh position={[0, 0.03, 0.108]}>
                <primitive object={box(0.04, 0.16, 0.015)} attach="geometry" />
                {femaleNavyMat}
              </mesh>
            </>
          )}

          {/* Male Polo Collar */}
          {isMale && (
            <mesh position={[0, 0.15, 0.104]}>
              <primitive object={box(0.16, 0.08, 0.015)} attach="geometry" />
              <meshStandardMaterial color="#2563eb" roughness={0.4} />
            </mesh>
          )}
        </group>

        {/* Left Arm (Shoulder + Elbow + Forearm + Hand) */}
        <group ref={leftArmRef} position={[-0.20, 1.20, 0]}>
          <mesh position={[0, -0.14, 0]}>
            <primitive object={box(0.09, 0.24, 0.09)} attach="geometry" />
            {isMale ? maleShirtMat : femaleBlouseMat}
          </mesh>
          <group ref={leftElbowRef} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.12, 0]}>
              <primitive object={box(0.08, 0.22, 0.08)} attach="geometry" />
              {skinMat}
            </mesh>
            <mesh position={[0, -0.24, 0]}>
              <primitive object={box(0.08, 0.06, 0.08)} attach="geometry" />
              {skinMat}
            </mesh>
          </group>
        </group>

        {/* Right Arm (Shoulder + Elbow + Forearm + Hand) */}
        <group ref={rightArmRef} position={[0.20, 1.20, 0]}>
          <mesh position={[0, -0.14, 0]}>
            <primitive object={box(0.09, 0.24, 0.09)} attach="geometry" />
            {isMale ? maleShirtMat : femaleBlouseMat}
          </mesh>
          <group ref={rightElbowRef} position={[0, -0.26, 0]}>
            <mesh position={[0, -0.12, 0]}>
              <primitive object={box(0.08, 0.22, 0.08)} attach="geometry" />
              {skinMat}
            </mesh>
            <mesh position={[0, -0.24, 0]}>
              <primitive object={box(0.08, 0.06, 0.08)} attach="geometry" />
              {skinMat}
            </mesh>
          </group>
        </group>

        {/* Neck & Head */}
        <group ref={headRef} position={[0, 1.38, 0]}>
          {/* Neck */}
          <mesh position={[0, -0.06, 0]}>
            <primitive object={cyl(0.045, 0.05, 0.08, 8)} attach="geometry" />
            {skinMat}
          </mesh>
          {/* Face */}
          <mesh>
            <primitive object={box(0.20, 0.22, 0.19)} attach="geometry" />
            {skinMat}
          </mesh>
          {/* Hair pieces stack without overlapping and always sit clearly outside the face box:
              coplanar faces of different meshes z-fight and flicker. */}
          {/* Hair top (y 0 … 0.14, wraps past the back of the face) */}
          <mesh position={[0, 0.07, -0.0025]}>
            <primitive object={box(0.22, 0.14, 0.235)} attach="geometry" />
            {hairMat}
          </mesh>
          {/* Hair back (y -0.11 … 0) */}
          <mesh position={[0, -0.055, -0.08]}>
            <primitive object={box(0.22, 0.11, 0.08)} attach="geometry" />
            {hairMat}
          </mesh>
          {/* Female long hair (y -0.24 … -0.11) */}
          {!isMale && (
            <mesh position={[0, -0.175, -0.08]}>
              <primitive object={box(0.22, 0.13, 0.08)} attach="geometry" />
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
  phaseOffset = 0,
  phaseLength,
  students,
  onStudentSelect,
}: LabCharacters3DProps) {
  // A ref, not state: updating state every frame re-rendered every avatar ~60 times a second (lag).
  const elapsedRef = useRef(phaseOffset);
  const startTimeRef = useRef<number | null>(null);
  const offsetRef = useRef(phaseOffset);

  // Restart the clock when the phase changes, picking up however far into it we already are.
  useEffect(() => {
    startTimeRef.current = null;
    offsetRef.current = phaseOffset;
    elapsedRef.current = phaseOffset;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simMode, lab.id]);

  const front = -d / 2;
  const bayCount = Math.max(4, Math.floor(d / 2.0));
  const bayLength = d / bayCount;
  const exitDoorZ = front + bayLength * 0.5;

  // Door is on the left wall
  const doorPoint: Waypoint = { x: -w / 2 + 0.90, z: exitDoorZ };
  // Front corridor in front of all desk islands
  const frontHallZ = front + 2.3;

  // Precompute waypoint routes and student agent data (skip broken & maintenance computers)
  const workingPcs = useMemo(() => pcs.filter((p) => p.shown !== 'broken' && p.shown !== 'maintenance'), [pcs]);

  const agents = useMemo<StudentAgentData[]>(() => {
    // 1. First pass: compute collision-free waypoint paths and walk distances for all students
    const rawList = workingPcs.map((pc) => {
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

      // Waypoints that STRICTLY avoid all computers and desks
      const waypoints: Waypoint[] = [];
      waypoints.push({ ...doorPoint });
      waypoints.push({ x: doorPoint.x, z: frontHallZ });

      if (style === 'island') {
        const nIslands = islandCount(lab);
        const iIsland = Math.floor(pc.col / 4);
        const cx = islandX(iIsland, nIslands);
        const isEndSeat = pc.row === LAYOUTS[lab.id]?.island?.endRow;

        // Clear aisle corridors: left side of island uses (cx - 1.80), right side uses (cx + 1.80)
        let aisleX = cx - 1.80;
        if (pc.col % 4 === 0) {
          aisleX = cx - 1.80; // Left side of island: use left aisle
        } else if (pc.col % 4 === 2) {
          aisleX = cx + 1.80; // Right side of island: use right aisle
        } else {
          aisleX = chairX < cx ? cx - 1.80 : cx + 1.80;
        }

        waypoints.push({ x: aisleX, z: frontHallZ });

        if (!isEndSeat) {
          // Regular side seat: walk down open aisle corridor, then step sideways directly into chair
          waypoints.push({ x: aisleX, z: chairZ });
          waypoints.push({ x: chairX, z: chairZ });
        } else {
          // End seat across the back end of the spine (Row 3 in ComLab 1):
          // MUST walk past the entire island in the open aisle, then along the rear walkway behind chairs, and step forward into chair
          const backHallZ = chairZ + 0.70; // safe rear walkway behind chairs
          waypoints.push({ x: aisleX, z: backHallZ });
          waypoints.push({ x: chairX, z: backHallZ });
          waypoints.push({ x: chairX, z: chairZ });
        }
      } else {
        // Table lab (NetLab): 3 table blocks
        let corridorX = -2.30;
        if (pc.col <= 1) {
          corridorX = -6.80; // Left wall aisle
        } else if (pc.col <= 4) {
          corridorX = -2.30; // Left-center aisle
        } else if (pc.col <= 9) {
          corridorX = 2.30; // Right-center aisle
        } else {
          corridorX = 6.80; // Right wall aisle
        }

        // Rear walkway behind the chairs of this row
        const rowWalkwayZ = chairZ + 0.50;
        waypoints.push({ x: corridorX, z: frontHallZ });
        waypoints.push({ x: corridorX, z: rowWalkwayZ });
        waypoints.push({ x: chairX, z: rowWalkwayZ });
        waypoints.push({ x: chairX, z: chairZ });
      }

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

      return {
        id: pc.id,
        pcId: pc.id,
        isMale,
        hash: h,
        chairPos: [chairX, 0, chairZ] as [number, number, number],
        pcPos,
        targetRotY,
        waypoints: cleaned,
        totalWalkDist,
        walkSpeed: 1.0, // Calm, steady indoor pace (1.0 m/s)
      };
    });

    // Seat the enrolled students of the class in seat order (only as many avatars as students).
    const seated = students?.length
      ? rawList.slice(0, students.length).map((a, i) => ({ ...a, student: students[i], isMale: students[i].sex ? students[i].sex === 'Male' : a.isMale }))
      : rawList;

    // 2. Compute 1-by-1 ranking:
    // For arrival (walk_in): Farthest seat enters door first so pathway is always open ahead of every student!
    const inOrder = [...seated].sort((a, b) => b.totalWalkDist - a.totalWalkDist || a.id.localeCompare(b.id));
    const inRankMap = new Map<string, number>();
    inOrder.forEach((item, idx) => inRankMap.set(item.id, idx));

    // For dismissal (walk_out): Closest seat stands up and exits door first so exit corridor is clear!
    const outOrder = [...seated].sort((a, b) => a.totalWalkDist - b.totalWalkDist || a.id.localeCompare(b.id));
    const outRankMap = new Map<string, number>();
    outOrder.forEach((item, idx) => outRankMap.set(item.id, idx));

    // Strictly one at a time through the same door and corridor. In realtime the arrivals are spread
    // over 80% of the window (10 min before class / last 5 min), never closer than 2.5 s apart.
    const gap = phaseLength ? Math.min(12, Math.max(2.5, (phaseLength * 0.8) / Math.max(1, seated.length))) : 2.5;
    return seated.map((item) => {
      const rankIn = inRankMap.get(item.id) ?? 0;
      const rankOut = outRankMap.get(item.id) ?? 0;

      const enterDelay = 0.4 + rankIn * gap;
      const exitDelay = 0.4 + rankOut * gap;

      return {
        ...item,
        enterDelay,
        exitDelay,
      };
    });
  }, [workingPcs, lab, style, doorPoint.x, doorPoint.z, frontHallZ, students, phaseLength]);

  // Max simulation time calculation
  const maxSimTime = useMemo(() => {
    if (simMode === 'walk_out') {
      return Math.max(
        ...agents.map((a) => a.exitDelay + a.totalWalkDist / a.walkSpeed + 1.2),
        4
      );
    }
    return Math.max(
      ...agents.map((a) => a.enterDelay + a.totalWalkDist / a.walkSpeed + 1.2),
      4
    );
  }, [agents, simMode]);

  useFrame(({ clock }) => {
    if (simMode === 'in_session' || simMode === 'empty') return;

    if (startTimeRef.current === null) {
      startTimeRef.current = clock.elapsedTime;
    }
    const curElapsed = offsetRef.current + clock.elapsedTime - startTimeRef.current;
    elapsedRef.current = curElapsed;

    if (curElapsed >= maxSimTime + 0.5 && onSimulationComplete) {
      onSimulationComplete();
    }
  });

  const showTeacher = simMode !== 'empty';

  return (
    <group>
      {/* Exactly 1 Teacher per comlab matching schedule (Mr. or Ms.), standing firmly on the floor beside the whiteboard */}
      {showTeacher && (
        <group position={[1.35, 0, front + 0.95]} rotation-y={-0.25}>
          <Teacher3D gender={isFemaleTeacher(teacherName) ? 'female' : 'male'} />
        </group>
      )}

      {/* 3D Animated Student Agents */}
      {agents.map((agent) => (
        <StudentAgent3D
          key={agent.id}
          agent={agent}
          simMode={simMode}
          elapsedRef={elapsedRef}
          onSelect={agent.student && onStudentSelect ? () => onStudentSelect(agent.student!, agent.pcId) : undefined}
        />
      ))}
    </group>
  );
}
