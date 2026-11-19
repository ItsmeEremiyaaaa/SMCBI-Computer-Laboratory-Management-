// Bookings repository: the only database calls this module makes (bookings: list, request, review, delete, live changes).
// Screens depend on this contract, not on Supabase; shared/data/api.ts binds it to the live or demo backend.
import { api, type Api } from '../../../shared/data/api';

export type BookingsRepository = Pick<Api,
  'listReservations' | 'createReservation' | 'reviewReservation' | 'deleteReservation' | 'subscribeReservations'>;

export const bookingsRepo: BookingsRepository = api;
