// Calendar repository: the only database calls this module makes (school calendar events).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type CalendarRepository = Pick<Api,
  'listEvents' | 'saveEvent' | 'deleteEvent'>;

export const calendarRepo: CalendarRepository = api;
