// Dashboard repository: the only database calls this module makes (overview counts).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type DashboardRepository = Pick<Api,
  'stats'>;

export const dashboardRepo: DashboardRepository = api;
