import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { LAYOUTS } from '../lib/layouts';
import type { ClassSchedule, Lab } from '../lib/types';
import type { LivePc } from '../hooks/useLabLive';

export type QolMode = 'auto' | 'in_session' | 'entering' | 'exiting' | 'empty';

interface LabCharactersProps {
  lab: Lab;
  pcs: LivePc[];
  w: number;
  d: number;
  mode: 'in_session' | 'entering' | 'exiting' | 'empty';
  classInfo: ClassSchedule | null;
}

interface Waypoint {
  x: number;
  z: number;
}

interface StudentAgent {
  id: string;
  pcId: string;
  gender: 'male' | 'female';
  sitVariation: number;
  useLaptopRow: boolean;
  chairPos: [number, number, number];
  seatedFlipped: boolean;
  waypoints: Waypoint[];
  enterDelay: number;
  exitDelay: number;
  walkSpeed: number;
}

// Atlas specification: 11 columns x 7 rows
// Row 0: male_walk
// Row 1: female_walk
// Row 2: male_sit
// Row 3: female_sit
// Row 4: male_laptop
// Row 5: female_laptop
// Row 6: col 0 = teacher_male, col 1 = teacher_female

const ISLAND_GAP = 3.6;
const ISLAND_ROW = 1.2;
const islandCount = (lab: Lab) => Math.ceil(lab.cols / 4);
const islandX = (i: number, n: number) => (i - (n - 1) / 2) * ISLAND_GAP;
const sideRows = (lab: Lab) => LAYOUTS[lab.id]?.island?.endRow ?? lab.rows;
const sideZ = (row: number, lab: Lab) => (row - (sideRows(lab) - 1) / 2) * ISLAND_ROW - 0.4;
const DX = 1.4;
const DZ = 1.8;
const seatX = (col: number, cols: number) => (col - (cols - 1) / 2) * DX;
const rowZ = (row: number, rows: number) => (row - (rows - 1) / 2) * DZ + 1.2;

function getPcPosAndRot(pc: LivePc, lab: Lab, isIsland: boolean): { pos: [number, number, number]; rot: number } {
  if (!isIsland) return { pos: [seatX(pc.col, lab.cols), 0, rowZ(pc.row, lab.rows)], rot: 0 };
  const cx = islandX(Math.floor(pc.col / 4), islandCount(lab));
  const left = pc.col % 4 === 0;
  if (pc.row !== LAYOUTS[lab.id]?.island?.endRow) {
    return { pos: [cx + (left ? -0.55 : 0.55), 0, sideZ(pc.row, lab)], rot: left ? -Math.PI / 2 : Math.PI / 2 };
  }
  return { pos: [cx + (left ? -0.58 : 0.58), 0, sideZ(sideRows(lab) - 1, lab) + ISLAND_ROW / 2 + 0.65], rot: 0 };
}

