// Archive repository: the only database calls this module makes (the recycle bin: restore or erase for good).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type ArchiveRepository = Pick<Api,
  'listArchive' | 'restoreArchived' | 'purgeArchived'>;

export const archiveRepo: ArchiveRepository = api;
