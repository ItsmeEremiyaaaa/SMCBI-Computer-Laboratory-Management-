// Reports repository: the only database calls this module makes (PC problem reports).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type ReportsRepository = Pick<Api,
  'listReports' | 'reportProblem' | 'resolveReport' | 'deleteReports'>;

export const reportsRepo: ReportsRepository = api;
