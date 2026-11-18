// Lab classes from the "Computer Laboratory 1/2 Class Schedule" sheets (SY 2026–2027).
// Each class is placed in the lab whose sheet lists it. Three cells name the other room
// (Lab 1 Mon 9–12 and Mon 5–8 say Comlab2, Lab 2 Fri 5–8 says Comlab1); taking those literally
// would double-book that room, so they are treated as typos. Edit on the Class schedule page if wrong.
import type { ScheduleInput } from './types';

const SEM = { starts_on: '2026-11-02', ends_on: '2027-03-31' };
const M = 1, T = 2, W = 3, TH = 4, F = 5, S = 6;
const AM = ['09:00', '12:00'] as const, PM = ['13:00', '16:00'] as const, EVE = ['17:00', '20:00'] as const;
const row = (day_of_week: number, [start_time, end_time]: readonly [string, string], lab_id: string, section: string, subject: string, instructor: string): ScheduleInput =>
  ({ day_of_week, start_time, end_time, lab_id, section, subject, instructor, ...SEM });

const CABALLERO = 'Rhyven Jay G. Caballero';
const BAUTISTA = 'Kaye C. Bautista';
const JULAGTING = 'John Roi Julagting';
const CANTIL = 'Jhon Bryan J. Cantil, MIT';
const GELERA = 'Mariel Gelera';
const BALUNAN = 'Vince Jose Balunan';
const MANQUIQUIZ = 'April Mae Manquiquiz';
const WASKIN = 'Melanie B. Waskin, LPT';
const LELIS = 'John Carl Ray Lelis';

export const TIMETABLE: ScheduleInput[] = [
  // Computer Laboratory 1
  row(M, AM, 'lab1', 'BSIT 2B', 'IT213 Information Management', CABALLERO),
  row(T, AM, 'lab1', 'BSIT 2B', 'IT212 Data Structures & Algorithm', BAUTISTA),
  row(W, AM, 'lab1', 'BEED 2', 'EGE106 Living in the IT Era', GELERA),
  row(TH, AM, 'lab1', 'BSIT 2B', 'IT211 Web Systems & Technologies', JULAGTING),
  row(F, AM, 'lab1', 'BSIT 1A', 'IT111 Introduction to Computing', CANTIL),
  row(S, AM, 'lab1', 'BSIT 3B', 'IT312 Networking 2', BALUNAN),
  row(M, PM, 'lab1', 'BSHM 2A', 'HPC3 Applied Business Tools and Technologies', BAUTISTA),
  row(T, PM, 'lab1', 'BSBA 2A', 'IT 201 Living in the IT Era', GELERA),
  row(W, PM, 'lab1', 'BSED 1', 'SGE106 Living in the IT Era', 'S. April Mariae Libradilla, RVM'),
  row(TH, PM, 'lab1', 'BSBA 2C', 'IT 201 Living in the IT Era', JULAGTING),
  row(F, PM, 'lab1', 'BSHM 2B', 'HPC3 Applied Business Tools and Technologies', BAUTISTA),
  row(S, PM, 'lab1', 'BSIT 3A', 'IT312 Networking 2', BALUNAN),
  row(M, EVE, 'lab1', 'BSIT 3A', 'IT313 Integrative Programming and Technologies 1', BAUTISTA),
  row(T, EVE, 'lab1', 'BSBA 2B', 'IT 201 Living in the IT Era', GELERA),
  row(W, EVE, 'lab1', 'BSIT 3A', 'PerDev Social Grace and Etiquette', CANTIL),
  row(TH, EVE, 'lab1', 'BSBA 2D', 'IT 201 Living in the IT Era', JULAGTING),
  row(F, EVE, 'lab1', 'BSIT 3B', 'PerDev Social Grace and Etiquette', CANTIL),

  // Computer Laboratory 2
  row(M, AM, 'lab2', 'BSIT 1B', 'IT111 Introduction to Computing', CANTIL),
  row(T, AM, 'lab2', 'BSIT 4', 'IT Elec4 Mobile Application Development', JULAGTING),
  row(W, AM, 'lab2', 'BSIT 1A', 'IT112 Computer Programming 1', CABALLERO),
  row(TH, AM, 'lab2', 'BSIT 4', 'IT411 Capstone Project and Research 2', CANTIL),
  row(F, AM, 'lab2', 'BSIT 1B', 'IT112 Computer Programming 1', CABALLERO),
  row(S, AM, 'lab2', 'BSIT 3A', 'IT314 Information Assurance and Security 2', MANQUIQUIZ),
  row(M, PM, 'lab2', 'BSIT 3A', 'IT315 System Analysis and Design', CABALLERO),
  row(T, PM, 'lab2', 'BSIT 3B', 'IT316 Quantitative Methods (incl. Modeling and Simulation)', WASKIN),
  row(W, PM, 'lab2', 'BSIT 3A', 'IT316 Quantitative Methods (incl. Modeling and Simulation)', WASKIN),
  row(TH, PM, 'lab2', 'BSIT 3B', 'IT315 System Analysis and Design', CABALLERO),
  row(F, PM, 'lab2', 'BSIT 3A', 'IT311 E-Commerce', LELIS),
  row(S, PM, 'lab2', 'BSIT 3B', 'IT314 Information Assurance and Security 2', MANQUIQUIZ),
  row(M, EVE, 'lab2', 'BSIT 2A', 'IT213 Information Management', CABALLERO),
  row(T, EVE, 'lab2', 'BSIT 3B', 'IT313 Integrative Programming and Technologies 1', BAUTISTA),
  row(W, EVE, 'lab2', 'BSIT 2A', 'IT211 Web Systems & Technologies', JULAGTING),
  row(TH, EVE, 'lab2', 'BSIT 3B', 'IT311 E-Commerce', LELIS),
  row(F, EVE, 'lab2', 'BSIT 2A', 'IT212 Data Structures & Algorithm', BAUTISTA),
];
