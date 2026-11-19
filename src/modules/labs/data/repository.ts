// Labs repository: the only database calls this module makes (labs, PCs, their status and student check-ins).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type LabsRepository = Pick<Api,
  'listLabs' | 'listPcs' | 'setPcStatus' | 'subscribePcs' | 'listCheckIns' | 'checkIn' | 'checkOut'>;

export const labsRepo: LabsRepository = api;
