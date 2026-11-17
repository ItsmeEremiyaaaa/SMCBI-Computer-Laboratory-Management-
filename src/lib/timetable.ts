// AY 2026–2027, 2nd semester lab classes, from the BSIT schedule sheets (online and room 2xx/3xx classes left out).
import type { ScheduleInput } from './types';

const SEM = { starts_on: '2026-11-02', ends_on: '2027-03-31' };
const M = 1, T = 2, W = 3, TH = 4, F = 5;
const row = (day_of_week: number, start_time: string, end_time: string, lab_id: string, section: string, subject: string, instructor: string): ScheduleInput =>
  ({ day_of_week, start_time, end_time, lab_id, section, subject, instructor, ...SEM });

export const TIMETABLE: ScheduleInput[] = [
  row(M, '09:00', '12:00', 'lab2', 'BSIT 1A', 'IT123 Multimedia Systems', 'John Roi Julagting'),
  row(M, '09:00', '12:00', 'lab1', 'BSIT 1B', 'IT121 Computer Programming 2', 'Rhyven Jay G. Caballero'),
  row(M, '13:00', '16:00', 'lab2', 'BSIT 3A', 'IT322 Capstone Project and Research 1', 'Jhon Bryan J. Cantil'),
  row(M, '13:00', '16:00', 'lab1', 'BSIT 3B', 'IT401 Systems Administration and Maintenance', 'John Roi Julagting'),
  row(M, '17:00', '20:00', 'lab2', 'BSIT 3A', 'IT321 System Integration and Architecture 1', 'Kaye C. Bautista'),
  row(M, '17:00', '20:00', 'lab1', 'BSIT 3B', 'IT402 Computer Graphics and Animation', 'Rhyven Jay G. Caballero'),
  row(T, '09:00', '12:00', 'lab2', 'BSIT 2A', 'IT224 Applications Development & Emerging Technologies', 'Kaye C. Bautista'),
  row(T, '13:00', '16:00', 'lab2', 'BSIT 2A', 'IT223 Advanced Database Systems', 'Rhyven Jay G. Caballero'),
  row(T, '17:00', '20:00', 'lab2', 'BSIT 2A', 'IT221 Information Assurance and Security 1', 'John Roi Julagting'),
  row(W, '09:00', '12:00', 'lab2', 'BSIT 1A', 'IT121 Computer Programming 2', 'Rhyven Jay G. Caballero'),
  row(W, '09:00', '12:00', 'lab1', 'BSIT 1B', 'IT122 Introduction to Human Computer Interaction', 'Kaye C. Bautista'),
  row(W, '13:00', '16:00', 'lab1', 'BSIT 3A', 'IT401 Systems Administration and Maintenance', 'John Roi Julagting'),
  row(W, '13:00', '16:00', 'lab2', 'BSIT 3B', 'IT322 Capstone Project and Research 1', 'Jhon Bryan J. Cantil'),
  row(W, '17:00', '20:00', 'lab2', 'BSIT 3A', 'IT Elective 2 Mobile Development', 'Rhyven Jay G. Caballero'),
  row(W, '17:00', '20:00', 'netlab', 'BSIT 3B', 'IT323 Social and Professional Issues', 'Jhon Bryan J. Cantil'),
  row(TH, '13:00', '16:00', 'lab2', 'BSIT 2A', 'IT226 Object Oriented Programming', 'Kaye C. Bautista'),
  row(TH, '17:00', '20:00', 'lab1', 'BSIT 2A', 'IT222 Data Communications and Networking 1', 'S. April Mariae Libradilla'),
  row(F, '09:00', '12:00', 'lab1', 'BSIT 1A', 'IT122 Introduction to Human Computer Interaction', 'Kaye C. Bautista'),
  row(F, '09:00', '12:00', 'lab2', 'BSIT 1B', 'IT123 Multimedia Systems', 'John Roi Julagting'),
  row(F, '13:00', '16:00', 'lab2', 'BSIT 3A', 'IT402 Computer Graphics and Animation', 'Rhyven Jay G. Caballero'),
  row(F, '13:00', '16:00', 'lab1', 'BSIT 3B', 'IT321 System Integration and Architecture 1', 'Kaye C. Bautista'),
  row(F, '17:00', '20:00', 'lab1', 'BSIT 3A', 'IT323 Social and Professional Issues', 'Jhon Bryan J. Cantil'),
  row(F, '17:00', '20:00', 'lab2', 'BSIT 3B', 'IT Elective 2 Mobile Development', 'Rhyven Jay G. Caballero'),
];
