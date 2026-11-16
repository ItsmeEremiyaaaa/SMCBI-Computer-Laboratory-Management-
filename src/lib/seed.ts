import { manilaNow } from './seat';
import type { Lab, LabEvent, Pc, Profile, Reservation, Student } from './types';

export interface MockState {
  profiles: Profile[];
  labs: Lab[];
  pcs: Pc[];
  reservations: Reservation[];
  students: Student[];
  events: LabEvent[];
}

const person = (id: string, full_name: string, role: Profile['role'], approved: boolean, department: string): Profile => ({
  id, full_name, email: `${id}@smcbi.edu.ph`, role, approved, department, course: null, phone: null, address: null,
});

const pad = (n: number) => String(n).padStart(2, '0');
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function seed(): MockState {
  const labs: Lab[] = [
    { id: 'lab1', name: 'Computer Laboratory 1', rows: 5, cols: 6 },
    { id: 'lab2', name: 'Computer Laboratory 2', rows: 5, cols: 6 },
    { id: 'netlab', name: 'Computer Laboratory Netlab', rows: 5, cols: 6 },
  ];
  const pcs: Pc[] = labs.flatMap((lab) =>
    Array.from({ length: lab.rows * lab.cols }, (_, i) => ({
      id: `${lab.id}-pc${pad(i + 1)}`, lab_id: lab.id, label: `PC-${pad(i + 1)}`,
      row: Math.floor(i / lab.cols), col: i % lab.cols, status: 'free' as const, note: null, updated_at: new Date().toISOString(),
    })));
  // A lived-in demo: some PCs in use or broken.
  for (const [id, status, note] of [
    ['lab1-pc02', 'in_use', null], ['lab1-pc03', 'in_use', null], ['lab1-pc09', 'in_use', null],
    ['lab1-pc14', 'broken', 'No display'], ['lab1-pc21', 'in_use', null], ['lab1-pc27', 'broken', 'Keyboard missing'],
    ['netlab-pc04', 'in_use', null], ['netlab-pc05', 'in_use', null], ['netlab-pc18', 'broken', 'No network'],
  ] as const) Object.assign(pcs.find((p) => p.id === id)!, { status, note });

  const now = manilaNow();
  const h = Number(now.time.slice(0, 2));
  const start = `${pad(Math.max(0, h - 1))}:00`;
  const end = h + 2 >= 24 ? '23:59' : `${pad(h + 2)}:00`;
  const tomorrow = addDays(now.date, 1);
  const base = { participants: null, requirements: null, admin_notes: null, reviewed_at: null };
  const reservations: Reservation[] = [
    { ...base, id: 'r1', title: 'Programming 2 — BSIT 1A', lab_id: 'lab2', pc_id: null, purpose: 'Laboratory class', date: now.date, start_time: start, end_time: end, requester_id: 'teacher', requester_name: 'Maria Santos', participants: 30, status: 'approved' },
    { ...base, id: 'r2', title: 'Thesis testing', lab_id: 'netlab', pc_id: 'netlab-pc12', purpose: 'Capstone network test', date: now.date, start_time: start, end_time: end, requester_id: 'teacher', requester_name: 'Maria Santos', status: 'approved' },
    { ...base, id: 'r3', title: 'Web Development — BSIT 2B', lab_id: 'lab1', pc_id: null, purpose: 'Midterm practical exam', date: tomorrow, start_time: '08:00', end_time: '11:00', requester_id: 'teacher', requester_name: 'Maria Santos', participants: 28, status: 'pending' },
    { ...base, id: 'r4', title: 'Office Productivity — BSBA 1C', lab_id: 'lab2', pc_id: null, purpose: 'Spreadsheet lesson', date: tomorrow, start_time: '13:00', end_time: '15:00', requester_id: 'teacher', requester_name: 'Maria Santos', participants: 35, status: 'pending' },
  ];

  const stu = (n: number, full_name: string, course: string, section: string, year_level: string): Student => ({
    id: `s${n}`, student_id: `2025-${pad(n)}01`, full_name, email: `${full_name.split(' ')[0].toLowerCase()}${n}@smcbi.edu.ph`,
    course, section, year_level, phone: null, address: null,
  });

  return {
    labs, pcs, reservations,
    profiles: [
      person('admin', 'Lab Administrator', 'admin', true, 'Admin'),
      person('staff', 'Jose Reyes', 'staff', true, 'Admin'),
      person('teacher', 'Maria Santos', 'teacher', true, 'BSIT'),
      person('newteacher', 'Carlo Dizon', 'teacher', false, 'BSBA'),
    ],
    students: [
      stu(1, 'Ana Cruz', 'BSIT', 'A', '1st Year'), stu(2, 'Ben Lopez', 'BSIT', 'B', '2nd Year'),
      stu(3, 'Carla Mendoza', 'BSBA', 'C', '1st Year'), stu(4, 'Dan Garcia', 'BSHM', 'A', '3rd Year'),
      stu(5, 'Ella Ramos', 'BEED', 'A', '2nd Year'), stu(6, 'Felix Tan', 'BSED', 'B', '4th Year'),
    ],
    events: [
      { id: 'e1', title: 'Lab maintenance', description: 'All labs closed for cleaning', event_date: addDays(now.date, 3), event_time: '08:00', event_type: 'meeting', owner_id: 'admin' },
      { id: 'e2', title: 'Midterm week', description: null, event_date: addDays(now.date, 7), event_time: '07:30', event_type: 'academic', owner_id: 'admin' },
    ],
  };
}
