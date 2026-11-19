// Auth repository: the only database calls this module makes (sign-in, sign-up, sessions and passwords).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type AuthRepository = Pick<Api,
  'demo' | 'getSession' | 'onAuthChange' | 'signIn' | 'signUp' | 'signOut' | 'resetPassword' | 'updatePassword' | 'resendConfirmation'>;

export const authRepo: AuthRepository = api;
