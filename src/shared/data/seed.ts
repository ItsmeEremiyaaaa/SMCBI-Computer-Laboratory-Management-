import { manilaNow } from '../time';
import { LAYOUTS, seatsFor } from '../../modules/labs/logic/layouts';
import { TIMETABLE } from './timetable';
import { BSIT_ROSTER, type ArchivedItem, type CheckIn, type ClassChange, type Message, type ClassSchedule, type PcReport, type Lab, type LabEvent, type Pc, type Profile, type Reservation, type Student } from './types';

export interface MockState {
  profiles: Profile[];
  labs: Lab[];
  pcs: Pc[];
  reservations: Reservation[];
  students: Student[];
  events: LabEvent[];
  schedules: ClassSchedule[];
  checkIns: CheckIn[];
  reports: PcReport[];
  archive: ArchivedItem[];
  classChanges?: ClassChange[];
  messages?: Message[];
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
    { id: 'lab1', name: 'Computer Laboratory 1', rows: LAYOUTS.lab1.rows, cols: LAYOUTS.lab1.cols },
    { id: 'lab2', name: 'Computer Laboratory 2', rows: LAYOUTS.lab2.rows, cols: LAYOUTS.lab2.cols },
    { id: 'netlab', name: 'Networking Laboratory', rows: LAYOUTS.netlab.rows, cols: LAYOUTS.netlab.cols },
  ];
  const pcs: Pc[] = labs.flatMap((lab) => seatsFor(lab.id).map((s) => ({
    ...s, lab_id: lab.id, status: 'free' as const, note: null, updated_at: new Date().toISOString(),
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

  return {
    labs, pcs, reservations,
    profiles: [
      person('admin', 'Lab Administrator', 'admin', true, 'Admin'),
      person('staff', 'Jose Reyes', 'staff', true, 'Admin'),
      person('teacher', 'Maria Santos', 'teacher', true, 'BSIT'),
      person('newteacher', 'Carlo Dizon', 'teacher', false, 'BSBA'),
      // demo student: matches roster record C230001 (sign in as c230001@smcbi.edu.ph)
      { id: 'student', full_name: '4th Year Student 001', email: 'c230001@smcbi.edu.ph', role: 'student', approved: true, department: 'BSIT', course: '4th Year A', phone: null, address: null },
    ],
    students: bsitRoster(),
    schedules: seedSchedules(),
    checkIns: [],
    reports: [],
    archive: [],
    events: [
      { id: 'e1', title: 'Lab maintenance', description: 'All labs closed for cleaning', event_date: addDays(now.date, 3), event_time: '08:00', event_type: 'meeting', owner_id: 'admin' },
      { id: 'e2', title: 'Midterm week', description: null, event_date: addDays(now.date, 7), event_time: '07:30', event_type: 'academic', owner_id: 'admin' },
    ],
  };
}

// Placeholder BSIT records matching the official enrollment counts (same rows as migration 0005).
// IDs are C + entry year + 4 digits (e.g. C260001); names are placeholders to be edited.
// Sections are filled round-robin, at most ~40 students each.
export function bsitRoster(): Student[] {
  return BSIT_ROSTER.flatMap(({ yy, year_level, male, female }) => {
    const n = male + female;
    const sections = Math.ceil(n / 40);
    return Array.from({ length: n }, (_, k): Student => {
      const i = k + 1;
      const student_id = `C${yy}${String(i).padStart(4, '0')}`;
      return {
        id: `stu-${student_id}`, student_id, full_name: `${year_level} Student ${String(i).padStart(3, '0')}`,
        email: `${student_id.toLowerCase()}@smcbi.edu.ph`, course: 'BSIT', section: String.fromCharCode(65 + (k % sections)),
        year_level, phone: null, address: null, sex: i <= male ? 'Male' : 'Female', status: 'Enrolled',
      };
    });
  });
}

export const seedSchedules = (): ClassSchedule[] => TIMETABLE.map((s, i) => ({ ...s, id: `cls${i + 1}` }));