export default function LabCharacters({ lab, pcs, w, d, mode, classInfo }: LabCharactersProps) {
  const atlasTexture = useTexture('/sprites/uniform_atlas.png');
  atlasTexture.minFilter = THREE.LinearFilter;
  atlasTexture.magFilter = THREE.LinearFilter;

  const atlasMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: atlasTexture,
        transparent: true,
        alphaTest: 0.05,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [atlasTexture]
  );

  // Cached frame geometries for all 11 columns, 7 rows, flipped/unflipped
  const geoCache = useRef<Map<string, THREE.BufferGeometry>>(new Map());

  const getGeometry = (col: number, row: number, width: number, height: number, flipped: boolean) => {
    const key = `${col}_${row}_${width}_${height}_${flipped}`;
    let geo = geoCache.current.get(key);
    if (!geo) {
      geo = new THREE.PlaneGeometry(width, height);
      const u0 = flipped ? (col + 1) / 11 : col / 11;
      const u1 = flipped ? col / 11 : (col + 1) / 11;
      const v0 = (6 - row) / 7;
      const v1 = (7 - row) / 7;
      const uvs = new Float32Array([
        u0, v1,
        u1, v1,
        u0, v0,
        u1, v0,
      ]);
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.translate(0, height / 2, 0); // Origin at character feet
      geoCache.current.set(key, geo);
    }
    return geo;
  };

  const front = -d / 2;
  const isIsland = !!LAYOUTS[lab.id]?.island;
  const bayCount = Math.max(4, Math.floor(d / 2.0));
  const bayLength = d / bayCount;
  const exitDoorZ = front + bayLength * 0.5;
  const doorPos: [number, number] = [-w / 2 + 0.75, exitDoorZ];
  const frontHallZ = front + 2.1;

  // Build agent data for each working (non-broken) PC
  const workingPcs = useMemo(() => pcs.filter((p) => p.shown !== 'broken'), [pcs]);

  const agents = useMemo<StudentAgent[]>(() => {
    return workingPcs.map((pc, idx) => {
      const { pos, rot } = getPcPosAndRot(pc, lab, isIsland);

      // Chair position in world coords
      const chairX = pos[0] + Math.sin(rot) * 0.62;
      const chairZ = pos[2] + Math.cos(rot) * 0.62;

      // Determine aisle column
      let aisleX = chairX;
      let seatedFlipped = false;
      if (isIsland) {
        if (rot === -Math.PI / 2) {
          // Left side of island, faces east/right toward desk
          aisleX = chairX - 0.45;
          seatedFlipped = false;
        } else if (rot === Math.PI / 2) {
          // Right side of island, faces west/left toward desk
          aisleX = chairX + 0.45;
          seatedFlipped = true;
        } else {
          // End row
          aisleX = chairX;
          seatedFlipped = pc.col % 4 === 0;
        }
      }

      // Waypoints from door to chair
      const waypoints: Waypoint[] = [
        { x: doorPos[0], z: doorPos[1] },
        { x: doorPos[0] + 1.2, z: frontHallZ },
        { x: aisleX, z: frontHallZ },
        { x: aisleX, z: chairZ },
        { x: chairX, z: chairZ },
      ];

      return {
        id: `agent-${pc.id}`,
        pcId: pc.id,
        gender: idx % 2 === 0 ? 'male' : 'female',
        sitVariation: (idx * 3) % 11,
        useLaptopRow: idx % 3 !== 0,
        chairPos: [chairX, 0, chairZ],
        seatedFlipped,
        waypoints,
        enterDelay: (idx * 0.35) % 10.5,
        exitDelay: (idx * 0.28) % 8.5,
        walkSpeed: 2.3 + (idx % 4) * 0.15,
      };
    });
  }, [workingPcs, lab, isIsland, doorPos, frontHallZ]);

  // Animation state tracking in useFrame
  const stateRef = useRef<{
    startTime: number;
    lastMode: string;
    studentStates: Map<
      string,
      {
        pos: [number, number, number];
        state: 'waiting' | 'walking' | 'seated' | 'exited';
        walkFrame: number;
        flipped: boolean;
      }
    >;
  }>({
    startTime: 0,
    lastMode: '',
    studentStates: new Map(),
  });

  // Track active animation frame for render
  const [, setTick] = useState(0);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const st = stateRef.current;

    if (st.lastMode !== mode) {
      st.lastMode = mode;
      st.startTime = time;
    }

    const elapsed = time - st.startTime;

    agents.forEach((ag) => {
      let current = st.studentStates.get(ag.id);
      if (!current) {
        current = {
          pos: [...ag.chairPos],
          state: 'seated',
          walkFrame: 0,
          flipped: false,
        };
        st.studentStates.set(ag.id, current);
      }

      if (mode === 'empty') {
        current.state = 'exited';
        return;
      }

      if (mode === 'in_session') {
        current.state = 'seated';
        current.pos = [...ag.chairPos];
        current.flipped = ag.seatedFlipped;
        return;
      }

      if (mode === 'entering') {
        const studentElapsed = elapsed - ag.enterDelay;
        if (studentElapsed <= 0) {
          current.state = 'waiting';
          current.pos = [doorPos[0], 0, doorPos[1]];
          return;
        }

        // Compute total path distance and waypoint distances
        const dists: number[] = [];
        let totalDist = 0;
        for (let i = 0; i < ag.waypoints.length - 1; i++) {
          const d = Math.hypot(
            ag.waypoints[i + 1].x - ag.waypoints[i].x,
            ag.waypoints[i + 1].z - ag.waypoints[i].z
          );
          dists.push(d);
          totalDist += d;
        }

        const coveredDist = studentElapsed * ag.walkSpeed;
        if (coveredDist >= totalDist) {
          current.state = 'seated';
          current.pos = [...ag.chairPos];
          current.flipped = ag.seatedFlipped;
          return;
        }

        // Interpolate along waypoints
        current.state = 'walking';
        let acc = 0;
        let segIdx = 0;
        while (segIdx < dists.length && acc + dists[segIdx] < coveredDist) {
          acc += dists[segIdx];
          segIdx++;
        }

        if (segIdx < dists.length) {
          const segProgress = (coveredDist - acc) / Math.max(0.001, dists[segIdx]);
          const p0 = ag.waypoints[segIdx];
          const p1 = ag.waypoints[segIdx + 1];
          const curX = p0.x + (p1.x - p0.x) * segProgress;
          const curZ = p0.z + (p1.z - p0.z) * segProgress;
          current.pos = [curX, 0, curZ];

          const dx = p1.x - p0.x;
          current.flipped = dx > 0.05 ? true : dx < -0.05 ? false : current.flipped;
          current.walkFrame = Math.floor(studentElapsed * 11) % 11;
        }
        return;
      }

      if (mode === 'exiting') {
        const studentElapsed = elapsed - ag.exitDelay;
        if (studentElapsed <= 0) {
          current.state = 'seated';
          current.pos = [...ag.chairPos];
          current.flipped = ag.seatedFlipped;
          return;
        }

        // Reverse path
        const revWaypoints = [...ag.waypoints].reverse();
        const dists: number[] = [];
        let totalDist = 0;
        for (let i = 0; i < revWaypoints.length - 1; i++) {
          const d = Math.hypot(
            revWaypoints[i + 1].x - revWaypoints[i].x,
            revWaypoints[i + 1].z - revWaypoints[i].z
          );
          dists.push(d);
          totalDist += d;
        }

        const coveredDist = studentElapsed * ag.walkSpeed;
        if (coveredDist >= totalDist) {
          current.state = 'exited';
          return;
        }

        current.state = 'walking';
        let acc = 0;
        let segIdx = 0;
        while (segIdx < dists.length && acc + dists[segIdx] < coveredDist) {
          acc += dists[segIdx];
          segIdx++;
        }

        if (segIdx < dists.length) {
          const segProgress = (coveredDist - acc) / Math.max(0.001, dists[segIdx]);
          const p0 = revWaypoints[segIdx];
          const p1 = revWaypoints[segIdx + 1];
          const curX = p0.x + (p1.x - p0.x) * segProgress;
          const curZ = p0.z + (p1.z - p0.z) * segProgress;
          current.pos = [curX, 0, curZ];

          const dx = p1.x - p0.x;
          current.flipped = dx > 0.05 ? true : dx < -0.05 ? false : current.flipped;
          current.walkFrame = Math.floor(studentElapsed * 11) % 11;
        }
      }
    });

    setTick((t) => (t + 1) % 1000);
  });

  const showTeachers = mode === 'in_session' || mode === 'entering';

  return (
    <group>
      {/* Front Instructors / Teachers during class or student entrance */}
      {showTeachers && (
        <>
          {/* Male Teacher: gesturing at whiteboard */}
          <Billboard follow lockX={false} lockY={false} lockZ={false} position={[-1.1, 0, front + 1.45]}>
            <mesh geometry={getGeometry(0, 6, 1.05, 1.62, false)} material={atlasMaterial} />
          </Billboard>
          {/* Female Teacher: standing with lesson materials */}
          <Billboard follow lockX={false} lockY={false} lockZ={false} position={[1.1, 0, front + 1.45]}>
            <mesh geometry={getGeometry(1, 6, 0.98, 1.55, false)} material={atlasMaterial} />
          </Billboard>
        </>
      )}

      {/* Student Agents */}
      {agents.map((ag) => {
        const cur = stateRef.current.studentStates.get(ag.id);
        if (!cur || cur.state === 'waiting' || cur.state === 'exited') {
          return null;
        }

        if (cur.state === 'walking') {
          const row = ag.gender === 'male' ? 0 : 1;
          return (
            <Billboard
              key={ag.id}
              follow
              lockX={false}
              lockY={false}
              lockZ={false}
              position={cur.pos}
            >
              <mesh
                geometry={getGeometry(cur.walkFrame, row, 1.05, 1.6, cur.flipped)}
                material={atlasMaterial}
              />
            </Billboard>
          );
        }

        if (cur.state === 'seated') {
          // Seated student at desk
          const row = ag.useLaptopRow
            ? ag.gender === 'male' ? 4 : 5
            : ag.gender === 'male' ? 2 : 3;

          return (
            <Billboard
              key={ag.id}
              follow
              lockX={false}
              lockY={false}
              lockZ={false}
              position={[ag.chairPos[0], 0.05, ag.chairPos[2]]}
            >
              <mesh
                geometry={getGeometry(ag.sitVariation, row, 0.96, 1.35, ag.seatedFlipped)}
                material={atlasMaterial}
              />
            </Billboard>
          );
        }

        return null;
      })}
    </group>
  );
}

useTexture.preload('/sprites/uniform_atlas.png');
