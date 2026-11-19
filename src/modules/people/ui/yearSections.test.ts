import { yearSections } from './People';
import type { ClassSchedule, Student } from '../../../shared/data/types';

it('lists recorded year & sections for a department, from records and the timetable', () => {
  const records = [{ course: 'BSIT', year_level: '2nd Year', section: 'b' }, { course: 'BSBA', year_level: '1st Year', section: 'A' }] as Student[];
  const timetable = [{ section: 'BSIT 1A' }, { section: 'BSIT 4' }, { section: 'BSHM 2A' }] as ClassSchedule[];
  expect(yearSections('BSIT', records, timetable)).toEqual(['1st Year A', '2nd Year B']);
  expect(yearSections('BSIT', [], [], '3rd Year C')).toEqual(['3rd Year C']);
});
