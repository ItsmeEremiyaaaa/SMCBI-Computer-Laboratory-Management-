// Schedule repository: the only database calls this module makes (weekly lab classes).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type ScheduleRepository = Pick<Api,
  'listSchedules' | 'saveSchedule' | 'deleteSchedule'>;

export const scheduleRepo: ScheduleRepository = api;
