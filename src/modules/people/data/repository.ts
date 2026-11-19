// People repository: the only database calls this module makes (accounts and student records).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type PeopleRepository = Pick<Api,
  'listProfiles' | 'updateProfile' | 'listStudents' | 'sectionSizes' | 'saveStudent' | 'deleteStudent' | 'setAccountArchived' | 'updateAccountEmail'>;

export const peopleRepo: PeopleRepository = api;
